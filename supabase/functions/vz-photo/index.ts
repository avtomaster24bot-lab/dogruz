// ВЕЗУ Про: загрузка фото водителя в Storage (bucket vz_photos).
// Клиент не входит в Supabase Auth, поэтому пишет не сам, а через эту функцию:
// она проверяет ключ доступа визитки (в базе — только его SHA-256) и активный Про,
// и загружает файл с правами service_role (ключ есть только в окружении функции, не в репозитории).
// POST { key, image: "data:image/webp;base64,...", og?: "data:image/jpeg;base64,..." } → { photo: "<card id>/p123.webp", og }
//   og — JPEG-копия для превью ссылок в WhatsApp/Telegram (они не всегда показывают WebP).
// POST { key, remove: true }                          → { photo: null }
// Админ (ключ админа): { admin, card, remove: true } — удалить фото визитки; { admin, purge: true } — удалить фото без визиток.
import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED = (Deno.env.get("VZ_ALLOWED_ORIGINS") ?? "https://avtomaster24bot-lab.github.io").split(",").map((s) => s.trim());
const MAX = 200 * 1024;

function cors(origin: string | null): Record<string, string> {
  const ok = origin && (ALLOWED.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin));
  return {
    "Access-Control-Allow-Origin": ok ? origin! : ALLOWED[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Vary": "Origin",
  };
}
const json = (b: unknown, status: number, h: Record<string, string>) =>
  new Response(JSON.stringify(b), { status, headers: { ...h, "Content-Type": "application/json" } });

async function sha256hex(s: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function b64bytes(b64: string) {
  const bin = atob(b64); const a = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
  return a;
}

Deno.serve(async (req) => {
  const h = cors(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: h });
  if (req.method !== "POST") return json({ error: "method" }, 405, h);
  let body: { key?: string; image?: string; og?: string; remove?: boolean; admin?: string; card?: string; purge?: boolean };
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400, h); }
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  if (body.admin !== undefined) {
    const ak = String(body.admin);
    if (!/^[A-Za-z0-9_-]{32,64}$/.test(ak)) return json({ error: "bad_key" }, 400, h);
    const { data: adm } = await db.from("vz_admins").select("key_hash").eq("key_hash", await sha256hex(ak)).maybeSingle();
    if (!adm) return json({ error: "forbidden" }, 403, h);
    if (body.purge) {
      const { data: dirs } = await db.storage.from("vz_photos").list("", { limit: 1000 });
      const ids = (dirs ?? []).map((d) => d.name).filter((n) => /^[0-9a-f-]{36}$/.test(n));
      const { data: alive } = ids.length ? await db.from("vz_cards").select("id").in("id", ids) : { data: [] };
      const keep = new Set((alive ?? []).map((r) => r.id));
      let removed = 0;
      for (const id of ids.filter((i) => !keep.has(i))) {
        const { data: files } = await db.storage.from("vz_photos").list(id);
        const paths = (files ?? []).map((f) => `${id}/${f.name}`);
        if (paths.length) { await db.storage.from("vz_photos").remove(paths); removed += paths.length; }
      }
      return json({ removed }, 200, h);
    }
    if (body.remove && /^[0-9a-f-]{36}$/.test(String(body.card))) {
      const { data: files } = await db.storage.from("vz_photos").list(String(body.card));
      const paths = (files ?? []).map((f) => `${body.card}/${f.name}`);
      if (paths.length) await db.storage.from("vz_photos").remove(paths);
      await db.from("vz_cards").update({ photo_path: null, photo_og: null }).eq("id", body.card);
      return json({ photo: null, removed: paths.length }, 200, h);
    }
    return json({ error: "bad_request" }, 400, h);
  }

  const key = String(body.key ?? "");
  if (!/^[A-Za-z0-9_-]{32,64}$/.test(key)) return json({ error: "bad_key" }, 400, h);
  const { data: card, error } = await db.from("vz_cards").select("id, pro_until, is_blocked")
    .eq("key_hash", await sha256hex(key)).maybeSingle();
  if (error) { console.error("select", error); return json({ error: "db" }, 500, h); }
  if (!card) return json({ error: "no_card" }, 404, h);
  // удалить все файлы визитки, кроме keep
  const clean = async (keep: string[]) => {
    const { data: files } = await db.storage.from("vz_photos").list(card.id);
    const paths = (files ?? []).map((f) => `${card.id}/${f.name}`).filter((p) => !keep.includes(p));
    if (paths.length) await db.storage.from("vz_photos").remove(paths);
  };

  if (body.remove) {
    await clean([]);
    await db.from("vz_cards").update({ photo_path: null, photo_og: null }).eq("id", card.id);
    return json({ photo: null }, 200, h);
  }
  if (card.is_blocked || !card.pro_until || new Date(card.pro_until) <= new Date()) return json({ error: "not_pro" }, 403, h);

  const m = /^data:image\/(webp|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(String(body.image ?? ""));
  if (!m) return json({ error: "bad_image" }, 400, h);
  const bytes = b64bytes(m[2]);
  if (bytes.length > MAX) return json({ error: "too_big" }, 413, h);
  const isWebp = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[8] === 0x57 && bytes[9] === 0x45;
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
  if ((m[1] === "webp" && !isWebp) || (m[1] === "jpeg" && !isJpeg)) return json({ error: "bad_image" }, 400, h);

  // необязательная JPEG-копия для превью
  let ogBytes: Uint8Array | null = null;
  const om = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String(body.og ?? ""));
  if (om) {
    const b = b64bytes(om[1]);
    if (b.length <= MAX && b[0] === 0xff && b[1] === 0xd8) ogBytes = b;
  }

  const ts = Date.now();
  const path = `${card.id}/p${ts}.${m[1] === "webp" ? "webp" : "jpg"}`;
  const up = await db.storage.from("vz_photos").upload(path, bytes, { contentType: `image/${m[1]}`, cacheControl: "31536000", upsert: false });
  if (up.error) { console.error("upload", up.error); return json({ error: "upload" }, 500, h); }
  let ogPath: string | null = null;
  if (ogBytes) {
    const p2 = `${card.id}/o${ts}.jpg`;
    const u2 = await db.storage.from("vz_photos").upload(p2, ogBytes, { contentType: "image/jpeg", cacheControl: "31536000", upsert: false });
    if (!u2.error) ogPath = p2; else console.error("upload og", u2.error);
  }
  const { error: ue } = await db.from("vz_cards").update({ photo_path: path, photo_og: ogPath }).eq("id", card.id);
  if (ue) { console.error("update", ue); await db.storage.from("vz_photos").remove([path, ...(ogPath ? [ogPath] : [])]); return json({ error: "db" }, 500, h); }
  await clean([path, ...(ogPath ? [ogPath] : [])]);
  return json({ photo: path, og: ogPath }, 200, h);
});
