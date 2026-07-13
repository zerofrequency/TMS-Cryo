#!/usr/bin/env python3
import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import NamedTuple
from urllib.parse import unquote, urlsplit
import uuid


MAX_BODY = 20 * 1024 * 1024
ALLOWED_ENTITY_TYPES = {"trip_plan": "trip-plans"}
ALLOWED_DOCUMENT_TYPES = {"pod"}
MIME_RULES = {
    "application/pdf": ({".pdf"}, ".pdf", lambda body: body.startswith(b"%PDF-")),
    "image/png": ({".png"}, ".png", lambda body: body.startswith(b"\x89PNG\r\n\x1a\n")),
    "image/jpeg": ({".jpg", ".jpeg"}, ".jpg", lambda body: body.startswith(b"\xff\xd8\xff")),
}
EXTENSION_MIME_TYPES = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
}


class UploadDetails(NamedTuple):
    extension: str
    safe_original_name: str


class UploadValidationError(ValueError):
    pass


class PathValidationError(ValueError):
    pass


def validate_upload(entity_type, entity_id, document_type, file_name, content_type, body):
    if entity_type not in ALLOWED_ENTITY_TYPES:
        raise UploadValidationError("Unsupported entity type.")
    try:
        uuid.UUID(entity_id)
    except (ValueError, TypeError, AttributeError) as error:
        raise UploadValidationError("Entity ID must be a UUID.") from error
    if document_type not in ALLOWED_DOCUMENT_TYPES:
        raise UploadValidationError("Unsupported document type.")
    if not body:
        raise UploadValidationError("Document body is empty.")
    if len(body) > MAX_BODY:
        raise UploadValidationError("Document exceeds the 20 MiB limit.")

    rule = MIME_RULES.get(content_type)
    if not rule:
        raise UploadValidationError("Unsupported document MIME type.")
    allowed_extensions, canonical_extension, signature_matches = rule
    safe_original_name = Path(str(file_name).replace("\\", "/")).name.strip()
    if not safe_original_name:
        raise UploadValidationError("Document file name is required.")
    if Path(safe_original_name).suffix.lower() not in allowed_extensions:
        raise UploadValidationError("Document extension does not match its MIME type.")
    if not signature_matches(body):
        raise UploadValidationError("Document signature does not match its MIME type.")
    return UploadDetails(canonical_extension, safe_original_name)


def resolve_storage_path(root, storage_path):
    root_path = Path(root).resolve()
    raw_path = unquote(str(storage_path)).replace("\\", "/")
    relative = Path(raw_path)
    if not raw_path or relative.is_absolute() or any(part in {"", ".", ".."} for part in relative.parts):
        raise PathValidationError("Invalid document storage path.")
    resolved = (root_path / relative).resolve()
    try:
        resolved.relative_to(root_path)
    except ValueError as error:
        raise PathValidationError("Document path escapes the storage root.") from error
    return resolved


class DocumentHandler(BaseHTTPRequestHandler):
    server_version = "TMSDocuments/1.0"

    def log_message(self, _format, *_args):
        return

    def do_PUT(self):
        if urlsplit(self.path).path != "/documents/files":
            self.send_json_error(404, "Document endpoint not found.")
            return
        try:
            length = self.content_length()
            if length > MAX_BODY:
                self.send_json_error(413, "Document exceeds the 20 MiB limit.")
                return
            body = self.rfile.read(length)
            if len(body) != length:
                self.send_json_error(400, "Incomplete document body.")
                return
            entity_type = self.headers.get("X-TMS-Entity-Type", "").strip()
            entity_id = self.headers.get("X-TMS-Entity-Id", "").strip()
            document_type = self.headers.get("X-TMS-Document-Type", "").strip()
            file_name = unquote(self.headers.get("X-TMS-File-Name", "").strip())
            content_type = self.headers.get("Content-Type", "").split(";", 1)[0].strip().lower()
            details = validate_upload(
                entity_type,
                entity_id,
                document_type,
                file_name,
                content_type,
                body,
            )
            storage_path = "/".join((
                ALLOWED_ENTITY_TYPES[entity_type],
                str(uuid.UUID(entity_id)),
                document_type,
                f"{uuid.uuid4()}{details.extension}",
            ))
            target = resolve_storage_path(self.server.storage_root, storage_path)
            target.parent.mkdir(parents=True, exist_ok=True)
            temporary = target.with_name(f".{target.name}.{uuid.uuid4()}.tmp")
            temporary.write_bytes(body)
            temporary.replace(target)
            self.send_json(201, {
                "storagePath": storage_path,
                "fileName": details.safe_original_name,
                "mimeType": content_type,
                "size": len(body),
                "fileUrl": f"/documents/files/{storage_path}",
            })
        except UploadValidationError as error:
            message = str(error)
            status = 413 if "20 MiB" in message else 415 if "MIME" in message or "signature" in message or "extension" in message else 400
            self.send_json_error(status, message)
        except (PathValidationError, ValueError) as error:
            self.send_json_error(400, str(error))
        except OSError:
            self.send_json_error(500, "Document could not be stored.")

    def do_GET(self):
        storage_path = self.requested_storage_path()
        if storage_path is None:
            return
        try:
            target = resolve_storage_path(self.server.storage_root, storage_path)
        except PathValidationError as error:
            self.send_json_error(400, str(error))
            return
        if not target.is_file():
            self.send_json_error(404, "Document not found.")
            return
        try:
            size = target.stat().st_size
            content_type = EXTENSION_MIME_TYPES.get(target.suffix.lower(), "application/octet-stream")
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(size))
            self.send_header("Content-Disposition", f'inline; filename="{target.name}"')
            self.send_header("X-Content-Type-Options", "nosniff")
            self.end_headers()
            with target.open("rb") as document:
                while chunk := document.read(64 * 1024):
                    self.wfile.write(chunk)
        except OSError:
            self.send_json_error(500, "Document could not be read.")

    def do_DELETE(self):
        storage_path = self.requested_storage_path()
        if storage_path is None:
            return
        try:
            target = resolve_storage_path(self.server.storage_root, storage_path)
        except PathValidationError as error:
            self.send_json_error(400, str(error))
            return
        if not target.is_file():
            self.send_json_error(404, "Document not found.")
            return
        try:
            target.unlink()
            self.send_response(204)
            self.end_headers()
        except OSError:
            self.send_json_error(500, "Document could not be deleted.")

    def content_length(self):
        value = self.headers.get("Content-Length", "")
        try:
            length = int(value)
        except ValueError as error:
            raise UploadValidationError("Content-Length must be numeric.") from error
        if length <= 0:
            raise UploadValidationError("Content-Length must be positive.")
        return length

    def requested_storage_path(self):
        prefix = "/documents/files/"
        path = urlsplit(self.path).path
        if not path.startswith(prefix) or len(path) <= len(prefix):
            self.send_json_error(404, "Document endpoint not found.")
            return None
        return unquote(path[len(prefix):])

    def send_json_error(self, status, message):
        self.send_json(status, {"error": message})

    def send_json(self, status, payload):
        body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)


def create_server(host, port, storage_root):
    server = ThreadingHTTPServer((host, port), DocumentHandler)
    server.storage_root = Path(storage_root).resolve()
    server.storage_root.mkdir(parents=True, exist_ok=True)
    return server


def main():
    host = os.environ.get("TMS_DOCUMENT_HOST", "127.0.0.1")
    port = int(os.environ.get("TMS_DOCUMENT_PORT", "3101"))
    storage_root = Path(os.environ.get("TMS_DOCUMENT_ROOT", "/var/lib/tms/documents"))
    create_server(host, port, storage_root).serve_forever()


if __name__ == "__main__":
    main()
