// ВЕЗУ: Telegram-бот @vezu_orders_bot — уведомления водителям о новых заказах.
// 1) Вебхук Telegram (заголовок X-Telegram-Bot-Api-Secret-Token = vz_tg_webhook_secret):
//    /start <токен из кабинета> — привязать чат к визитке; /stop — отключить (chat_id удаляется).
// 2) Уведомление из базы (pg_net, заголовок x-vz-notify = vz_tg_notify_secret): { order, tier: "pro" | "all" }.
//    Текст без имени и телефона клиента: тип груза, район (без номеров домов), когда, ссылка на ленту.
// Секреты (токен бота и оба секрета) — в Supabase Vault, читаются через public.vz_tg_secrets() (только service_role).
import { createClient } from "npm:@supabase/supabase-js@2";

const SITE = Deno.env.get("VZ_SITE") ?? "https://avtomaster24bot-lab.github.io/dogruz/";
const CARGO: Record<string, string> = { move: "Переезд / мебель", appliance: "Бытовая техника", build: "Стройматериалы", trash: "Вывоз мусора", other: "Другое" };
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

let S: Record<string, string> | null = null, sAt = 0;
async function secrets() {
  if (!S || Date.now() - sAt > 300_000) {
    const { data, error } = await db.rpc("vz_tg_secrets");
    if (error) throw new Error("secrets");
    S = (data ?? {}) as Record<string, string>; sAt = Date.now();
  }
  return S;
}
function eq(a: string, b: string) {   // сравнение без утечки по времени
  if (!a || !b || a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
async function tg(method: string, payload: unknown) {
  const tok = (await secrets()).vz_tg_bot_token;
  if (!tok) return { ok: false, description: "no token" };
  const r = await fetch(`https://api.telegram.org/bot${tok}/${method}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  return await r.json().catch(() => ({ ok: false }));
}
const esc = (s: string) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
const ok = (b: unknown = { ok: true }) => new Response(JSON.stringify(b), { headers: { "Content-Type": "application/json" } });

function orderText(j: Record<string, unknown>) {
  const lines = [j.scope === "picked" ? "🚚 <b>Заказ лично вам</b>" : "🚚 <b>Новый заказ в ленте ВЕЗУ</b>"];
  if (j.cargo && CARGO[j.cargo as string]) lines.push("📦 " + CARGO[j.cargo as string]);
  const route = [j.from, j.to].filter(Boolean).map((x) => esc(String(x))).join(" → ");
  if (route) lines.push("📍 " + route);
  let when = String(j.when ?? "");
  if (j.when_at) when = new Date(String(j.when_at)).toLocaleString("ru-RU", { timeZone: "Asia/Almaty", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
  if (when) lines.push("🕒 " + esc(when));
  if (typeof j.km === "number") lines.push("🛣 ≈ " + j.km + " км");
  if (typeof j.price === "number") lines.push("💰 Цена клиента: " + j.price.toLocaleString("ru-RU") + " ₸");
  lines.push("", "Телефон клиента увидит только водитель, которого клиент выберет. Откликнуться — в ленте:");
  return lines.join("\n");
}

async function notify(order: string, tier: string) {
  const { data, error } = await db.rpc("vz_tg_job", { p_order: order, p_tier: tier });
  if (error || !data) return { sent: 0 };
  const j = data as Record<string, unknown>, chats = (j.chats as number[]) ?? [];
  const text = orderText(j);
  let sent = 0;
  for (const chat of chats) {
    const r = await tg("sendMessage", { chat_id: chat, text, parse_mode: "HTML", disable_web_page_preview: true,
      reply_markup: { inline_keyboard: [[{ text: "Открыть ленту заказов", url: SITE + "app.html#feed" }]] } });
    if (r.ok) sent++;
    else if (r.error_code === 403) await db.rpc("vz_tg_unbind_chat", { p_chat: chat });   // водитель заблокировал бота — забываем chat_id
    await new Promise((res) => setTimeout(res, 40));
  }
  return { sent };
}

async function onUpdate(u: Record<string, any>) {
  const m = u.message; if (!m || !m.chat || m.chat.type !== "private") return;
  const chat = m.chat.id as number, text = String(m.text ?? "").trim();
  const start = text.match(/^\/start(?:\s+([a-f0-9]{32}))?$/i);
  if (start && start[1]) {
    const { data } = await db.rpc("vz_tg_bind", { p_token: start[1].toLowerCase(), p_chat: chat });
    if (data) return tg("sendMessage", { chat_id: chat, parse_mode: "HTML", text: `✅ Готово! Telegram подключён к визитке <b>${esc((data as any).name || "водителя")}</b>.\nНовые заказы из ленты ВЕЗУ будут приходить сюда. Города можно выбрать в кабинете. Отключить — /stop` });
    return tg("sendMessage", { chat_id: chat, text: "Ссылка устарела. Откройте кабинет ВЕЗУ → «Уведомления в Telegram» → «Подключить» ещё раз." });
  }
  if (/^\/stop\b/i.test(text)) {
    const { data } = await db.rpc("vz_tg_unbind_chat", { p_chat: chat });
    return tg("sendMessage", { chat_id: chat, text: data ? "Уведомления отключены, ваш Telegram отвязан от визитки." : "Этот Telegram не был подключён к визитке." });
  }
  return tg("sendMessage", { chat_id: chat, text: "Это бот уведомлений ВЕЗУ для водителей. Подключение — в кабинете визитки: " + SITE + "new.html#pro → «Уведомления в Telegram». Отключить — /stop" });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("ok");
  let s: Record<string, string>;
  try { s = await secrets(); } catch { return new Response("unavailable", { status: 503 }); }
  const hook = req.headers.get("x-telegram-bot-api-secret-token") ?? "", nt = req.headers.get("x-vz-notify") ?? "";
  const body = await req.json().catch(() => null);
  if (!body) return new Response("bad", { status: 400 });
  if (hook && eq(hook, s.vz_tg_webhook_secret ?? "")) { try { await onUpdate(body); } catch (_) { /* Telegram не должен повторять */ } return ok(); }
  if (nt && eq(nt, s.vz_tg_notify_secret ?? "")) {
    if (!/^[0-9a-f-]{36}$/.test(String(body.order ?? "")) || !["pro", "all"].includes(body.tier)) return new Response("bad", { status: 400 });
    return ok(await notify(body.order, body.tier));
  }
  return new Response("forbidden", { status: 403 });
});
