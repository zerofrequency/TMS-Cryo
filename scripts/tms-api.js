(function initializeTmsApi(global) {
  "use strict";

  let config = normalizeConfig(global.TMS_CONFIG || {});

  function configure(nextConfig = {}) {
    config = normalizeConfig(nextConfig);
    return { ...config };
  }

  function isConfigured() {
    return true;
  }

  async function request(path, options = {}) {
    const response = await fetch(`${config.apiBaseUrl}/rest/v1/${stripLeadingSlashes(path)}`, {
      ...options,
      credentials: "same-origin",
      headers: buildApiHeaders(options.headers || {}),
    });
    return parseResponse(response, "TMS API request");
  }

  async function uploadDocument({ entityType, entityId, documentType, file }) {
    if (!file) throw new Error("A document file is required.");
    const response = await fetch(`${config.documentBaseUrl}/files`, {
      method: "PUT",
      credentials: "same-origin",
      headers: {
        "Content-Type": file.type || "application/octet-stream",
        "X-TMS-Entity-Type": clean(entityType),
        "X-TMS-Entity-Id": clean(entityId),
        "X-TMS-Document-Type": clean(documentType),
        "X-TMS-File-Name": encodeURIComponent(clean(file.name)),
      },
      body: file,
    });
    const metadata = await parseResponse(response, "Document upload");
    if (!metadata || !metadata.storagePath || !metadata.fileUrl) {
      throw new Error("Document upload returned incomplete metadata.");
    }
    return metadata;
  }

  async function deleteDocument(storagePath) {
    const response = await fetch(documentUrl(storagePath), {
      method: "DELETE",
      credentials: "same-origin",
    });
    return parseResponse(response, "Document delete");
  }

  function documentUrl(storagePath) {
    const encodedPath = clean(storagePath)
      .split("/")
      .filter(Boolean)
      .map((part) => encodeURIComponent(part))
      .join("/");
    return `${config.documentBaseUrl}/files/${encodedPath}`;
  }

  function buildApiHeaders(extraHeaders) {
    const headers = {
      "Content-Type": "application/json",
      ...extraHeaders,
    };
    if (config.apiToken) {
      headers.apikey = config.apiToken;
      headers.Authorization = `Bearer ${config.apiToken}`;
    }
    return headers;
  }

  async function parseResponse(response, action) {
    const text = response.status === 204 ? "" : await response.text();
    if (!response.ok) {
      const status = `${response.status}${response.statusText ? ` ${response.statusText}` : ""}`;
      throw new Error(`${action} failed (${status})${text ? `: ${text}` : ""}`);
    }
    return text ? JSON.parse(text) : [];
  }

  function normalizeConfig(value) {
    return {
      apiBaseUrl: trimTrailingSlashes(value.apiBaseUrl),
      apiToken: clean(value.apiToken),
      documentBaseUrl: trimTrailingSlashes(value.documentBaseUrl || "/documents") || "/documents",
    };
  }

  function trimTrailingSlashes(value) {
    return clean(value).replace(/\/+$/, "");
  }

  function stripLeadingSlashes(value) {
    return clean(value).replace(/^\/+/, "");
  }

  function clean(value) {
    return String(value == null ? "" : value).trim();
  }

  global.TmsApi = Object.freeze({
    configure,
    isConfigured,
    request,
    uploadDocument,
    deleteDocument,
    documentUrl,
  });
})(window);
