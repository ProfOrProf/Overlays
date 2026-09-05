import { getStore } from "./lib/blobs.mjs";

export function createBlobStore(name = "collab") {
  const s = getStore({ name, consistency: "strong" });
  return {
    get: (k) => s.get(k, { type: "text" }),
    set: (k, v) => s.set(k, v).then(() => undefined),
    del: (k) => s.delete(k),
    list: (prefix) => s.list({ prefix }).then((r) => r.blobs.map((b) => b.key)),
  };
}
