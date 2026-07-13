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

export { loadClient, response };
