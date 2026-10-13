/** Same-origin API requests; credentials never enter browser storage. */
const BASE_URL = import.meta.env?.VITE_API_BASE_URL || "";

export async function request(path, { method = "GET", body, signal } = {}) {
  const isForm = body instanceof FormData;
  const response = await fetch(`${BASE_URL}/api/v1${path}`, {
    method,
    headers: {
      Accept: "application/json, text/plain",
      ...(body && !isForm ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? isForm ? body : JSON.stringify(body) : undefined,
    signal,
    credentials: "same-origin",
  });
  const json = response.headers.get("content-type")?.includes("application/json");
  const result = response.status === 204 ? null : json ? await response.json() : await response.text();
  if (!response.ok) {
    throw new Error(typeof result?.detail === "string" ? result.detail : `The request failed (${response.status}).`);
  }
  return result;
}
