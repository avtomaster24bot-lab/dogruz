// ВЕЗУ: значок «Проверен». Водитель отправляет из кабинета фото машины, госномер и селфи;
// админ одобряет или отклоняет в admin.html. Фото лежат в ЗАКРЫТОМ bucket vz_verify (public = false),
// админ видит их по подписанной ссылке на 10 минут. После решения заявка и оба фото удаляются —
// на визитке остаются только дата проверки (verified_at) или причина отказа (verify_note).
// POST { key, plate, car: "data:image/jpeg;base64,...", selfie: "data:image/jpeg;base64,..." } → { state: "pending" }
// POST { key, cancel: true }                     → { state: "none" }   (отозвать заявку, фото удаляются)
// POST { admin, list: true }                     → { items: [...] }    (+ удаляет «осиротевшие» файлы)
// POST { admin, card, decide: "ok"|"no", note? } → { ok: true }        (заявка и фото удаляются)
// POST { admin, card, revoke: true }             → { ok: true }        (снять значок)
import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED = (Deno.env.get("VZ_ALLOWED_ORIGINS") ?? "https://avtomaster24bot-lab.github.io").split(",").map((s) => s.trim());
const MAX = 400 * 1024, B = "vz_verify";

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
function jpeg(s: unknown): Uint8Array | null {
  const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String(s ?? ""));
  if (!m) return null;
  const bin = atob(m[1]); const a = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
  return a.length > 1000 && a.length <= MAX && a[0] === 0xff && a[1] === 0xd8 ? a : null;
}
const UUID = /^[0-9a-f-]{36}$/;

Deno.serve(async (req) => {
  const h = cors(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: h });
  if (req.method !== "POST") return json({ error: "method" }, 405, h);
  // deno-lint-ignore no-explicit-any
  let body: any;
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400, h); }
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const wipe = async (id: string) => {       // удалить заявку и все файлы визитки в bucket
    const { data: files } = await db.storage.from(B).list(id);
    const paths = (files ?? []).map((f) => `${id}/${f.name}`);
    if (paths.length) await db.storage.from(B).remove(paths);
    await db.from("vz_verify_req").delete().eq("card_id", id);
  };

  if (body.admin !== undefined) {
    const ak = String(body.admin);
    if (!/^[A-Za-z0-9_-]{32,64}$/.test(ak)) return json({ error: "bad_key" }, 400, h);
    const { data: adm } = await db.from("vz_admins").select("key_hash").eq("key_hash", await sha256hex(ak)).maybeSingle();
    if (!adm) return json({ error: "forbidden" }, 403, h);
    if (body.list) {
      const { data: rows, error } = await db.from("vz_verify_req").select("card_id, plate, car_path, selfie_path, created_at, vz_cards(slug, phone, city, data, photo_path, verified_at)").order("created_at");
      if (error) { console.error("list", error); return json({ error: "db" }, 500, h); }
      // файлы без заявки (визитка удалена, заявка истекла) — удалить
      const live = new Set((rows ?? []).map((r) => r.card_id));
      const { data: dirs } = await db.storage.from(B).list("", { limit: 1000 });
      for (const d of (dirs ?? []).filter((d) => UUID.test(d.name) && !live.has(d.name))) await wipe(d.name);
      const items = [];
      for (const r of rows ?? []) {
        const { data: s } = await db.storage.from(B).createSignedUrls([r.car_path, r.selfie_path], 600);
        // deno-lint-ignore no-explicit-any
        const c: any = r.vz_cards ?? {};
        items.push({ card: r.card_id, plate: r.plate, at: r.created_at, slug: c.slug, p: c.phone, city: c.city, n: c.data?.n, car: c.data?.c,
          photo: c.photo_path, car_url: s?.[0]?.signedUrl ?? null, selfie_url: s?.[1]?.signedUrl ?? null });
      }
      return json({ items }, 200, h);
    }
    const card = String(body.card ?? "");
    if (!UUID.test(card)) return json({ error: "bad_request" }, 400, h);
    if (body.revoke) {
      await db.from("vz_cards").update({ verified_at: null }).eq("id", card);
      return json({ ok: true }, 200, h);
    }
    if (body.decide === "ok" || body.decide === "no") {
      const note = String(body.note ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 200);
      const upd = body.decide === "ok" ? { verified_at: new Date().toISOString(), verify_note: "" }
        : { verify_note: note || "Фото не подошли — отправьте ещё раз" };
      const { error } = await db.from("vz_cards").update(upd).eq("id", card);
      if (error) { console.error("decide", error); return json({ error: "db" }, 500, h); }
      await wipe(card);
      return json({ ok: true }, 200, h);
    }
    return json({ error: "bad_request" }, 400, h);
  }

  const key = String(body.key ?? "");
  if (!/^[A-Za-z0-9_-]{32,64}$/.test(key)) return json({ error: "bad_key" }, 400, h);
  const { data: card, error } = await db.from("vz_cards").select("id, is_blocked, verified_at").eq("key_hash", await sha256hex(key)).maybeSingle();
  if (error) { console.error("select", error); return json({ error: "db" }, 500, h); }
  if (!card) return json({ error: "no_card" }, 404, h);
  if (body.cancel) { await wipe(card.id); return json({ state: "none" }, 200, h); }
  if (card.is_blocked) return json({ error: "blocked" }, 403, h);
  if (card.verified_at) return json({ error: "already" }, 409, h);
  const plate = String(body.plate ?? "").toUpperCase().replace(/[^A-Z0-9А-Я]/g, "")
    .replace(/[АВЕКМНОРСТХУ]/g, (ch) => ({ А: "A", В: "B", Е: "E", К: "K", М: "M", Н: "H", О: "O", Р: "P", С: "C", Т: "T", Х: "X", У: "Y" } as Record<string, string>)[ch]);
  if (!/^[A-Z0-9]{4,10}$/.test(plate)) return json({ error: "bad_plate" }, 400, h);
  const car = jpeg(body.car), selfie = jpeg(body.selfie);
  if (!car || !selfie) return json({ error: "bad_image" }, 400, h);
  await wipe(card.id);
  const ts = Date.now(), cp = `${card.id}/car${ts}.jpg`, sp = `${card.id}/selfie${ts}.jpg`;
  for (const [p, b] of [[cp, car], [sp, selfie]] as [string, Uint8Array][]) {
    const up = await db.storage.from(B).upload(p, b, { contentType: "image/jpeg", upsert: false });
    if (up.error) { console.error("upload", up.error); await wipe(card.id); return json({ error: "upload" }, 500, h); }
  }
  const { error: ie } = await db.from("vz_verify_req").insert({ card_id: card.id, plate, car_path: cp, selfie_path: sp });
  if (ie) { console.error("insert", ie); await wipe(card.id); return json({ error: "db" }, 500, h); }
  await db.from("vz_cards").update({ verify_note: "" }).eq("id", card.id);
  return json({ state: "pending" }, 200, h);
});
