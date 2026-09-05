import { createHash, randomUUID } from "node:crypto";

const PREFIX = "/api/collab";
const NOTE_TAGS = new Set(["b", "i", "em", "strong", "u", "ul", "ol", "li", "br", "p", "div"]);
const ID = /^[a-z0-9]{1,32}$/;
const TOKEN = /^[0-9a-f]{64}$/;
const PNG = "data:image/png;base64,";
const PNG_MAX = 2900000;

const sha256 = (s) => createHash("sha256").update(s, "utf8").digest("hex");
const defaultMint = () => randomUUID().replace(/-/g, "").slice(0, 16);
const defaultNow = () => new Date().toISOString();

const json = (status, body) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
});
const bad = (msg) => json(400, { error: msg });

export function sanitizeNote(html) {
  const s = String(html || "").replace(/<!--[\s\S]*?-->/g, "");
  return s.replace(/<\/?([a-zA-Z0-9]+)[^>]*>/g, (m, tag) => {
    const t = tag.toLowerCase();
    if (!NOTE_TAGS.has(t)) return "";
    return m.startsWith("</") ? `</${t}>` : `<${t}>`;
  });
}

export function noteText(html) {
  return String(html || "")
    .replace(/<\/(p|div|li)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const str = (v, max) => typeof v === "string" && v.length > 0 && v.length <= max ? v : null;
const optStr = (v, max) => v == null ? "" : (typeof v === "string" && v.length <= max ? v : null);

function validSpan(s) {
  if (!s || typeof s !== "object") return null;
  if (s.kind !== "block" && s.kind !== "note") return null;
  const target = str(s.target, 64);
  const quote = optStr(s.quote, 2000);
  if (!target || quote === null) return null;
  if (!Number.isInteger(s.start) || !Number.isInteger(s.end) || s.start < 0 || s.end < s.start) return null;
  return { kind: s.kind, target, start: s.start, end: s.end, quote };
}

function validGames(g) {
  if (!Array.isArray(g) || g.length < 1 || g.length > 9) return null;
  const out = [];
  for (const k of g) {
    const v = str(k, 8);
    if (!v || !/^[A-Z0-9]+$/.test(v) || out.includes(v)) return null;
    out.push(v);
  }
  return out;
}

const squash = (s) => String(s || "").replace(/\s+/g, " ").trim();

export function scriptMarkdown(idea, blocks, pins) {
  const out = [`# ${idea.name}`, ""];
  for (const b of blocks) {
    if (b.text.trim()) out.push(b.text.trim(), "");
  }
  if (pins.length) {
    out.push("## Pinned items", "");
    for (const p of pins) {
      const hasJP = p.jp && p.realm !== "D2";
      if (hasJP) {
        out.push(`> **${squash(p.jp)}**`, `> ${squash(p.name)}`, "");
        if (p.jpFlavor && p.flavor) out.push(`> **${squash(p.jpFlavor)}**`, `> ${squash(p.flavor)}`, "");
      } else {
        out.push(`${p.name} (${p.realm}, English only)`, "");
        if (p.flavor) out.push(`> ${squash(p.flavor)}`, "");
      }
    }
  }
  return out.join("\n");
}

export function createHandler({ store, users, mint = defaultMint, now = defaultNow }) {
  const key = (...p) => p.join("/");
  const readJSON = async (k) => { const t = await store.get(k); return t == null ? null : JSON.parse(t); };
  const writeJSON = (k, v) => store.set(k, JSON.stringify(v));

  async function touch(id, user) {
    const m = await readJSON(key("idea", id, "meta"));
    if (!m) return null;
    m.editedBy = user;
    m.editedAt = now();
    await writeJSON(key("idea", id, "meta"), m);
    return m;
  }

  async function loadIdea(id) {
    const meta = await readJSON(key("idea", id, "meta"));
    if (!meta) return null;
    const keys = await store.list(key("idea", id) + "/");
    const docs = await Promise.all(keys.map(async (k) => [k, await readJSON(k)]));
    const out = { meta, notes: [], blocks: [], comments: [], drawings: [], pins: [] };
    for (const [k, d] of docs) {
      if (!d) continue;
      const kind = k.slice(key("idea", id).length + 1).split("/")[0];
      if (kind === "note") out.notes.push(d);
      else if (kind === "block") out.blocks.push(d);
      else if (kind === "comment") out.comments.push(d);
      else if (kind === "pin") out.pins.push(d);
      else if (kind === "drawing") { const { png, ...rest } = d; out.drawings.push(rest); }
    }
    const byAt = (a, b) => a.at < b.at ? -1 : a.at > b.at ? 1 : 0;
    out.blocks.sort((a, b) => a.pos - b.pos || byAt(a, b));
    out.notes.sort(byAt);
    out.comments.sort(byAt);
    out.drawings.sort(byAt);
    out.pins.sort(byAt);
    return out;
  }

  async function ownedDelete(id, kind, rid, user) {
    if (!ID.test(rid)) return bad("bad id");
    const k = key("idea", id, kind, rid);
    const d = await readJSON(k);
    if (!d) return json(404, { error: "gone already" });
    if (d.by !== user) return json(403, { error: "not yours" });
    await store.del(k);
    await touch(id, user);
    return json(200, { ok: true });
  }

  return async function handle(req) {
    const url = new URL(req.url);
    let path = url.pathname;
    if (path.startsWith(PREFIX)) path = path.slice(PREFIX.length);
    const seg = path.split("/").filter(Boolean);
    const method = req.method.toUpperCase();
    const auth = req.headers.get("authorization") || "";
    const tok = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    const user = TOKEN.test(tok) ? users[sha256(tok)] : undefined;
    if (!user) return json(401, { error: "not in the room" });

    let body = null;
    if (method === "POST" || method === "PUT" || method === "PATCH") {
      try { body = await req.json(); } catch { return bad("bad json"); }
      if (!body || typeof body !== "object") return bad("bad json");
    }

    if (seg.length === 1 && seg[0] === "me" && method === "GET") return json(200, { user });

    if (seg[0] !== "ideas") return json(404, { error: "no such door" });

    if (seg.length === 1) {
      if (method === "GET") {
        const keys = (await store.list("idea/")).filter((k) => k.endsWith("/meta"));
        const metas = (await Promise.all(keys.map(readJSON))).filter(Boolean);
        metas.sort((a, b) => a.editedAt < b.editedAt ? 1 : a.editedAt > b.editedAt ? -1 : 0);
        return json(200, { ideas: metas });
      }
      if (method === "POST") {
        const name = str(body.name, 120);
        const games = validGames(body.games);
        if (!name) return bad("an idea needs a name");
        if (!games) return bad("pick at least one game");
        const id = mint();
        const at = now();
        const meta = { id, name, games, primary: games[0], by: user, at, editedBy: user, editedAt: at };
        await writeJSON(key("idea", id, "meta"), meta);
        return json(201, meta);
      }
      return json(405, { error: "not that way" });
    }

    const id = seg[1];
    if (!ID.test(id)) return bad("bad id");
    const metaKey = key("idea", id, "meta");

    if (seg.length === 2) {
      if (method === "GET") {
        const idea = await loadIdea(id);
        return idea ? json(200, idea) : json(404, { error: "no such idea" });
      }
      if (method === "PATCH") {
        const meta = await readJSON(metaKey);
        if (!meta) return json(404, { error: "no such idea" });
        if (meta.by !== user) return json(403, { error: "not yours" });
        if (body.name !== undefined) { const n = str(body.name, 120); if (!n) return bad("an idea needs a name"); meta.name = n; }
        if (body.games !== undefined) { const g = validGames(body.games); if (!g) return bad("pick at least one game"); meta.games = g; meta.primary = g[0]; }
        meta.editedBy = user; meta.editedAt = now();
        await writeJSON(metaKey, meta);
        return json(200, meta);
      }
      if (method === "DELETE") {
        const meta = await readJSON(metaKey);
        if (!meta) return json(404, { error: "no such idea" });
        if (meta.by !== user) return json(403, { error: "not yours" });
        const keys = await store.list(key("idea", id) + "/");
        for (const k of keys) await store.del(k);
        return json(200, { ok: true, removed: keys.length });
      }
      return json(405, { error: "not that way" });
    }

    const kind = seg[2];
    const rid = seg[3];
    const exists = await readJSON(metaKey);
    if (!exists) return json(404, { error: "no such idea" });

    if (kind === "note" && seg.length === 3 && method === "PUT") {
      const html = sanitizeNote(optStr(body.html, 60000));
      if (body.html != null && html === null) return bad("note too long");
      const d = { ideaId: id, by: user, html, at: now() };
      await writeJSON(key("idea", id, "note", user), d);
      await touch(id, user);
      return json(200, d);
    }

    if (kind === "blocks" && seg.length === 4) {
      if (!ID.test(rid)) return bad("bad id");
      const k = key("idea", id, "block", rid);
      if (method === "PUT") {
        const text = optStr(body.text, 20000);
        const pos = typeof body.pos === "number" && Number.isFinite(body.pos) ? body.pos : null;
        if (text === null) return bad("block too long");
        if (pos === null) return bad("a block needs a position");
        const prev = await readJSON(k);
        if (prev && prev.by !== user) return json(403, { error: "not yours" });
        const d = { id: rid, ideaId: id, by: user, pos, text, at: now() };
        await writeJSON(k, d);
        await touch(id, user);
        return json(200, d);
      }
      if (method === "DELETE") return ownedDelete(id, "block", rid, user);
      return json(405, { error: "not that way" });
    }

    if (kind === "comments") {
      if (seg.length === 3 && method === "POST") {
        const text = str(body.text, 4000);
        const span = validSpan(body.span);
        if (!text) return bad("a comment needs words");
        if (!span) return bad("a comment needs a span");
        const d = { id: mint(), ideaId: id, by: user, at: now(), text, span };
        await writeJSON(key("idea", id, "comment", d.id), d);
        await touch(id, user);
        return json(201, d);
      }
      if (seg.length === 4 && method === "DELETE") return ownedDelete(id, "comment", rid, user);
      return json(405, { error: "not that way" });
    }

    if (kind === "drawings") {
      if (seg.length === 3 && method === "POST") {
        const png = typeof body.png === "string" && body.png.startsWith(PNG) && body.png.length <= PNG_MAX ? body.png : null;
        if (!png) return bad("a drawing must be a png under two megabytes");
        let attach = null;
        if (body.attach && body.attach.kind === "idea") attach = { kind: "idea" };
        else if (body.attach && body.attach.kind === "span") { const s = validSpan(body.attach.span); if (s) attach = { kind: "span", span: s }; }
        if (!attach) return bad("a drawing attaches to a line or to the whole video");
        const d = { id: mint(), ideaId: id, by: user, at: now(), attach, png };
        await writeJSON(key("idea", id, "drawing", d.id), d);
        await touch(id, user);
        const { png: _p, ...rest } = d;
        return json(201, rest);
      }
      if (seg.length === 4 && method === "GET") {
        if (!ID.test(rid)) return bad("bad id");
        const d = await readJSON(key("idea", id, "drawing", rid));
        return d ? json(200, d) : json(404, { error: "no such drawing" });
      }
      if (seg.length === 4 && method === "DELETE") return ownedDelete(id, "drawing", rid, user);
      return json(405, { error: "not that way" });
    }

    if (kind === "pins") {
      if (seg.length === 3 && method === "POST") {
        const realm = str(body.realm, 8);
        const name = str(body.name, 200);
        const jp = optStr(body.jp, 200);
        const category = optStr(body.category, 80);
        const flavor = optStr(body.flavor, 6000);
        const jpFlavor = optStr(body.jpFlavor, 6000);
        const slug = optStr(body.slug, 200);
        if (!realm || !name || jp === null || category === null || flavor === null || jpFlavor === null || slug === null) return bad("a pin needs a realm and a name");
        const span = body.span ? validSpan(body.span) : null;
        const d = { id: mint(), ideaId: id, by: user, at: now(), realm, name, jp, category, flavor, jpFlavor, slug, span };
        await writeJSON(key("idea", id, "pin", d.id), d);
        await touch(id, user);
        return json(201, d);
      }
      if (seg.length === 4 && method === "DELETE") return ownedDelete(id, "pin", rid, user);
      return json(405, { error: "not that way" });
    }

    if (kind === "export" && seg.length === 3 && method === "GET") {
      const idea = await loadIdea(id);
      const notes = idea.notes.map((n) => ({ ...n, text: noteText(n.html) }));
      return json(200, {
        format: "collab-export/1",
        exportedAt: now(),
        exportedBy: user,
        idea: idea.meta,
        notes,
        script: idea.blocks,
        comments: idea.comments,
        drawings: idea.drawings,
        pins: idea.pins,
        scriptMarkdown: scriptMarkdown(idea.meta, idea.blocks, idea.pins),
      });
    }

    return json(404, { error: "no such door" });
  };
}
