import importlib.util
import http.client
import json
from pathlib import Path
import tempfile
import threading
import unittest
from urllib.parse import quote


SERVER_PATH = Path(__file__).resolve().parents[1] / "server" / "tms-documents-server.py"


def load_server_module():
    spec = importlib.util.spec_from_file_location("tms_documents_server", SERVER_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class UploadValidationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.module = load_server_module()

    def test_validate_upload_accepts_pdf(self):
        result = self.module.validate_upload(
            entity_type="trip_plan",
            entity_id="11111111-1111-4111-8111-111111111111",
            document_type="pod",
            file_name="proof.pdf",
            content_type="application/pdf",
            body=b"%PDF-1.7\nexample",
        )
        self.assertEqual(result.extension, ".pdf")

    def test_validate_upload_accepts_png_and_jpeg(self):
        png = self.module.validate_upload(
            "trip_plan",
            "11111111-1111-4111-8111-111111111111",
            "pod",
            "proof.png",
            "image/png",
            b"\x89PNG\r\n\x1a\ncontent",
        )
        jpeg = self.module.validate_upload(
            "trip_plan",
            "11111111-1111-4111-8111-111111111111",
            "pod",
            "proof.jpeg",
            "image/jpeg",
            b"\xff\xd8\xffcontent",
        )
        self.assertEqual(png.extension, ".png")
        self.assertEqual(jpeg.extension, ".jpg")

    def test_validate_upload_rejects_invalid_metadata_and_body(self):
        valid = {
            "entity_type": "trip_plan",
            "entity_id": "11111111-1111-4111-8111-111111111111",
            "document_type": "pod",
            "file_name": "proof.pdf",
            "content_type": "application/pdf",
            "body": b"%PDF-1.7\nexample",
        }
        invalid_cases = [
            {"content_type": "text/plain"},
            {"file_name": "proof.png"},
            {"body": b"not-a-pdf"},
            {"entity_id": "not-a-uuid"},
            {"entity_type": "carrier_bill"},
            {"document_type": "invoice"},
            {"body": b"x" * (self.module.MAX_BODY + 1)},
        ]
        for override in invalid_cases:
            with self.subTest(override=override):
                with self.assertRaises(self.module.UploadValidationError):
                    self.module.validate_upload(**{**valid, **override})


class StoragePathTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.module = load_server_module()

    def test_resolve_storage_path_stays_beneath_root(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            resolved = self.module.resolve_storage_path(root, "trip-plans/plan/pod/file.pdf")
            self.assertTrue(resolved.is_relative_to(root.resolve()))

    def test_resolve_storage_path_rejects_traversal(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(self.module.PathValidationError):
                self.module.resolve_storage_path(Path(directory), "../secret")


class DocumentHttpTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.module = load_server_module()

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.server = self.module.create_server("127.0.0.1", 0, Path(self.temp_dir.name))
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.connection = http.client.HTTPConnection(*self.server.server_address, timeout=5)

    def tearDown(self):
        self.connection.close()
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=5)
        self.temp_dir.cleanup()

    def test_upload_download_and_delete_document(self):
        body = b"%PDF-1.7\nproof-content"
        headers = {
            "Content-Type": "application/pdf",
            "Content-Length": str(len(body)),
            "X-TMS-Entity-Type": "trip_plan",
            "X-TMS-Entity-Id": "11111111-1111-4111-8111-111111111111",
            "X-TMS-Document-Type": "pod",
            "X-TMS-File-Name": quote("proof one.pdf"),
        }
        self.connection.request("PUT", "/documents/files", body=body, headers=headers)
        upload_response = self.connection.getresponse()
        metadata = json.loads(upload_response.read())

        self.assertEqual(upload_response.status, 201)
        self.assertEqual(metadata["fileName"], "proof one.pdf")
        self.assertEqual(metadata["mimeType"], "application/pdf")
        self.assertEqual(metadata["size"], len(body))

        self.connection.request("GET", metadata["fileUrl"])
        download_response = self.connection.getresponse()
        downloaded = download_response.read()
        self.assertEqual(download_response.status, 200)
        self.assertEqual(download_response.getheader("X-Content-Type-Options"), "nosniff")
        self.assertEqual(downloaded, body)

        self.connection.request("DELETE", metadata["fileUrl"])
        delete_response = self.connection.getresponse()
        delete_response.read()
        self.assertEqual(delete_response.status, 204)

        self.connection.request("GET", metadata["fileUrl"])
        missing_response = self.connection.getresponse()
        missing_response.read()
        self.assertEqual(missing_response.status, 404)


if __name__ == "__main__":
    unittest.main()
