import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const clientPath = new URL("../scripts/tms-api.js", import.meta.url);

async function loadClient(fetchImpl, config = {}) {
  const source = await readFile(clientPath, "utf8");
  const window = { TMS_CONFIG: config };
  vm.runInNewContext(source, {
    URL,
    console,
    fetch: fetchImpl,
    window,
  }, { filename: clientPath.pathname });
  return window.TmsApi;
}

function response(status, body, statusText = "") {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    text: async () => body,
  };
}

test("builds a same-origin PostgREST request without auth headers", async () => {
  const calls = [];
  const api = await loadClient(async (url, options) => {
    calls.push({ url, options });
    return response(200, "[]");
  });

  await api.request("appointments?select=isa&limit=1");

  assert.equal(calls[0].url, "/rest/v1/appointments?select=isa&limit=1");
  assert.equal(calls[0].options.credentials, "same-origin");
  assert.equal(calls[0].options.headers.Authorization, undefined);
  assert.equal(calls[0].options.headers.apikey, undefined);
});

test("adds a configured generic API token", async () => {
  const calls = [];
  const api = await loadClient(async (url, options) => {
    calls.push({ url, options });
    return response(200, "[]");
  }, { apiBaseUrl: "http://127.0.0.1:3000/", apiToken: "public-token" });

  await api.request("appointments?limit=1");

  assert.equal(calls[0].url, "http://127.0.0.1:3000/rest/v1/appointments?limit=1");
  assert.equal(calls[0].options.headers.apikey, "public-token");
  assert.equal(calls[0].options.headers.Authorization, "Bearer public-token");
});

test("parses JSON and treats an empty response as an empty array", async () => {
  const responses = [response(200, '[{"isa":"A1"}]'), response(204, "")];
  const api = await loadClient(async () => responses.shift());

  assert.equal(JSON.stringify(await api.request("appointments?limit=1")), '[{"isa":"A1"}]');
  assert.equal(JSON.stringify(await api.request("appointments?limit=0")), "[]");
});

test("reports the HTTP status and backend message", async () => {
  const api = await loadClient(async () => response(400, "invalid query", "Bad Request"));

  await assert.rejects(
    api.request("appointments?broken"),
    /TMS API request failed \(400 Bad Request\): invalid query/,
  );
});

test("uploads a document with metadata headers", async () => {
  const calls = [];
  const uploaded = {
    storagePath: "trip-plans/11111111-1111-4111-8111-111111111111/pod/file.pdf",
    fileName: "proof one.pdf",
    mimeType: "application/pdf",
    size: 12,
    fileUrl: "/documents/files/trip-plans/11111111-1111-4111-8111-111111111111/pod/file.pdf",
  };
  const api = await loadClient(async (url, options) => {
    calls.push({ url, options });
    return response(201, JSON.stringify(uploaded));
  });
  const file = { name: "proof one.pdf", type: "application/pdf", size: 12 };

  const result = await api.uploadDocument({
    entityType: "trip_plan",
    entityId: "11111111-1111-4111-8111-111111111111",
    documentType: "pod",
    file,
  });

  assert.equal(calls[0].url, "/documents/files");
  assert.equal(calls[0].options.method, "PUT");
  assert.equal(calls[0].options.body, file);
  assert.equal(calls[0].options.headers["Content-Type"], "application/pdf");
  assert.equal(calls[0].options.headers["X-TMS-Entity-Type"], "trip_plan");
  assert.equal(calls[0].options.headers["X-TMS-Entity-Id"], "11111111-1111-4111-8111-111111111111");
  assert.equal(calls[0].options.headers["X-TMS-Document-Type"], "pod");
  assert.equal(calls[0].options.headers["X-TMS-File-Name"], "proof%20one.pdf");
  assert.equal(JSON.stringify(result), JSON.stringify(uploaded));
});

test("deletes a newly uploaded document by encoded storage path", async () => {
  const calls = [];
  const api = await loadClient(async (url, options) => {
    calls.push({ url, options });
    return response(204, "");
  });

  await api.deleteDocument("trip-plans/a plan/pod/proof one.pdf");

  assert.equal(calls[0].url, "/documents/files/trip-plans/a%20plan/pod/proof%20one.pdf");
  assert.equal(calls[0].options.method, "DELETE");
});

export { loadClient, response };
