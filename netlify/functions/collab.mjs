import { createHandler } from "./api.mjs";
import { createBlobStore } from "./store_blobs.mjs";
import users from "../../LoreLibrary/data/collab_users.mjs";

let handle = null;

export default (req) => {
  if (!handle) handle = createHandler({ store: createBlobStore(), users });
  return handle(req);
};

export const config = { path: ["/api/collab", "/api/collab/*"] };
