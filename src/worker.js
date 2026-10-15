/*
 * 投稿、つくったろか。── サーバー（Cloudflare Workers）
 * 画面のファイルは public/ から自動で配信。ここは /api/ だけを担当する。
 *
 * 参加者用   POST /api/generate  3パターン生成
 *           POST /api/cal      Googleカレンダー（秘密のiCalアドレス）の予定を取ってくる。URLは保存しない
 *           POST /api/style    過去の投稿から「書き方の癖」を分析する（1回だけ。結果は端末に保存）
 *           POST /api/refine    1パターンだけ書き直し
 *           POST /api/submit    「コピー」「あとで」の記録（共有ONのときだけ中身も保存）
 *           POST /api/report    「投稿したで！」の報告（名前・投稿のリンク・本文）。端末ごとに1件、送り直すと上書き
 *           GET  /api/stats     件数と、スクリーンに名前を出してOKな人（/qr の表示用）
 *           GET  /api/health    動作確認（version で、いま公開中の版が分かる）
 *           GET  /api/event     イベント（?e=ID）の名前・ハッシュタグ。POST /api/event/unlock であいことばを確かめる
 *           POST /api/clientlog 端末で起きた失敗の記録（運営ページの「最近のエラー」に出る）
 * パネラー用 /api/judge/*        ヘッダー x-judge-key にパネラー用の鍵（合言葉から自動で作る）が必要
 *           GET  /api/judge/feed  報告された投稿（since 以降に増えた・変わったものだけ）
 *           POST /api/judge/star  ★を付ける・外す
 * 運営用     /api/admin/*        ヘッダー x-admin-passcode に合言葉が必要
 */
import {
  SYSTEM_PROMPT,
  patternsSchema,
  patternCount,
  BODY_SCHEMA,
  REFINE_ACTIONS,
  cleanRequest,
  TONE_IDS,
  sanitizePayload,
  sanitizeImages,
  IMAGE_MAX,
  IMAGE_MAX_CHARS,
  buildUserInput,
  buildRefineInput,
  cleanBody,
  normalizePatterns,
  PROFILE_PROMPT,
  PROFILE_SCHEMA,
  PROFILE_ACTIONS,
  normalizeProfile,
  buildProfileInput,
  buildProfileRefineInput,
} from "./ai.js";
import { geminiJSON, explainFailure, parseJsonLoose, DEFAULT_BASE } from "./gemini.js";
import { extractLinkedInUrl, cleanName, nameKey } from "./report.js";

const VERSION = "2026-10-15.photo-1";
const HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: HEADERS });

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    try {
      return await route(request, env, ctx, url);
    } catch (e) {
      console.error("api error", (e && e.stack) || e);
      return json({ ok: false, code: "server", message: "サーバーでエラーが起きました" }, 500);
    }
  },
};

async function route(request, env, ctx, url) {
  const p = url.pathname;
  const m = request.method;
  if (p === "/api/health" && m === "GET") return health(env);
  if (p === "/api/stats" && m === "GET") return stats(env);
  if (p === "/api/generate" && m === "POST") return generate(request, env, ctx);
  if (p === "/api/checkkey" && m === "POST") return checkKey(request);
  if (p === "/api/clientlog" && m === "POST") return clientLog(request, env, ctx);
  if (p === "/api/event" && m === "GET") return eventPublic(env, url);
  if (p === "/api/event/unlock" && m === "POST") return eventUnlock(request, env);
  if (p === "/api/cal" && m === "POST") return calEvents(request, env);
  if (p === "/api/style" && m === "POST") return styleProfile(request, env);
  if (p === "/api/refine" && m === "POST") return refine(request, env, ctx);
  if (p === "/api/submit" && m === "POST") return submit(request, env);
  if (p === "/api/report" && m === "POST") return report(request, env, ctx);
  if (p.startsWith("/api/judge/")) {
    if (!(await judgeOk(request, env))) return json({ ok: false, code: "auth", message: "パネラー用のリンクが正しくありません" }, 401);
    if (p === "/api/judge/feed" && m === "GET") return judgeFeed(env, url);
    if (p === "/api/judge/star" && m === "POST") return judgeStar(request, env);
    return json({ ok: false, code: "not_found" }, 404);
  }
  if (p.startsWith("/api/admin/")) {
    if (!String(env.ADMIN_PASSCODE || "")) return json({ ok: false, code: "no_passcode", message: "合言葉（ADMIN_PASSCODE）が未設定です" }, 403);
    if (!adminOk(request, env)) return json({ ok: false, code: "auth", message: "合言葉がちがいます" }, 401);
    if (p === "/api/admin/summary" && m === "GET") return adminSummary(env);
    if (p === "/api/admin/posts" && m === "GET") return adminPosts(env, url);
    if (p === "/api/admin/export" && m === "GET") return adminExport(env);
    if (p === "/api/admin/settings" && m === "POST") return adminSettings(request, env);
    if (p === "/api/admin/test" && m === "POST") return adminTest(env);
    if (p === "/api/admin/wipe" && m === "POST") return adminWipe(request, env);
    if (p === "/api/admin/reports" && m === "GET") return adminReports(env);
    if (p === "/api/admin/report-hide" && m === "POST") return adminReportHide(request, env);
    if (p === "/api/admin/judge-link" && m === "GET") return adminJudgeLink(env);
    if (p === "/api/admin/roster" && m === "POST") return adminRoster(request, env);
    if (p === "/api/admin/export-reports" && m === "GET") return adminExportReports(env);
    if (p === "/api/admin/events" && m === "GET") return adminEvents(env);
    if (p === "/api/admin/event" && m === "POST") return adminEventSave(request, env);
    if (p === "/api/admin/event-delete" && m === "POST") return adminEventDelete(request, env);
  }
  return json({ ok: false, code: "not_found" }, 404);
}

// ---------- データベース（D1）。無くても生成は動く ----------
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL,
    action TEXT NOT NULL,
    role TEXT,
    cards TEXT,
    answers TEXT,
    style TEXT,
    patterns TEXT,
    tone TEXT,
    final_text TEXT,
    edited INTEGER NOT NULL DEFAULT 0,
    client_id TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL,
    type TEXT NOT NULL,
    detail TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_events_type ON events(type)`,
  `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
  // 「投稿したで！」の報告。端末（client_id）ごとに1件。時刻はミリ秒
  `CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    client_id TEXT NOT NULL,
    name TEXT NOT NULL,
    url TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL DEFAULT '',
    source TEXT NOT NULL DEFAULT 'app',
    tone TEXT NOT NULL DEFAULT '',
    screen_ok INTEGER NOT NULL DEFAULT 1,
    hidden INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_reports_client ON reports(client_id)`,
  `CREATE INDEX IF NOT EXISTS idx_reports_updated ON reports(updated_at)`,
  // イベント（運営ページで作る。名前・ハッシュタグ・あいことば・AIキー）。data はJSON
  `CREATE TABLE IF NOT EXISTS event_settings (id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER NOT NULL)`,
  // パネラーの★（候補）
  `CREATE TABLE IF NOT EXISTS stars (
    judge TEXT NOT NULL,
    report_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (judge, report_id)
  )`,
];
let schemaReady = false;
async function getDb(env) {
  if (!env.DB) return null;
  if (!schemaReady) {
    try {
      await env.DB.batch(SCHEMA.map((s) => env.DB.prepare(s)));
      schemaReady = true;
    } catch (e) {
      console.error("schema", e);
      return null;
    }
  }
  return env.DB;
}
function logEvent(env, ctx, type, detail) {
  const task = (async () => {
    const db = await getDb(env);
    if (!db) return;
    await db
      .prepare("INSERT INTO events (created_at, type, detail) VALUES (?, ?, ?)")
      .bind(new Date().toISOString(), type, JSON.stringify(detail || {}))
      .run();
  })().catch((e) => console.error("log", e));
  if (ctx && ctx.waitUntil) ctx.waitUntil(task);
  return task;
}

let settingsCache = { at: 0, map: {} };
async function readSettings(env, fresh = false) {
  if (!fresh && Date.now() - settingsCache.at < 15000) return settingsCache.map;
  const db = await getDb(env);
  const map = {};
  if (db) {
    try {
      const { results } = await db.prepare("SELECT key, value FROM settings").all();
      for (const r of results || []) map[r.key] = r.value;
    } catch (e) {
      console.error("settings", e);
    }
  }
  settingsCache = { at: Date.now(), map };
  return map;
}
const generationOpen = async (env) => (await readSettings(env)).generation !== "off";

// ---------- 連打よけ（おおまかでOK。会場は全員同じWi-Fiの可能性があるので、IPはゆるめ） ----------
const hits = new Map();
function limited(key, max, windowMs) {
  const now = Date.now();
  const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
  const over = arr.length >= max;
  if (!over) arr.push(now);
  hits.set(key, arr);
  if (hits.size > 5000) hits.clear();
  return over;
}

async function readJson(request, max = 40000) {
  const len = Number(request.headers.get("content-length") || 0);
  if (len > max) return null;
  const text = await request.text();
  if (text.length > max) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// ---------- AI（本命のモデル → 予備のモデル） ----------
// 上級者向け：Gemini以外（OpenAI互換API）の設定を、端末からヘッダーで受け取る
function b64Dec(s) {
  try {
    const bin = atob(String(s || ""));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  } catch {
    return "";
  }
}
function aiConfigOf(request) {
  const raw = b64Dec(request.headers.get("x-ai-config") || "");
  if (!raw) return null;
  let c;
  try {
    c = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!c || !c.key || !c.model) return null;
  if (!["openai", "anthropic"].includes(c.provider)) return null;
  const def = c.provider === "anthropic" ? "https://api.anthropic.com" : "https://api.openai.com/v1";
  return { provider: c.provider, baseUrl: String(c.baseUrl || def).slice(0, 200), model: String(c.model).slice(0, 80), key: String(c.key).slice(0, 300) };
}

async function anthropicJSON({ baseUrl, model, key, system, input, images = [], timeoutMs = 30000, maxOutputTokens = 4000 }) {
  const started = Date.now();
  const base = { model, style: "anthropic" };
  if (!key || !model) return { ...base, ok: false, status: 0, reason: "NO_KEY", message: "AIの設定が足りません", ms: 0 };
  const url = `${String(baseUrl || "https://api.anthropic.com").replace(/\/+$/, "")}/v1/messages`;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model,
        max_tokens: maxOutputTokens,
        system: `${system}\n\n出力は指定のJSONだけにして。前後に説明は書かない。`,
        messages: [
          {
            role: "user",
            content: images.length
              ? [...images.map((im) => ({ type: "image", source: { type: "base64", media_type: im.mime, data: im.data } })), { type: "text", text: input }]
              : input,
          },
        ],
      }),
      signal: ctl.signal,
    });
    const raw = await res.text();
    let data = null;
    try {
      data = JSON.parse(raw);
    } catch {}
    const ms = Date.now() - started;
    if (!res.ok) {
      const err = (data && data.error) || {};
      return { ...base, ok: false, status: res.status, reason: (err && err.type) || `HTTP_${res.status}`, message: String(err.message || raw || "").slice(0, 300), ms };
    }
    const parts = data && data.content;
    const text = Array.isArray(parts) ? parts.filter((p) => p && p.type === "text").map((p) => p.text).join("") : "";
    if (!text) return { ...base, ok: false, status: 200, reason: "EMPTY", message: "出力が空", ms };
    const json = parseJsonLoose(text);
    if (json === undefined) return { ...base, ok: false, status: 200, reason: "BAD_JSON", message: String(text).slice(0, 200), ms };
    return { ...base, ok: true, status: 200, json, text, ms };
  } catch (e) {
    return { ...base, ok: false, status: 0, reason: e && e.name === "AbortError" ? "TIMEOUT" : "NETWORK", message: String((e && e.message) || e), ms: Date.now() - started };
  } finally {
    clearTimeout(timer);
  }
}

async function openaiJSON({ baseUrl, model, key, system, input, images = [], timeoutMs = 22000, maxOutputTokens = 4000 }) {
  const started = Date.now();
  const base = { model, style: "openai" };
  if (!key || !model) return { ...base, ok: false, status: 0, reason: "NO_KEY", message: "AIの設定が足りません", ms: 0 };
  const url = `${String(baseUrl || "https://api.openai.com/v1").replace(/\/+$/, "")}/chat/completions`;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: images.length
              ? [{ type: "text", text: `${input}\n\n出力は指定のJSONだけにして。` }, ...images.map((im) => ({ type: "image_url", image_url: { url: `data:${im.mime};base64,${im.data}` } }))]
              : `${input}\n\n出力は指定のJSONだけにして。`,
          },
        ],
        response_format: { type: "json_object" },
        max_tokens: maxOutputTokens,
      }),
      signal: ctl.signal,
    });
    const raw = await res.text();
    let data = null;
    try {
      data = JSON.parse(raw);
    } catch {}
    const ms = Date.now() - started;
    if (!res.ok) {
      const err = (data && data.error) || {};
      return { ...base, ok: false, status: res.status, reason: err.type || `HTTP_${res.status}`, message: String(err.message || raw || "").slice(0, 300), ms };
    }
    const text = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!text) return { ...base, ok: false, status: 200, reason: "EMPTY", message: "出力が空", ms };
    const json = parseJsonLoose(text);
    if (json === undefined) return { ...base, ok: false, status: 200, reason: "BAD_JSON", message: String(text).slice(0, 200), ms };
    return { ...base, ok: true, status: 200, json, text, ms };
  } catch (e) {
    return { ...base, ok: false, status: 0, reason: e && e.name === "AbortError" ? "TIMEOUT" : "NETWORK", message: String((e && e.message) || e), ms: Date.now() - started };
  } finally {
    clearTimeout(timer);
  }
}

let primaryCoolUntil = 0;
async function callAI(env, { system, input, schema, validate, userKey, adv, images = [] }) {
  // 上級者設定（Gemini以外）があるときは、そのAI一本でいく（予備チェーンなし）
  if (adv) {
    const args = { baseUrl: adv.baseUrl, model: adv.model, key: adv.key, system, input, images };
    let r = adv.provider === "anthropic" ? await anthropicJSON(args) : await openaiJSON(args);
    if (r.ok && validate) {
      const v = validate(r.json);
      if (v) return { ...r, value: v };
      r = { ...r, ok: false, reason: "BAD_SHAPE", message: String(r.text || "").slice(0, 200) };
    }
    console.warn("ai failed", JSON.stringify({ model: r.model, style: r.style, status: r.status, reason: r.reason, message: r.message }));
    return r;
  }
  const styleName = env.GEMINI_API_STYLE === "generateContent" ? "generateContent" : "interactions";
  const primary = { model: env.GEMINI_MODEL || "gemini-3.8-flash", style: styleName, timeoutMs: 22000 };
  const fallback = {
    model: env.GEMINI_FALLBACK_MODEL || "gemini-flash-lite-latest",
    style: env.GEMINI_FALLBACK_STYLE || styleName,
    timeoutMs: 16000,
  };
  const plan = Date.now() < primaryCoolUntil ? [fallback, primary] : [primary, fallback];
  const thinking = env.GEMINI_THINKING === undefined ? "low" : env.GEMINI_THINKING || null;
  let last = null;
  for (const step of plan) {
    if (!step.model) continue;
    const args = {
      apiKey: userKey || env.GEMINI_API_KEY,
      baseUrl: env.GEMINI_BASE_URL || DEFAULT_BASE,
      system,
      input,
      schema,
      thinking,
      images,
      ...step,
    };
    let r = await geminiJSON(args);
    if (!r.ok && r.status === 400 && thinking && !/API key/i.test(r.message || "")) r = await geminiJSON({ ...args, thinking: null });
    if (!r.ok && r.status === 404 && step.style === "interactions") r = await geminiJSON({ ...args, style: "generateContent" });
    if (r.ok && validate) {
      const v = validate(r.json);
      if (v) return { ...r, value: v };
      r = { ...r, ok: false, reason: "BAD_SHAPE", message: String(r.text || "").slice(0, 200) };
    } else if (r.ok) return r;
    if (step === primary && (r.status === 429 || r.status >= 500 || r.reason === "TIMEOUT")) primaryCoolUntil = Date.now() + 30000;
    console.warn("gemini failed", JSON.stringify({ model: r.model, style: r.style, status: r.status, reason: r.reason, message: r.message }));
    last = r;
  }
  return last || { ok: false, status: 0, reason: "NO_MODEL", message: "モデルが未設定" };
}

// ---------- 参加者用 ----------
// 端末で入れた自分のキーや、上級者設定（Gemini以外のAI）を受け取る
const userKeyOf = (request) => (String(request.headers.get("x-user-key") || "").trim().slice(0, 300) || null);

// ---------- キーのお試し確認（紐づけの前に、キーが使えるかだけ確かめる。無料の一覧取得） ----------
async function checkKey(request) {
  const body = await readJson(request);
  const key = String((body && body.key) || "").trim().slice(0, 300);
  if (!key) return json({ ok: false, code: "format", message: "キーが空のままや。貼り付けしなおしてみて" }, 400);
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 10000);
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1", {
      headers: { "x-goog-api-key": key },
      signal: ctl.signal,
    });
    clearTimeout(timer);
    if (res.ok) return json({ ok: true });
    if (res.status === 400 || res.status === 403) return json({ ok: false, code: "bad_key", message: "キーがちがうみたいや。「APIキーを作成」から作り直すか、もう一度まるごとコピーしてみて" }, 400);
    return json({ ok: false, code: "server", message: "Googleに確認できへんかった。ちょっと後でもう一度" }, 502);
  } catch {
    return json({ ok: false, code: "network", message: "ネットに繋がらんかった。通信を確かめてもう一度" }, 502);
  }
}

// 写真つきのとき、生成と書き直しは本文が大きくなる（写真4枚まで＋回答）
const AI_BODY_MAX = IMAGE_MAX * IMAGE_MAX_CHARS + 60000;
const imagesKb = (images) => Math.round((images.reduce((n, im) => n + im.data.length, 0) * 3) / 4 / 1024);
// 写真が原因になりやすい失敗（400・413・返事の形の崩れ）なら、写真なしでもう一度だけ作る
const photoRetryable = (r) => r.status === 400 || r.status === 413 || ["BAD_SHAPE", "EMPTY", "BAD_JSON"].includes(r.reason);

async function readAiBody(request, env, ctx, where) {
  const body = await readJson(request, AI_BODY_MAX);
  if (!body) logEvent(env, ctx, "error", { where: `${where}:read`, reason: "BAD_BODY", kb: Math.round(Number(request.headers.get("content-length") || 0) / 1024) });
  return body;
}

// 端末で起きた失敗（時間切れ・通信切れ・写真が読めない・作っている途中で画面が閉じた など）を記録する。運営ページの「最近のエラー」に出る
async function clientLog(request, env, ctx) {
  const body = await readJson(request, 4000);
  if (!body) return json({ ok: false, code: "input" }, 400);
  const cid = String(body.clientId || "").slice(0, 64);
  const ip = request.headers.get("cf-connecting-ip") || "local";
  if (limited(`cl:${cid}`, 20, 60000) || limited(`cli:${ip}`, 600, 60000)) return json({ ok: false, code: "rate" }, 429);
  const str = (v, n) => String(v ?? "").replace(/[\u0000-\u001F\u007F]/g, " ").slice(0, n);
  logEvent(env, ctx, "error", {
    where: `client:${str(body.where, 20)}`,
    reason: str(body.code, 40),
    message: str(body.message, 200),
    photos: Math.max(0, Math.min(10, Number(body.photos) || 0)),
    kb: Math.max(0, Math.min(100000, Number(body.kb) || 0)),
    ua: str(request.headers.get("user-agent"), 160),
    name: cleanName(body.name),
  });
  return json({ ok: true });
}

// ---------- イベント（運営ページで作る。参加者は ?e=イベントID で開く） ----------
// あいことばが合えば、イベントのAIキー（なければサーバーのキー）で作れる。参加者がキーを作らなくていい
const NO_EVENT = { key: null, id: "" };
const cleanEventId = (v) => {
  const s = String(v || "").trim().toLowerCase();
  return /^[a-z0-9][a-z0-9-]{0,39}$/.test(s) ? s : "";
};
function cleanHashtags(v) {
  const list = Array.isArray(v) ? v : String(v || "").split(/[\s,、，　]+/);
  const out = [];
  for (const raw of list) {
    const t = String(raw || "").replace(/^[#＃]+/, "").replace(/[\s#＃]/g, "").slice(0, 40);
    if (t && !out.includes(`#${t}`)) out.push(`#${t}`);
    if (out.length >= 10) break;
  }
  return out;
}
const eventCache = new Map();
async function readEvent(env, id, fresh = false) {
  if (!id) return null;
  const hit = eventCache.get(id);
  if (!fresh && hit && Date.now() - hit.at < 10000) return hit.ev;
  const db = await getDb(env);
  if (!db) return null;
  const row = await db.prepare("SELECT data, updated_at FROM event_settings WHERE id = ?").bind(id).first();
  const ev = row ? { ...safeParse(row.data), id, updatedAt: row.updated_at } : null;
  eventCache.set(id, { at: Date.now(), ev });
  if (eventCache.size > 200) eventCache.clear();
  return ev;
}
const passError = () => json({ ok: false, code: "pass", message: "あいことばが変わったみたい。もう一度入れてな" }, 403);
// 生成のヘッダー（x-event と x-event-pass）から、使うキーを決める。あいことばがちがうときは bad
async function eventKeyOf(request, env) {
  const id = cleanEventId(request.headers.get("x-event"));
  const raw = request.headers.get("x-event-pass");
  if (!id || !raw) return NO_EVENT;
  let pass = "";
  try {
    pass = decodeURIComponent(raw).trim();
  } catch {
    return { ...NO_EVENT, bad: true };
  }
  const ev = await readEvent(env, id);
  if (!ev || !ev.active || !ev.pass || !safeEqual(ev.pass, pass)) return { ...NO_EVENT, id, bad: true };
  return { key: ev.key || env.GEMINI_API_KEY || null, id };
}
// 参加者の画面用（あいことばとキーは返さない）
async function eventPublic(env, url) {
  const ev = await readEvent(env, cleanEventId(url.searchParams.get("e")));
  if (!ev || !ev.active) return json({ ok: false, code: "no_event", message: "このイベントは、いまは使えません" }, 404);
  return json({
    ok: true,
    event: { id: ev.id, name: ev.name || "", hashtags: ev.hashtags || [], cheerAlways: !!ev.cheerAlways, preset: ev.preset || "", needsPass: !!ev.pass, hasKey: !!(ev.pass && (ev.key || env.GEMINI_API_KEY)) },
  });
}
async function eventUnlock(request, env) {
  const body = await readJson(request, 2000);
  const ip = request.headers.get("cf-connecting-ip") || "local";
  const cid = String((body && body.clientId) || "").slice(0, 64);
  if (limited(`evu:${cid}`, 10, 60000) || limited(`evi:${ip}`, 300, 60000)) return json({ ok: false, code: "rate", message: "ちょっと待って、もう一回どうぞ" }, 429);
  const id = cleanEventId(body && body.e);
  const pass = String((body && body.pass) || "").trim().slice(0, 60);
  if (!id || !pass) return json({ ok: false, code: "input", message: "あいことばを入れてな" }, 400);
  const ev = await readEvent(env, id);
  if (!ev || !ev.active) return json({ ok: false, code: "no_event", message: "このイベントは、いまは使えません" }, 404);
  if (!ev.pass || !safeEqual(ev.pass, pass)) return json({ ok: false, code: "pass", message: "あいことばがちがうみたい。スタッフに聞いてな" }, 403);
  if (!ev.key && !env.GEMINI_API_KEY) return json({ ok: false, code: "no_key", message: "イベントのAIキーがまだ設定されてへん。スタッフに声かけてな" }, 503);
  return json({ ok: true });
}
// 運営ページ：イベントの一覧・作成・変更・削除（キーは末尾4文字だけ見せる）
async function adminEvents(env) {
  const db = await getDb(env);
  if (!db) return json({ ok: false, code: "db", message: "データベースがありません" }, 503);
  const { results } = await db.prepare("SELECT id, data, updated_at FROM event_settings ORDER BY updated_at DESC").all();
  const events = (results || []).map((r) => {
    const d = safeParse(r.data);
    return { id: r.id, name: d.name || "", hashtags: d.hashtags || [], pass: d.pass || "", keySet: !!d.key, keyTail: d.key ? String(d.key).slice(-4) : "", cheerAlways: !!d.cheerAlways, active: d.active !== false, preset: d.preset || "", updatedAt: r.updated_at };
  });
  return json({ ok: true, events, serverKey: !!env.GEMINI_API_KEY });
}
async function adminEventSave(request, env) {
  const body = await readJson(request, 8000);
  const id = cleanEventId(body && body.id);
  if (!id) return json({ ok: false, code: "input", message: "イベントIDは、英小文字・数字・ハイフンで40字まで（例：lscw2026）" }, 400);
  const db = await getDb(env);
  if (!db) return json({ ok: false, code: "db", message: "データベースがありません" }, 503);
  const prev = (await readEvent(env, id, true)) || {};
  const str = (v, n) => String(v ?? "").replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, n);
  const data = {
    name: str(body.name, 60),
    hashtags: cleanHashtags(body.hashtags),
    pass: str(body.pass, 60),
    key: body.clearKey ? "" : str(body.key, 300) || prev.key || "",
    cheerAlways: body.cheerAlways === true,
    active: body.active !== false,
    preset: str(body.preset, 20),
  };
  await db.prepare("INSERT INTO event_settings (id, data, updated_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at").bind(id, JSON.stringify(data), Date.now()).run();
  eventCache.delete(id);
  return json({ ok: true });
}
async function adminEventDelete(request, env) {
  const body = await readJson(request, 2000);
  const id = cleanEventId(body && body.id);
  const db = await getDb(env);
  if (!id || !db) return json({ ok: false, code: "input" }, 400);
  await db.prepare("DELETE FROM event_settings WHERE id = ?").bind(id).run();
  eventCache.delete(id);
  return json({ ok: true });
}

async function generate(request, env, ctx) {
  const body = await readAiBody(request, env, ctx, "generate");
  if (!body) return json({ ok: false, code: "input", message: "入力が読めませんでした" }, 400);
  const p = sanitizePayload(body);
  const images = sanitizeImages(body.images);
  if (!p.answers.length) return json({ ok: false, code: "input", message: "回答が空です" }, 400);
  if (!(await generationOpen(env))) return json({ ok: false, code: "stopped", message: "受付停止中" }, 503);
  const cid = String(body.clientId || "").slice(0, 64);
  const ip = request.headers.get("cf-connecting-ip") || "local";
  if (limited(`c:${cid}`, 10, 60000) || limited(`i:${ip}`, 400, 60000)) return json({ ok: false, code: "rate" }, 429);
  const ukey = userKeyOf(request);
  const aiCfg = aiConfigOf(request);
  const ev = ukey || aiCfg ? NO_EVENT : await eventKeyOf(request, env);
  if (ev.bad) return passError();
  const key = ukey || ev.key;

  const cards = p.answers.map((a) => a.label);
  const who = cleanName(body.name);
  if (!key && !aiCfg && !env.GEMINI_API_KEY) {
    logEvent(env, ctx, "generate", { cards, sample: true, name: who, mode: p.mode, kind: p.kind, followed: body.followed === true });
    return json({ ok: true, sample: true });
  }
  // プロフィール文（見出し3案＋自己紹介）。写真は使わない
  if (p.kind === "profile") {
    const r = await callAI(env, { userKey: key, adv: aiCfg, system: PROFILE_PROMPT, input: buildProfileInput(p), schema: PROFILE_SCHEMA, validate: normalizeProfile });
    if (!r.ok) {
      logEvent(env, ctx, "error", { where: "profile", status: r.status, reason: r.reason, model: r.model, ownKey: !!ukey });
      return json({ ok: false, code: "failed", message: ukey ? explainFailure(r) : "生成に失敗しました" }, 502);
    }
    logEvent(env, ctx, "generate", { cards, model: r.model, ms: r.ms, name: who, mode: "profile", kind: "profile", followed: body.followed === true, event: ev.id || "" });
    return json({ ok: true, profile: r.value, model: r.model });
  }
  const opts = (imgs) => ({
    userKey: key,
    adv: aiCfg,
    system: SYSTEM_PROMPT,
    input: buildUserInput({ ...p, photos: imgs.length }),
    images: imgs,
    schema: patternsSchema(patternCount(p.mode), p.tone),
    validate: (j) => normalizePatterns(j, p.style.phrase, patternCount(p.mode), p.tone),
  });
  let r = await callAI(env, opts(images));
  let photoSkipped = false;
  if (!r.ok && images.length && photoRetryable(r)) {
    logEvent(env, ctx, "error", { where: "generate:photo", status: r.status, reason: r.reason, model: r.model, photos: images.length, kb: imagesKb(images), message: String(r.message || "").slice(0, 160) });
    r = await callAI(env, opts([]));
    photoSkipped = r.ok;
  }
  if (!r.ok) {
    logEvent(env, ctx, "error", { where: "generate", status: r.status, reason: r.reason, model: r.model, ownKey: !!ukey, photos: images.length, kb: imagesKb(images) });
    return json({ ok: false, code: "failed", message: ukey ? explainFailure(r) : "生成に失敗しました" }, 502);
  }
  logEvent(env, ctx, "generate", { cards, model: r.model, ms: r.ms, name: who, mode: p.mode, followed: body.followed === true, photos: images.length, photoSkipped, event: ev.id || "" });
  return json({ ok: true, patterns: r.value, model: r.model, photoSkipped });
}

// ---------- カレンダー（Googleカレンダーの「秘密のiCalアドレス」を見る。URLは保存しない） ----------
function icsDay(v) {
  const m = String(v || "").trim().match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z?))?$/);
  if (!m) return "";
  const [, y, mo, d, hh, mi, ss, z] = m;
  if (z) {
    const t = Date.UTC(+y, +mo - 1, +d, +hh || 0, +mi || 0, +ss || 0) + 9 * 3600 * 1000;
    const jd = new Date(t);
    const p2 = (n) => String(n).padStart(2, "0");
    return `${jd.getUTCFullYear()}-${p2(jd.getUTCMonth() + 1)}-${p2(jd.getUTCDate())}`;
  }
  return `${y}-${mo}-${d}`; // 日だけ、またはTZID付き（日本の人が多いので現地時刻の日付とみなす）
}

async function calEvents(request, env) {
  const body = await readJson(request);
  const raw = String((body && body.url) || "").trim();
  let u;
  try {
    u = new URL(raw);
  } catch {
    return json({ ok: false, code: "url", message: "カレンダーのURLが正しくありません" }, 400);
  }
  if (u.protocol !== "https:") return json({ ok: false, code: "url", message: "https の URL を入れてください" }, 400);
  const ip = request.headers.get("cf-connecting-ip") || "local";
  if (limited(`cal:${ip}`, 30, 60000)) return json({ ok: false, code: "rate" }, 429);
  const week = (body && body.range) === "week";

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  let text = "";
  try {
    const res = await fetch(u.href, { signal: ctl.signal, headers: { "user-agent": "tsukuttaroka/1.0" } });
    if (!res.ok) return json({ ok: false, code: "fetch", message: `カレンダーが読めませんでした（${res.status}）` }, 502);
    text = await res.text();
  } catch (e) {
    return json({ ok: false, code: "network", message: "カレンダーに接続できませんでした（URLか通信を確認してな）" }, 502);
  } finally {
    clearTimeout(timer);
  }
  if (text.length > 2000000) text = text.slice(0, 2000000);

  // JSTの今日
  const jstNow = new Date(Date.now() + 9 * 3600 * 1000);
  const p2 = (n) => String(n).padStart(2, "0");
  const dayOf = (t) => {
    const d = new Date(t + 9 * 3600 * 1000);
    return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`;
  };
  const todayStr = dayOf(Date.now());
  const weekAgoStr = dayOf(Date.now() - 6 * 86400000);

  const lines = text.replace(/\r\n/g, "\n").replace(/\n /g, "");
  const out = [];
  const seen = new Set();
  const re = /BEGIN:VEVENT([\s\S]*?)END:VEVENT/g;
  let m;
  while ((m = re.exec(lines)) && out.length < 400) {
    const block = m[1];
    const sum = block.match(/^SUMMARY[^:\n]*:(.*)$/m);
    const start = block.match(/^DTSTART[^:\n]*:(.*)$/m);
    if (!start) continue;
    const title = String(sum ? sum[1] : "").replace(/\\n/g, " ").replace(/\\,/g, ",").replace(/\\/g, "").replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, 80);
    const day = icsDay(start[1]);
    if (!title || !day) continue;
    const hit = week ? day >= weekAgoStr && day <= todayStr : day === todayStr;
    if (!hit) continue;
    const key = `${day} ${title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ day, title });
  }
  out.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
  return json({ ok: true, today: todayStr, events: out.slice(0, 40) });
}

// ---------- 書き方の癖（過去の投稿を1回だけ分析。プロファイル文だけ返す） ----------
const STYLE_SYSTEM = `あなたは文章のプロファイラーです。渡されるテキストは、ある人がLinkedInに投稿した文の集まりです。この人の「書き方の癖」だけを分析して、編集者への指示文にする。
次のJSONだけを返す。前後に説明を書かない。{"profile":"…"}

profile に入れること（300〜700字。「・」で区切った文章）:
・一人称と、自分の呼び方
・文体の感覚（です・ます／だ・であるのどちら寄りか、丁寧さ、カジュアルさ）
・文の長さと、改行・段落の組み立て方の癖
・よく使う言葉・口ぐせ・決まり文句（投稿からの実例を3つほど、そのまま引用）
・ネタの選び方と、話の流れ（どんな入り方をして、どう締めるか）
・絵文字や「！」「〜」の使い方、笑いの入れ方、タメ口と敬語の混ざり方
・本人はあまり使っていない表現（まねしないほうがいいこと）が分かれば書く
書かないこと: 経歴などの事実の紹介、投稿内容の要約、名前、氏の情報。
指示文は「この人の投稿は、〜で書く」という形で書く。`;

async function styleProfile(request, env) {
  const body = await readJson(request, 30000);
  const sample = String((body && body.sample) || "").slice(0, 20000).trim();
  if (sample.length < 200) return json({ ok: false, code: "input", message: "過去の投稿が少なすぎるみたい。もう1〜2件、投稿を足してな" }, 400);
  const ukey = userKeyOf(request);
  const ev = ukey ? NO_EVENT : await eventKeyOf(request, env);
  if (ev.bad) return passError();
  const key = ukey || ev.key;
  if (!key && !env.GEMINI_API_KEY) return json({ ok: false, code: "no_key", message: "先に、AIのキーを入れてな" }, 403);
  const ip = request.headers.get("cf-connecting-ip") || "local";
  if (limited(`st:${ip}`, 15, 60000)) return json({ ok: false, code: "rate" }, 429);
  const r = await callAI(env, {
    userKey: key,
    system: STYLE_SYSTEM,
    input: sample,
    schema: { type: "object", properties: { profile: { type: "string" } }, required: ["profile"] },
    validate: (j) => {
      const t = String(j && j.profile || "").trim();
      return t.length >= 100 ? t.slice(0, 2000) : null;
    },
  });
  if (!r.ok) {
    logEvent(env, null, "error", { where: "style", status: r.status, reason: r.reason, ownKey: !!ukey });
    return json({ ok: false, code: "failed", message: explainFailure(r) }, 502);
  }
  return json({ ok: true, profile: r.value });
}

async function refine(request, env, ctx) {
  const body = await readAiBody(request, env, ctx, "refine");
  if (!body) return json({ ok: false, code: "input", message: "入力が読めませんでした" }, 400);
  const p = sanitizePayload(body);
  const isProfile = p.kind === "profile";
  const images = isProfile ? [] : sanitizeImages(body.images);
  const tone = isProfile ? "emo" : TONE_IDS.includes(body.tone) ? body.tone : null;
  const action = (isProfile ? PROFILE_ACTIONS : REFINE_ACTIONS)[body.action] ? body.action : null;
  const current = String(body.body || "").slice(0, isProfile ? 2600 : 1500);
  const ask = cleanRequest(body.request);
  if (!tone || !action || current.length < 10) return json({ ok: false, code: "input", message: "入力が足りません" }, 400);
  if (action === "custom" && !ask) return json({ ok: false, code: "input", message: "どう直すかを書いてください" }, 400);
  if (!(await generationOpen(env))) return json({ ok: false, code: "stopped", message: "受付停止中" }, 503);
  const cid = String(body.clientId || "").slice(0, 64);
  const ip = request.headers.get("cf-connecting-ip") || "local";
  if (limited(`c:${cid}`, 10, 60000) || limited(`i:${ip}`, 400, 60000)) return json({ ok: false, code: "rate" }, 429);
  const ukey = userKeyOf(request);
  const aiCfg = aiConfigOf(request);
  const ev = ukey || aiCfg ? NO_EVENT : await eventKeyOf(request, env);
  if (ev.bad) return passError();
  const key = ukey || ev.key;
  if (!key && !aiCfg && !env.GEMINI_API_KEY) return json({ ok: true, sample: true });

  const opts = (imgs) => ({
    userKey: key,
    adv: aiCfg,
    system: isProfile ? PROFILE_PROMPT : SYSTEM_PROMPT,
    input: isProfile ? buildProfileRefineInput(p, current, action, ask) : buildRefineInput({ ...p, photos: imgs.length }, tone, current, action, ask),
    images: imgs,
    schema: BODY_SCHEMA,
    validate: (j) => {
      const b = cleanBody(j && j.body, isProfile ? "" : p.style.phrase);
      return b.length >= (isProfile ? 60 : 20) ? b.slice(0, isProfile ? 2600 : 3000) : null;
    },
  });
  let r = await callAI(env, opts(images));
  if (!r.ok && images.length && photoRetryable(r)) {
    logEvent(env, ctx, "error", { where: "refine:photo", status: r.status, reason: r.reason, model: r.model, photos: images.length, kb: imagesKb(images), message: String(r.message || "").slice(0, 160) });
    r = await callAI(env, opts([]));
  }
  if (!r.ok) {
    logEvent(env, ctx, "error", { where: "refine", status: r.status, reason: r.reason, model: r.model, ownKey: !!ukey, photos: images.length });
    return json({ ok: false, code: "failed", message: ukey ? explainFailure(r) : "書き直しに失敗しました" }, 502);
  }
  logEvent(env, ctx, "refine", { action, tone: isProfile ? "" : tone, model: r.model, name: cleanName(body.name), mode: isProfile ? "profile" : p.mode, kind: p.kind, photos: images.length });
  return json({ ok: true, body: r.value, model: r.model });
}

async function submit(request, env) {
  const body = await readJson(request, 60000);
  if (!body) return json({ ok: false, code: "input" }, 400);
  const cid = String(body.clientId || "").slice(0, 64);
  if (limited(`s:${cid}`, 20, 60000)) return json({ ok: false, code: "rate" }, 429);
  const action = body.action === "later" ? "later" : "copy";
  const tone = TONE_IDS.includes(body.tone) ? body.tone : "";
  const p = sanitizePayload(body);
  const db = await getDb(env);
  if (!db) return json({ ok: true, stored: false });
  const now = new Date().toISOString();
  const consent = body.consent === true;
  const stmts = [
    db.prepare("INSERT INTO events (created_at, type, detail) VALUES (?, ?, ?)").bind(now, action, JSON.stringify({ tone, consent, name: cleanName(body.name), mode: p.mode, kind: p.kind })),
  ];
  if (consent) {
    const patterns = {};
    for (const t of TONE_IDS) patterns[t] = String((body.patterns && body.patterns[t]) || "").slice(0, 3000);
    stmts.push(
      db
        .prepare(
          "INSERT INTO posts (created_at, action, role, cards, answers, style, patterns, tone, final_text, edited, client_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(
          now,
          action,
          p.profile.role,
          JSON.stringify(p.answers.map((a) => a.label)),
          JSON.stringify(p.answers),
          JSON.stringify(p.style),
          JSON.stringify(patterns),
          tone,
          String(body.finalText || "").slice(0, 3500),
          body.edited ? 1 : 0,
          cid
        )
    );
  }
  await db.batch(stmts);
  return json({ ok: true, stored: consent });
}

let statsCache = { at: 0, data: null };
async function stats(env) {
  if (statsCache.data && Date.now() - statsCache.at < 5000) return json(statsCache.data);
  const db = await getDb(env);
  const data = { ok: true, generated: 0, copied: 0, later: 0, reported: 0, latest: [] };
  if (db) {
    const [ev, rc, latest] = await db.batch([
      db.prepare("SELECT type, COUNT(*) AS n FROM events GROUP BY type"),
      db.prepare("SELECT COUNT(*) AS n FROM reports WHERE hidden = 0"),
      // 会場スクリーンに出すのは「名前を出してOK」の人の名前だけ（本文は出さない）
      db.prepare("SELECT name, created_at FROM reports WHERE hidden = 0 AND screen_ok = 1 ORDER BY created_at DESC LIMIT 8"),
    ]);
    for (const r of ev.results || []) {
      if (r.type === "generate") data.generated = r.n;
      if (r.type === "copy") data.copied = r.n;
      if (r.type === "later") data.later = r.n;
    }
    data.reported = (rc.results && rc.results[0] && rc.results[0].n) || 0;
    data.latest = (latest.results || []).map((r) => ({ name: r.name, at: r.created_at }));
  }
  statsCache = { at: Date.now(), data };
  return json(data);
}

// ---------- 「投稿したで！」の報告 ----------
async function report(request, env, ctx) {
  const body = await readJson(request, 20000);
  if (!body) return json({ ok: false, code: "input", message: "入力が読めませんでした" }, 400);
  const cid = String(body.clientId || "").slice(0, 64);
  if (!cid) return json({ ok: false, code: "input", message: "端末IDがありません" }, 400);
  const ip = request.headers.get("cf-connecting-ip") || "local";
  if (limited(`r:${cid}`, 12, 60000) || limited(`ri:${ip}`, 600, 60000)) return json({ ok: false, code: "rate" }, 429);
  const name = cleanName(body.name);
  if (!name) return json({ ok: false, code: "name", message: "名前を入れてください" }, 400);
  const u = extractLinkedInUrl(body.url);
  if (u.error) return json({ ok: false, code: "url", message: "LinkedInのリンクではないようです" }, 400);
  const source = body.source === "self" ? "self" : "app";
  const text = String(body.body || "").replace(/\r\n?/g, "\n").trim().slice(0, 3500);
  if (!u.url && !text) return json({ ok: false, code: "empty", message: "リンクか本文のどちらかを入れてください" }, 400);
  const tone = TONE_IDS.includes(body.tone) ? body.tone : "";
  const screenOk = body.screenOk === false ? 0 : 1;
  const db = await getDb(env);
  if (!db) return json({ ok: false, code: "no_db", message: "保存先（データベース）が未設定です" }, 500);
  const now = Date.now();
  await db
    .prepare(
      `INSERT INTO reports (id, created_at, updated_at, client_id, name, url, body, source, tone, screen_ok)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(client_id) DO UPDATE SET updated_at = excluded.updated_at, name = excluded.name, url = excluded.url,
         body = excluded.body, source = excluded.source, tone = excluded.tone, screen_ok = excluded.screen_ok`
    )
    .bind(crypto.randomUUID(), now, now, cid, name, u.url || "", text, source, tone, screenOk)
    .run();
  const row = await db.prepare("SELECT id, created_at FROM reports WHERE client_id = ?").bind(cid).first();
  if (row && row.created_at === now) logEvent(env, ctx, "report", { source, hasUrl: !!u.url });
  statsCache = { at: 0, data: null };
  return json({ ok: true, id: row ? row.id : "", createdAt: row ? row.created_at : now, url: u.url || "" });
}

// ---------- パネラー用 ----------
// 鍵は運営の合言葉から作る（合言葉を変えると、パネラー用リンクも変わる）
let judgeKeyCache = { pass: null, key: null };
async function judgeKey(env) {
  const pass = String(env.ADMIN_PASSCODE || "");
  if (!pass) return null;
  if (judgeKeyCache.pass === pass) return judgeKeyCache.key;
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey("raw", enc.encode(pass), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode("tsukuttaroka-judge-v1")));
  let bin = "";
  for (const b of sig) bin += String.fromCharCode(b);
  const key = btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "").slice(0, 24);
  judgeKeyCache = { pass, key };
  return key;
}
async function judgeOk(request, env) {
  const want = await judgeKey(env);
  return !!want && safeEqual(want, String(request.headers.get("x-judge-key") || ""));
}
const cleanJudge = (s) => cleanName(s).slice(0, 30);

async function judgeFeed(env, url) {
  const db = await getDb(env);
  if (!db) return json({ ok: false, code: "no_db", message: "データベースが未設定です" }, 500);
  const j = cleanJudge(url.searchParams.get("j"));
  const since = Math.max(0, Number(url.searchParams.get("since")) || 0);
  const [rows, stars, picks] = await db.batch([
    db.prepare("SELECT * FROM reports WHERE updated_at > ? ORDER BY created_at DESC LIMIT 500").bind(since),
    db.prepare("SELECT report_id FROM stars WHERE judge = ?").bind(j),
    db.prepare("SELECT judge, report_id FROM stars"),
  ]);
  const pickMap = {};
  for (const s of picks.results || []) (pickMap[s.report_id] = pickMap[s.report_id] || []).push(s.judge);
  const items = (rows.results || []).map((r) =>
    r.hidden
      ? { id: r.id, hidden: true, updatedAt: r.updated_at }
      : {
          id: r.id,
          name: r.name,
          url: r.url,
          body: r.body,
          source: r.source,
          tone: r.tone,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        }
  );
  return json({ ok: true, now: Date.now(), items, stars: (stars.results || []).map((r) => r.report_id), picks: pickMap });
}

async function judgeStar(request, env) {
  const body = await readJson(request);
  const j = cleanJudge(body && body.j);
  const id = String((body && body.id) || "").slice(0, 64);
  if (!j || !id) return json({ ok: false, code: "input" }, 400);
  if (limited(`j:${j}`, 120, 60000)) return json({ ok: false, code: "rate" }, 429);
  const db = await getDb(env);
  if (!db) return json({ ok: false, code: "no_db" }, 500);
  if (body.on) {
    await db.prepare("INSERT OR IGNORE INTO stars (judge, report_id, created_at) VALUES (?, ?, ?)").bind(j, id, Date.now()).run();
  } else {
    await db.prepare("DELETE FROM stars WHERE judge = ? AND report_id = ?").bind(j, id).run();
  }
  return json({ ok: true, on: !!body.on });
}

async function health(env) {
  const s = await readSettings(env, true);
  return json({
    ok: true,
    version: VERSION,
    hasKey: !!env.GEMINI_API_KEY,
    hasPasscode: !!env.ADMIN_PASSCODE,
    db: !!(await getDb(env)),
    model: env.GEMINI_MODEL || "gemini-3.8-flash",
    fallback: env.GEMINI_FALLBACK_MODEL || "gemini-flash-lite-latest",
    style: env.GEMINI_API_STYLE || "interactions",
    generation: s.generation === "off" ? "off" : "on",
  });
}

// ---------- 運営用 ----------
function safeEqual(want, got) {
  if (!want || got.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ got.charCodeAt(i);
  return diff === 0;
}
function adminOk(request, env) {
  return safeEqual(String(env.ADMIN_PASSCODE || ""), String(request.headers.get("x-admin-passcode") || ""));
}

async function adminSummary(env) {
  const db = await getDb(env);
  const s = await readSettings(env, true);
  const out = {
    ok: true,
    db: !!db,
    hasKey: !!env.GEMINI_API_KEY,
    model: env.GEMINI_MODEL || "gemini-3.8-flash",
    fallback: env.GEMINI_FALLBACK_MODEL || "gemini-flash-lite-latest",
    generation: s.generation === "off" ? "off" : "on",
    counts: { generate: 0, refine: 0, copy: 0, later: 0, error: 0, report: 0 },
    posts: 0,
    topCards: [],
    tones: {},
    recentErrors: [],
    modes: {},
    people: [],
  };
  if (!db) return json(out);
  const [cnt, posts, gens, picks, errs, reps, repNames] = await db.batch([
    db.prepare("SELECT type, COUNT(*) AS n FROM events GROUP BY type"),
    db.prepare("SELECT COUNT(*) AS n FROM posts"),
    db.prepare("SELECT detail FROM events WHERE type = 'generate' ORDER BY id DESC LIMIT 3000"),
    db.prepare("SELECT detail FROM events WHERE type IN ('copy', 'later') ORDER BY id DESC LIMIT 3000"),
    db.prepare("SELECT created_at, detail FROM events WHERE type = 'error' ORDER BY id DESC LIMIT 20"),
    db.prepare("SELECT COUNT(*) AS n FROM reports WHERE hidden = 0"),
    db.prepare("SELECT name, created_at FROM reports WHERE hidden = 0"),
  ]);
  for (const r of cnt.results || []) if (r.type in out.counts && r.type !== "report") out.counts[r.type] = r.n;
  out.counts.report = (reps.results && reps.results[0] && reps.results[0].n) || 0;
  out.posts = (posts.results && posts.results[0] && posts.results[0].n) || 0;
  const cardCount = {};
  for (const r of gens.results || []) {
    for (const label of safeParse(r.detail).cards || []) cardCount[label] = (cardCount[label] || 0) + 1;
  }
  out.topCards = Object.entries(cardCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, n]) => ({ label, n }));
  for (const r of picks.results || []) {
    const t = safeParse(r.detail).tone;
    if (t) out.tones[t] = (out.tones[t] || 0) + 1;
  }
  // 書き方（おまかせ・はじめて・石坂さん風）と、アプリを使った人（最初の画面で入れた名前）
  const people = new Map();
  const person = (name) => {
    const n = cleanName(name);
    const k = n && nameKey(n);
    if (!k) return null;
    if (!people.has(k)) people.set(k, { name: n, made: 0, copied: 0, reported: false, followed: false });
    return people.get(k);
  };
  for (const r of gens.results || []) {
    const d = safeParse(r.detail);
    const m = d.mode || "";
    out.modes[m] = (out.modes[m] || 0) + 1;
    const pp = person(d.name);
    if (pp) {
      pp.made += 1;
      if (d.followed === true) pp.followed = true;
    }
  }
  for (const r of picks.results || []) {
    const pp = person(safeParse(r.detail).name);
    if (pp) pp.copied += 1;
  }
  for (const r of repNames.results || []) {
    const pp = person(r.name);
    if (pp) pp.reported = true;
  }
  out.people = [...people.values()].sort((a, b) => a.name.localeCompare(b.name, "ja"));
  out.followed = out.people.filter((x) => x.followed).length;
  out.recentErrors = (errs.results || []).map((r) => {
    const d = safeParse(r.detail);
    // 端末からの記録は、端末が送ってきた説明をそのまま出す。写真で失敗したものは、写真なしで作り直したことを添える
    const where = String(d.where || "");
    const hint = where.startsWith("client:") ? d.message || d.reason || "" : explainFailure(d) + (where.endsWith(":photo") ? "（→ 写真なしで作り直した）" : "");
    return { at: jst(r.created_at), ...d, hint };
  });
  return json(out);
}

async function adminPosts(env, url) {
  const db = await getDb(env);
  if (!db) return json({ ok: true, rows: [], total: 0 });
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 50));
  const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);
  const { results } = await db.prepare("SELECT * FROM posts ORDER BY id DESC LIMIT ? OFFSET ?").bind(limit, offset).all();
  const rows = (results || []).map((r) => ({
    id: r.id,
    at: jst(r.created_at),
    action: r.action,
    role: r.role || "",
    cards: safeParse(r.cards, []),
    answers: safeParse(r.answers, []),
    style: safeParse(r.style, {}),
    patterns: safeParse(r.patterns, {}),
    tone: r.tone,
    finalText: r.final_text,
    edited: !!r.edited,
  }));
  return json({ ok: true, rows });
}

async function adminExport(env) {
  const db = await getDb(env);
  const header = ["日時", "行動", "立場", "ネタ", "回答", "文体", "関西弁", "長さ", "絵文字", "入れたい一言", "選んだパターン", "自分で直した", "投稿文", "エモい案", "ユーモア案", "学び案"];
  const lines = [header];
  if (db) {
    const { results } = await db.prepare("SELECT * FROM posts ORDER BY id ASC").all();
    const toneName = { emo: "エモい", humor: "ユーモア", straight: "学び" };
    for (const r of results || []) {
      const st = safeParse(r.style, {});
      const pt = safeParse(r.patterns, {});
      const answers = safeParse(r.answers, [])
        .map((a) => `【${a.label}】${[a.chips && a.chips.length ? a.chips.join("／") : "", a.text].filter(Boolean).join("｜")}`)
        .join("\n");
      lines.push([
        jst(r.created_at),
        r.action === "later" ? "あとで投稿" : "コピーしてLinkedIn",
        r.role || "",
        safeParse(r.cards, []).join("、"),
        answers,
        st.formality || "",
        st.kansai || "",
        st.length || "",
        st.emoji || "",
        st.phrase || "",
        toneName[r.tone] || "",
        r.edited ? "はい" : "",
        r.final_text || "",
        pt.emo || "",
        pt.humor || "",
        pt.straight || "",
      ]);
    }
  }
  const csv = "﻿" + lines.map((cols) => cols.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const name = `tsukuttaroka_${jst(new Date().toISOString()).replace(/[/: ]/g, "")}.csv`;
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${name}"`,
      "cache-control": "no-store",
    },
  });
}

async function adminSettings(request, env) {
  const body = await readJson(request);
  const db = await getDb(env);
  if (!db) return json({ ok: false, code: "no_db", message: "データベースが未設定です" }, 500);
  if (body && (body.generation === "on" || body.generation === "off")) {
    await db
      .prepare("INSERT INTO settings (key, value) VALUES ('generation', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
      .bind(body.generation)
      .run();
  }
  settingsCache.at = 0;
  const s = await readSettings(env, true);
  return json({ ok: true, generation: s.generation === "off" ? "off" : "on" });
}

async function adminTest(env) {
  if (!env.GEMINI_API_KEY) return json({ ok: false, hint: "GEMINI_API_KEY が未設定です（いまはサンプル文で動いています）" });
  const r = await callAI(env, {
    system: "あなたは動作確認用のアシスタントです。",
    input: '「ほな、いこか」という意味の短い関西弁を1つ、{"text":"…"} のJSONだけで返して。',
    schema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
    validate: (j) => (j && typeof j.text === "string" && j.text ? j.text : null),
  });
  if (r.ok) return json({ ok: true, model: r.model, style: r.style, ms: r.ms, text: r.value });
  return json({ ok: false, model: r.model, status: r.status, reason: r.reason, hint: explainFailure(r) });
}

async function adminWipe(request, env) {
  const body = await readJson(request);
  if (!body || body.confirm !== "DELETE") return json({ ok: false, code: "confirm" }, 400);
  const db = await getDb(env);
  if (!db) return json({ ok: false, code: "no_db" }, 500);
  // 名簿（settings）は残す。消すのはリハーサルのデータだけ
  await db.batch([db.prepare("DELETE FROM posts"), db.prepare("DELETE FROM events"), db.prepare("DELETE FROM reports"), db.prepare("DELETE FROM stars")]);
  statsCache = { at: 0, data: null };
  return json({ ok: true });
}

// ---------- 運営用：投稿報告 ----------
async function readRoster(env) {
  const s = await readSettings(env, true);
  const list = safeParse(s.roster, []);
  return Array.isArray(list) ? list.filter((x) => typeof x === "string" && x) : [];
}

async function adminReports(env) {
  const db = await getDb(env);
  if (!db) return json({ ok: true, rows: [], roster: null, rosterText: "" });
  const [rows, stars] = await db.batch([
    db.prepare("SELECT * FROM reports ORDER BY created_at DESC LIMIT 1000"),
    db.prepare("SELECT judge, report_id FROM stars ORDER BY created_at ASC"),
  ]);
  const byReport = {};
  for (const s of stars.results || []) (byReport[s.report_id] = byReport[s.report_id] || []).push(s.judge);
  const list = (rows.results || []).map((r) => ({
    id: r.id,
    at: jst(new Date(r.created_at).toISOString()),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    name: r.name,
    url: r.url,
    body: r.body,
    source: r.source,
    tone: r.tone,
    screenOk: !!r.screen_ok,
    hidden: !!r.hidden,
    stars: byReport[r.id] || [],
  }));
  const roster = await readRoster(env);
  let rosterInfo = null;
  if (roster.length) {
    const rosterKeys = new Set(roster.map(nameKey));
    const reported = new Set(list.filter((r) => !r.hidden).map((r) => nameKey(r.name)));
    for (const r of list) r.inRoster = rosterKeys.has(nameKey(r.name));
    const missing = roster.filter((n) => !reported.has(nameKey(n)));
    rosterInfo = { total: roster.length, reported: roster.length - missing.length, missing };
  }
  return json({ ok: true, rows: list, roster: rosterInfo, rosterText: roster.join("\n") });
}

async function adminReportHide(request, env) {
  const body = await readJson(request);
  const id = String((body && body.id) || "").slice(0, 64);
  if (!id) return json({ ok: false, code: "input" }, 400);
  const db = await getDb(env);
  if (!db) return json({ ok: false, code: "no_db" }, 500);
  // updated_at を進めると、パネラーの画面からも消える（戻すと、また出る）
  await db.prepare("UPDATE reports SET hidden = ?, updated_at = ? WHERE id = ?").bind(body.hidden ? 1 : 0, Date.now(), id).run();
  statsCache = { at: 0, data: null };
  return json({ ok: true });
}

async function adminJudgeLink(env) {
  const key = await judgeKey(env);
  return json({ ok: true, path: `/judge?k=${encodeURIComponent(key)}` });
}

async function adminRoster(request, env) {
  const body = await readJson(request, 60000);
  const db = await getDb(env);
  if (!db) return json({ ok: false, code: "no_db" }, 500);
  const seen = new Set();
  const names = [];
  for (const raw of String((body && body.text) || "").split(/\r?\n|,|、|\t/)) {
    const n = cleanName(raw);
    if (!n || seen.has(nameKey(n))) continue;
    seen.add(nameKey(n));
    names.push(n);
    if (names.length >= 500) break;
  }
  await db
    .prepare("INSERT INTO settings (key, value) VALUES ('roster', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .bind(JSON.stringify(names))
    .run();
  settingsCache.at = 0;
  return json({ ok: true, count: names.length });
}

async function adminExportReports(env) {
  const db = await getDb(env);
  const header = ["報告日時", "名前", "作り方", "投稿のリンク", "本文", "スクリーンに名前", "非表示", "★を付けたパネラー"];
  const lines = [header];
  if (db) {
    const [rows, stars] = await db.batch([
      db.prepare("SELECT * FROM reports ORDER BY created_at ASC"),
      db.prepare("SELECT judge, report_id FROM stars ORDER BY created_at ASC"),
    ]);
    const byReport = {};
    for (const s of stars.results || []) (byReport[s.report_id] = byReport[s.report_id] || []).push(s.judge);
    for (const r of rows.results || []) {
      lines.push([
        jst(new Date(r.created_at).toISOString()),
        r.name,
        r.source === "self" ? "自分で書いた" : "アプリ",
        r.url || "",
        r.body || "",
        r.screen_ok ? "OK" : "",
        r.hidden ? "非表示" : "",
        (byReport[r.id] || []).join("、"),
      ]);
    }
  }
  const csv = "\ufeff" + lines.map((cols) => cols.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const name = `tsukuttaroka_reports_${jst(new Date().toISOString()).replace(/[/: ]/g, "")}.csv`;
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${name}"`,
      "cache-control": "no-store",
    },
  });
}

// ---------- 小道具 ----------
function safeParse(s, fallback = {}) {
  try {
    const v = JSON.parse(s);
    return v === null || v === undefined ? fallback : v;
  } catch {
    return fallback;
  }
}
function jst(iso) {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const d = new Date(t + 9 * 3600 * 1000);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}/${p(d.getUTCMonth() + 1)}/${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}
