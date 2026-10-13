import assert from "node:assert/strict";
import test from "node:test";
import { request } from "../src/services/api.js";

test("API sends JSON to the local origin and forwards cancellation", async () => {
  const original = globalThis.fetch;
  const controller = new AbortController();
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "/api/v1/connection");
    assert.equal(options.headers["Content-Type"], "application/json");
    assert.equal(options.signal, controller.signal);
    assert.equal(options.credentials, "same-origin");
    assert.deepEqual(JSON.parse(options.body), { provider: "gemini" });
    return new Response(JSON.stringify({ connected: true }), { headers: { "Content-Type": "application/json" } });
  };
  try {
    assert.deepEqual(await request("/connection", { method: "PUT", body: { provider: "gemini" }, signal: controller.signal }), { connected: true });
  } finally { globalThis.fetch = original; }
});

test("ZIP uploads let the browser supply the multipart boundary", async () => {
  const original = globalThis.fetch;
  const form = new FormData();
  globalThis.fetch = async (_url, options) => {
    assert.equal(options.body, form);
    assert.equal(options.headers["Content-Type"], undefined);
    return new Response(JSON.stringify({ project_id: "id" }), { headers: { "Content-Type": "application/json" } });
  };
  try { assert.equal((await request("/projects/upload-zip", { method: "POST", body: form })).project_id, "id"); }
  finally { globalThis.fetch = original; }
});

test("server errors are actionable and do not expose an unexpected response body", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({ detail: "Choose a model." }), { status: 400, headers: { "Content-Type": "application/json" } });
    await assert.rejects(request("/connection"), /Choose a model/);
    globalThis.fetch = async () => new Response("private server output", { status: 500 });
    await assert.rejects(request("/connection"), (error) => error.message.includes("500") && !error.message.includes("private"));
  } finally { globalThis.fetch = original; }
});

test("Markdown downloads remain plain text", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response("# Demo\n", { headers: { "Content-Type": "text/plain" } });
  try { assert.equal(await request("/projects/id/readme"), "# Demo\n"); }
  finally { globalThis.fetch = original; }
});
