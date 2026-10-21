/*
 * 投稿、つくったろか。── サーバー（Cloudflare Workers）
 * 画面のファイルは public/ から自動で配信。ここは /api/ だけを担当する。
 *
 * 参加者用   POST /api/generate  3パターン生成
 *           POST /api/cal      Googleカレンダー（秘密のiCalアドレス）の予定を取ってくる。URLは保存しない
 *           POST /api/style    過去の投稿から「書き方の癖」を分析する（1回だけ。結果は端末に保存）
 *           POST /api/refine    1パターンだけ書き直し
 *           POST /api/submit    「コピー」「あとで」の記録（共有ONのときだけ中身も保存）
 *           GET  /api/stats     件数（/qr の表示用）
 *           GET  /api/health    動作確認（version で、いま公開中の版が分かる）
 *           GET  /api/event     イベント（?e=ID）の名前・ハッシュタグ・メンション・タイムスケジュールなど。あいことばは無い（URLを開いた人はだれでも使える）
 *           POST /api/clientlog 端末で起きた失敗の記録（運営ページの「最近のエラー」に出る）
 *           POST /api/hit       ページを開いた回数（運営ページの「利用状況」に出る。中身は送らない）
 * 運営用     /api/admin/*        合言葉なし（URLを知っている人はだれでも使える）
 * 「投稿したで！」の報告・パネラーの★・受付の停止は 2026-10-22 になくした（10/6 の報告と★は /archive で見るだけ）
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
  PROMPT_DEFAULTS,
  PROMPT_KEYS,
  HEADLINES_SCHEMA,
  ABOUT_SCHEMA,
  normalizeHeadlines,
  normalizeAbout,
  buildPartInput,
  buildPartRefineInput,
  HEADLINE_ACTIONS,
  ABOUT_ACTIONS,
} from "./ai.js";
import { geminiJSON, explainFailure, parseJsonLoose, DEFAULT_BASE } from "./gemini.js";
import { cleanName, nameKey } from "./report.js";

const VERSION = "2026-10-22.lscw-8";
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
  if (p === "/api/stats" && m === "GET") return stats(env, url);
  if (p === "/api/generate" && m === "POST") return generate(request, env, ctx);
  if (p === "/api/checkkey" && m === "POST") return checkKey(request);
  if (p === "/api/clientlog" && m === "POST") return clientLog(request, env, ctx);
  if (p === "/api/hit" && m === "POST") return hit(request, env, ctx);
  if (p === "/api/event" && m === "GET") return eventPublic(env, url);
  if (p === "/api/cal" && m === "POST") return calEvents(request, env);
  if (p === "/api/style" && m === "POST") return styleProfile(request, env);
  if (p === "/api/refine" && m === "POST") return refine(request, env, ctx);
  if (p === "/api/submit" && m === "POST") return submit(request, env);
  // 運営用（合言葉なし。URLを知っている人はだれでも使える）
  if (p.startsWith("/api/admin/")) {
    if (p === "/api/admin/summary" && m === "GET") return adminSummary(env, url);
    if (p === "/api/admin/posts" && m === "GET") return adminPosts(env, url);
    if (p === "/api/admin/export" && m === "GET") return adminExport(env, url);
    if (p === "/api/admin/archives" && m === "GET") return adminArchives(env);
    if (p === "/api/admin/archive" && m === "POST") return adminArchiveCreate(request, env);
    if (p === "/api/admin/test" && m === "POST") return adminTest(env);
    if (p === "/api/admin/wipe" && m === "POST") return adminWipe(request, env);
    if (p === "/api/admin/reports" && m === "GET") return adminReports(env, url);
    if (p === "/api/admin/export-reports" && m === "GET") return adminExportReports(env, url);
    if (p === "/api/admin/events" && m === "GET") return adminEvents(env);
    if (p === "/api/admin/event" && m === "POST") return adminEventSave(request, env);
    if (p === "/api/admin/event-delete" && m === "POST") return adminEventDelete(request, env);
    if (p === "/api/admin/stats" && m === "GET") return adminStats(env, url);
    if (p === "/api/admin/prompts" && m === "GET") return adminPrompts(env);
    if (p === "/api/admin/prompt" && m === "POST") return adminPromptSave(request, env);
    if (p === "/api/admin/prompt-test" && m === "POST") return adminPromptTest(request, env);
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
    await seedEvents(env.DB).catch((e) => console.error("seed", e));
  }
  return env.DB;
}

// 最初の1回だけ、LSCW のイベント（/lscw のページが使う）を作っておく。あいことばなし＝URLを開いた人はサーバーのキーで作れる
// 運営ページで消したり直したりしたら、それが優先（もう作り直さない）
const LSCW_NOTE = `この投稿は、学生向けのキャリアイベント「LinkedIn Student Career Week 2026 Autumn」（略してLSCW。オンラインは10/26〜10/30、会場は10/31 東京・日比谷）に参加した学生が書くものです。
・イベント名は「LinkedIn Student Career Week」と正しく書く。略すときは「LSCW」。
・企業名・登壇者名・セッション名は、回答に書かれたものだけを使う。
・選考や内定の結果、企業の評判、イベントの規模（参加人数・社数）は書かない。
・学生らしい等身大の言葉で書く。就活の不安や迷いがあれば、正直に書きつつ、前向きな次の一歩につなげる。
・「私の夢」の回答があれば、夢と今日の学びや出会いを、無理なくつなげて書く。`;
async function seedEvents(db) {
  const r = await db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('seed.lscw', ?)").bind(String(Date.now())).run();
  if (!(r && r.meta && r.meta.changes)) return;
  const data = { name: "LinkedIn Student Career Week 2026 Autumn", hashtags: [], key: "", cheerAlways: true, active: true, preset: "lscw", aiNote: LSCW_NOTE };
  await db.prepare("INSERT OR IGNORE INTO event_settings (id, data, updated_at) VALUES ('lscw', ?, ?)").bind(JSON.stringify(data), Date.now()).run();
}
// 利用状況のための、端末の目印（端末IDの先頭だけ。名前などは入れない）
const uidOf = (v) => String(v || "").replace(/[^A-Za-z0-9-]/g, "").slice(0, 16);
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
  // 写真が多いほど、AIの返事に時間がかかる。その分だけ待つ
  const primary = { model: env.GEMINI_MODEL || "gemini-3.8-flash", style: styleName, timeoutMs: Math.min(45000, 22000 + images.length * 2500) };
  const fallback = {
    model: env.GEMINI_FALLBACK_MODEL || "gemini-flash-lite-latest",
    style: env.GEMINI_FALLBACK_STYLE || styleName,
    timeoutMs: Math.min(35000, 16000 + images.length * 2000),
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

// ---------- AIへの指示文（運営ページで書きかえられる。settings の prompt.system など） ----------
const PROMPT_MAX = 20000;
// 出力の形（JSON）の説明が消されていたら、最後に足す（書きかえで生成が止まらないように）
const OUTPUT_TAIL = {
  system: '\n\n# 出力\n次のJSONだけを返す。前後に説明を書かない。\n{"patterns":[{"tone":"emo","body":"…"}]}',
  profile: '\n\n# 出力\n次のJSONだけを返す。前後に説明を書かない。\n{"headlines":["…","…","…"],"about":"…"}',
  headline: '\n\n# 出力\n次のJSONだけを返す。前後に説明を書かない。\n{"headlines":["…","…","…","…","…"]}',
  about: '\n\n# 出力\n次のJSONだけを返す。前後に説明を書かない。\n{"about":"…"}',
};
const OUTPUT_MARK = { system: '"patterns"', profile: '"headlines"', headline: '"headlines"', about: '"about"' };
function finishPrompt(key, text) {
  const t = String(text || "").trim();
  if (!t) return PROMPT_DEFAULTS[key];
  return OUTPUT_MARK[key] && !t.includes(OUTPUT_MARK[key]) ? t + OUTPUT_TAIL[key] : t;
}
async function promptsOf(env) {
  const s = await readSettings(env);
  const out = {};
  for (const k of PROMPT_KEYS) out[k] = finishPrompt(k, s[`prompt.${k}`]);
  return out;
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

// キーを決める。サーバーのキー（GEMINI_API_KEY）は、イベント（あいことばが合う・あいことばなし）経由のときだけ使う
// （キーなしで直接たたかれても、サーバーのキーは使わせない。どこにもキーがないときだけサンプル文）
const NO_KEY_MSG = "作るには、イベントのページ（QR）から開くか、じぶんのAIのキーを紐づけてな";
// 写真つきのとき、生成と書き直しは本文が大きくなる（写真10枚まで＋回答）
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
    u: uidOf(cid),
    event: cleanEventId(body.event),
  });
  return json({ ok: true });
}

// ページを開いた記録（利用状況。端末の目印・ページ・イベントだけ）
async function hit(request, env, ctx) {
  const body = await readJson(request, 2000);
  if (!body) return json({ ok: false, code: "input" }, 400);
  const cid = String(body.clientId || "").slice(0, 64);
  const ip = request.headers.get("cf-connecting-ip") || "local";
  if (limited(`h:${cid}`, 10, 60000) || limited(`hi:${ip}`, 1200, 60000)) return json({ ok: false, code: "rate" }, 429);
  logEvent(env, ctx, "view", { u: uidOf(cid), page: oneLine(body.page, 20), preset: oneLine(body.preset, 20), event: cleanEventId(body.event) });
  return json({ ok: true });
}

// ---------- イベント（運営ページで作る。参加者は ?e=イベントID か、専用ページ（/lscw など）で開く） ----------
// あいことばのあるイベント：あいことばが合えば、イベントのAIキー（なければサーバーのキー）で作れる。参加者がキーを作らなくていい
// あいことばのないイベント：URLを開いた人は、だれでもイベントのAIキー（なければサーバーのキー）で作れる
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
const oneLine = (v, n) => String(v ?? "").replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim().slice(0, n);
const multiLine = (v, n) => String(v ?? "").replace(/\r\n?/g, "\n").replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, " ").trim().slice(0, n);
const httpsUrl = (v) => {
  try {
    const u = new URL(String(v || "").trim());
    return u.protocol === "https:" ? u.toString().slice(0, 500) : "";
  } catch {
    return "";
  }
};
const hexColor = (v) => (/^#[0-9A-Fa-f]{6}$/.test(String(v || "").trim()) ? String(v).trim().toUpperCase() : "");
// メンション：1行に1つ「表示名」か「表示名 | 打つ文字」（例：LinkedIn | @LinkedIn）。5つまで
function cleanMentions(v) {
  const lines = Array.isArray(v) ? v.map((m) => (m && typeof m === "object" ? `${m.name || ""}|${m.typeHint || ""}` : m)) : String(v || "").split(/\r?\n/);
  const out = [];
  for (const line of lines) {
    const [a, b] = String(line || "").split(/[|｜]/);
    const name = oneLine(a, 40).replace(/^[@＠]+/, "");
    if (!name || out.some((m) => m.name === name)) continue;
    const hint = oneLine(b, 40);
    out.push({ name, typeHint: hint ? (/^[@＠]/.test(hint) ? hint : `@${hint}`) : `@${name}` });
    if (out.length >= 5) break;
  }
  return out;
}
// タイムスケジュール：「## 日の見出し」の行と、「時間 | タイトル | 補足」の行。40行まで
function parseSchedule(v) {
  if (Array.isArray(v)) return v.slice(0, 40).map((x) => ({ day: oneLine(x && x.day, 40), time: oneLine(x && x.time, 20), title: oneLine(x && x.title, 60), note: oneLine(x && x.note, 120) })).filter((x) => x.title);
  const out = [];
  let day = "";
  for (const raw of String(v || "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const h = line.match(/^[#＃]{1,3}\s*(.+)$/);
    if (h) {
      day = oneLine(h[1], 40);
      continue;
    }
    const parts = line.split(/[|｜]/).map((x) => x.trim());
    const [time, title, note] = parts.length >= 2 ? parts : ["", parts[0], ""];
    if (!title) continue;
    out.push({ day, time: oneLine(time, 20), title: oneLine(title, 60), note: oneLine(note, 120) });
    if (out.length >= 40) break;
  }
  return out;
}
const scheduleText = (list) => {
  let day = null;
  const lines = [];
  for (const it of list || []) {
    if (it.day !== day) {
      day = it.day;
      if (day) lines.push(`## ${day}`);
    }
    lines.push([it.time, it.title, it.note].filter((x, i) => x || i < 2).join(" | "));
  }
  return lines.join("\n");
};
const INFO_KEYS = ["title", "when", "place", "mapUrl", "siteUrl", "siteLabel", "note"];
function cleanInfo(v) {
  const src = v && typeof v === "object" ? v : {};
  const out = {};
  for (const k of INFO_KEYS) {
    const val = /Url$/.test(k) ? httpsUrl(src[k]) : oneLine(src[k], k === "note" ? 200 : 120);
    if (val) out[k] = val;
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
const eventActive = (ev) => !!ev && ev.active !== false;
const eventOffError = () => json({ ok: false, code: "no_event", message: "このイベントは、いまは使えません" }, 403);
// 生成のヘッダー（x-event）から、使うキーを決める。イベントのURLを開いた人はだれでも、イベントのキー（なければサーバーのキー）で作れる
async function eventKeyOf(request, env) {
  const id = cleanEventId(request.headers.get("x-event"));
  if (!id) return NO_EVENT;
  const ev = await readEvent(env, id);
  if (!eventActive(ev)) return { ...NO_EVENT, id, bad: true };
  return { key: ev.key || env.GEMINI_API_KEY || null, id };
}
// イベントごとのAIへの情報：概要（会場の様子を理解するための参考）＋追加の指示。自分のキーで作る人にも効く。本文の event で受け取る
async function eventNoteOf(env, id) {
  const ev = await readEvent(env, cleanEventId(id)).catch(() => null);
  if (!eventActive(ev)) return "";
  const overview = multiLine(ev.overview, 3000);
  const note = multiLine(ev.aiNote, 1500);
  return [overview && `＜イベントの概要（参加者の回答を正しく理解するための参考）＞\n${overview}`, note && (overview ? `＜運営からの指示＞\n${note}` : note)].filter(Boolean).join("\n\n");
}
// 参加者の画面に出す機能（ネタ帳・カレンダー・じぶんの書き方）。決めていなければ null（質問セットの初期のまま）
const FEATURE_KEYS = ["notes", "calendar", "voice"];
function cleanFeatures(v) {
  if (!v || typeof v !== "object") return null;
  const out = {};
  for (const k of FEATURE_KEYS) if (typeof v[k] === "boolean") out[k] = v[k];
  return Object.keys(out).length ? out : null;
}
// 投稿文に入れてよいイベント名（イベントのページから作ったときだけ）
async function eventNameOf(env, id) {
  const ev = await readEvent(env, cleanEventId(id)).catch(() => null);
  return eventActive(ev) ? oneLine(ev.name, 60) : "";
}
// 参加者の画面用（キーは返さない）
async function eventPublic(env, url) {
  const ev = await readEvent(env, cleanEventId(url.searchParams.get("e")));
  if (!eventActive(ev)) return json({ ok: false, code: "no_event", message: "このイベントは、いまは使えません" }, 404);
  const hasKey = !!(ev.key || env.GEMINI_API_KEY);
  return json({
    ok: true,
    event: {
      id: ev.id,
      name: ev.name || "",
      hashtags: ev.hashtags || [],
      cheerAlways: !!ev.cheerAlways,
      preset: ev.preset || "",
      hasKey,
      open: hasKey,
      mentions: ev.mentions || [],
      mentionInText: ev.mentionInText !== false,
      followUrl: ev.followUrl || "",
      followName: ev.followName || "",
      followRequired: ev.followRequired === true,
      info: ev.info || {},
      schedule: ev.schedule || [],
      theme: ev.theme || null,
      features: ev.features || null,
    },
  });
}
// 運営ページ：イベントの一覧・作成・変更・削除（キーは末尾4文字だけ見せる）
function eventForAdmin(id, d, updatedAt) {
  return {
    id,
    name: d.name || "",
    hashtags: d.hashtags || [],
    keySet: !!d.key,
    keyTail: d.key ? String(d.key).slice(-4) : "",
    cheerAlways: !!d.cheerAlways,
    active: d.active !== false,
    preset: d.preset || "",
    mentions: d.mentions || [],
    mentionInText: d.mentionInText !== false,
    followUrl: d.followUrl || "",
    followName: d.followName || "",
    followRequired: d.followRequired === true,
    aiNote: d.aiNote || "",
    overview: d.overview || "",
    features: d.features || null,
    info: d.info || {},
    schedule: d.schedule || [],
    scheduleText: scheduleText(d.schedule || []),
    theme: d.theme || null,
    updatedAt,
  };
}
async function adminEvents(env) {
  const db = await getDb(env);
  if (!db) return json({ ok: false, code: "db", message: "データベースがありません" }, 503);
  const { results } = await db.prepare("SELECT id, data, updated_at FROM event_settings ORDER BY updated_at DESC").all();
  const events = (results || []).map((r) => eventForAdmin(r.id, safeParse(r.data), r.updated_at));
  return json({ ok: true, events, serverKey: !!env.GEMINI_API_KEY });
}
async function adminEventSave(request, env) {
  const body = await readJson(request, 40000);
  const id = cleanEventId(body && body.id);
  if (!id) return json({ ok: false, code: "input", message: "イベントIDは、英小文字・数字・ハイフンで40字まで（例：lscw2026）" }, 400);
  const db = await getDb(env);
  if (!db) return json({ ok: false, code: "db", message: "データベースがありません" }, 503);
  const prev = (await readEvent(env, id, true)) || {};
  const str = (v, n) => String(v ?? "").replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, n);
  const followUrl = httpsUrl(body.followUrl);
  if (String(body.followUrl || "").trim() && !followUrl) return json({ ok: false, code: "input", message: "フォローしてほしいページのURLは https:// から始まるURLにしてください" }, 400);
  const ground = hexColor(body.theme && body.theme.ground);
  const accent = hexColor(body.theme && body.theme.accent);
  const data = {
    name: str(body.name, 60),
    hashtags: cleanHashtags(body.hashtags),
    key: body.clearKey ? "" : str(body.key, 300) || prev.key || "",
    cheerAlways: body.cheerAlways === true,
    active: body.active !== false,
    preset: str(body.preset, 20),
    mentions: cleanMentions(body.mentions),
    mentionInText: body.mentionInText !== false,
    followUrl,
    followName: oneLine(body.followName, 40),
    followRequired: !!followUrl && body.followRequired === true,
    aiNote: multiLine(body.aiNote, 1500),
    overview: multiLine(body.overview, 3000),
    features: cleanFeatures(body.features),
    info: cleanInfo(body.info),
    schedule: parseSchedule(body.schedule),
    theme: ground || accent ? { ...(ground ? { ground, onGround: onColor(ground), onGroundSoft: onColor(ground) } : {}), ...(accent ? { accent, check: accent } : {}) } : null,
  };
  await db.prepare("INSERT INTO event_settings (id, data, updated_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at").bind(id, JSON.stringify(data), Date.now()).run();
  eventCache.delete(id);
  return json({ ok: true, event: eventForAdmin(id, data, Date.now()) });
}
// 地の色に合わせて、地の上の文字を白か黒にする（明るい地なら黒）
function onColor(hex) {
  const n = parseInt(hex.slice(1), 16);
  const lin = (c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return (1.05 / (L + 0.05)) >= ((L + 0.05) / 0.0573) ? "#FFFFFF" : "#121212";
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
  const cid = String(body.clientId || "").slice(0, 64);
  const ip = request.headers.get("cf-connecting-ip") || "local";
  if (limited(`c:${cid}`, 10, 60000) || limited(`i:${ip}`, 400, 60000)) return json({ ok: false, code: "rate" }, 429);
  const ukey = userKeyOf(request);
  const aiCfg = aiConfigOf(request);
  const ev = ukey || aiCfg ? NO_EVENT : await eventKeyOf(request, env);
  if (ev.bad) return eventOffError();
  const key = ukey || ev.key;

  const cards = p.answers.map((a) => a.label);
  const who = cleanName(body.name);
  const evId = ev.id || cleanEventId(body.event);
  const base = { u: uidOf(cid), event: evId, page: oneLine(body.page, 20), name: who, kind: p.kind, followed: body.followed === true };
  if (!key && !aiCfg) {
    if (env.GEMINI_API_KEY) return json({ ok: false, code: "no_key", message: NO_KEY_MSG }, 403);
    logEvent(env, ctx, "generate", { ...base, cards, sample: true, mode: p.mode });
    return json({ ok: true, sample: true });
  }
  const prompts = await promptsOf(env);
  p.eventNote = await eventNoteOf(env, evId);
  p.eventName = p.kind === "post" ? await eventNameOf(env, evId) : "";
  p.ishizakaStyle = prompts.ishizaka;
  // 見出しだけ（5案）／自己紹介だけ。先に決めた【条件】と回答から作る。写真は使わない
  if (p.kind === "headline" || p.kind === "about") {
    const isH = p.kind === "headline";
    const r = await callAI(env, { userKey: key, adv: aiCfg, system: isH ? prompts.headline : prompts.about, input: buildPartInput(p, p.kind), schema: isH ? HEADLINES_SCHEMA : ABOUT_SCHEMA, validate: isH ? normalizeHeadlines : normalizeAbout });
    if (!r.ok) {
      logEvent(env, ctx, "error", { where: p.kind, status: r.status, reason: r.reason, model: r.model, ownKey: !!ukey, u: base.u, event: evId });
      return json({ ok: false, code: "failed", message: ukey ? explainFailure(r) : "生成に失敗しました" }, 502);
    }
    logEvent(env, ctx, "generate", { ...base, cards, model: r.model, ms: r.ms, mode: p.kind, ownKey: !!(ukey || aiCfg) });
    return json({ ok: true, [isH ? "headlines" : "about"]: r.value, model: r.model });
  }
  // プロフィール文（見出し3案＋自己紹介。前の版の画面から）。写真は使わない
  if (p.kind === "profile") {
    const r = await callAI(env, { userKey: key, adv: aiCfg, system: prompts.profile, input: buildProfileInput(p), schema: PROFILE_SCHEMA, validate: normalizeProfile });
    if (!r.ok) {
      logEvent(env, ctx, "error", { where: "profile", status: r.status, reason: r.reason, model: r.model, ownKey: !!ukey, u: base.u, event: evId });
      return json({ ok: false, code: "failed", message: ukey ? explainFailure(r) : "生成に失敗しました" }, 502);
    }
    logEvent(env, ctx, "generate", { ...base, cards, model: r.model, ms: r.ms, mode: "profile", ownKey: !!(ukey || aiCfg) });
    return json({ ok: true, profile: r.value, model: r.model });
  }
  const opts = (imgs) => ({
    userKey: key,
    adv: aiCfg,
    system: prompts.system,
    input: buildUserInput({ ...p, photos: imgs.length }),
    images: imgs,
    schema: patternsSchema(patternCount(p.mode), p.tone),
    validate: (j) => normalizePatterns(j, p.style.phrase, patternCount(p.mode), p.tone),
  });
  let r = await callAI(env, opts(images));
  let photoSkipped = false;
  if (!r.ok && images.length && photoRetryable(r)) {
    logEvent(env, ctx, "error", { where: "generate:photo", status: r.status, reason: r.reason, model: r.model, photos: images.length, kb: imagesKb(images), message: String(r.message || "").slice(0, 160), u: base.u, event: evId });
    r = await callAI(env, opts([]));
    photoSkipped = r.ok;
  }
  if (!r.ok) {
    logEvent(env, ctx, "error", { where: "generate", status: r.status, reason: r.reason, model: r.model, ownKey: !!ukey, photos: images.length, kb: imagesKb(images), u: base.u, event: evId });
    return json({ ok: false, code: "failed", message: ukey ? explainFailure(r) : "生成に失敗しました" }, 502);
  }
  logEvent(env, ctx, "generate", { ...base, cards, model: r.model, ms: r.ms, mode: p.mode, photos: images.length, photoSkipped, ownKey: !!(ukey || aiCfg) });
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
  if (ev.bad) return eventOffError();
  const key = ukey || ev.key;
  if (!key) return json({ ok: false, code: "no_key", message: "先に、AIのキーを入れてな" }, 403);
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
  const part = p.kind === "headline" || p.kind === "about" ? p.kind : "";
  const isProfile = p.kind === "profile" || !!part;
  const images = isProfile ? [] : sanitizeImages(body.images);
  const tone = isProfile ? "emo" : TONE_IDS.includes(body.tone) ? body.tone : null;
  const ACTS = part === "headline" ? HEADLINE_ACTIONS : part === "about" ? ABOUT_ACTIONS : isProfile ? PROFILE_ACTIONS : REFINE_ACTIONS;
  const action = ACTS[body.action] ? body.action : null;
  const current = String(body.body || "").slice(0, isProfile ? 2600 : 1500);
  const ask = cleanRequest(body.request);
  if (!tone || !action || current.length < 10) return json({ ok: false, code: "input", message: "入力が足りません" }, 400);
  if (action === "custom" && !ask) return json({ ok: false, code: "input", message: "どう直すかを書いてください" }, 400);
  const cid = String(body.clientId || "").slice(0, 64);
  const ip = request.headers.get("cf-connecting-ip") || "local";
  if (limited(`c:${cid}`, 10, 60000) || limited(`i:${ip}`, 400, 60000)) return json({ ok: false, code: "rate" }, 429);
  const ukey = userKeyOf(request);
  const aiCfg = aiConfigOf(request);
  const ev = ukey || aiCfg ? NO_EVENT : await eventKeyOf(request, env);
  if (ev.bad) return eventOffError();
  const key = ukey || ev.key;
  if (!key && !aiCfg) {
    if (env.GEMINI_API_KEY) return json({ ok: false, code: "no_key", message: NO_KEY_MSG }, 403);
    return json({ ok: true, sample: true });
  }
  const evId = ev.id || cleanEventId(body.event);
  const prompts = await promptsOf(env);
  p.eventNote = await eventNoteOf(env, evId);
  p.eventName = p.kind === "post" ? await eventNameOf(env, evId) : "";
  p.ishizakaStyle = prompts.ishizaka;

  if (part) {
    const isH = part === "headline";
    const r = await callAI(env, { userKey: key, adv: aiCfg, system: isH ? prompts.headline : prompts.about, input: buildPartRefineInput(p, part, current, action, ask), schema: isH ? HEADLINES_SCHEMA : ABOUT_SCHEMA, validate: isH ? normalizeHeadlines : normalizeAbout });
    if (!r.ok) {
      logEvent(env, ctx, "error", { where: `refine:${part}`, status: r.status, reason: r.reason, model: r.model, ownKey: !!ukey, u: uidOf(cid), event: evId });
      return json({ ok: false, code: "failed", message: ukey ? explainFailure(r) : "書き直しに失敗しました" }, 502);
    }
    logEvent(env, ctx, "refine", { action, tone: "", model: r.model, name: cleanName(body.name), mode: part, kind: part, u: uidOf(cid), event: evId, page: oneLine(body.page, 20) });
    return json({ ok: true, [isH ? "headlines" : "body"]: r.value, model: r.model });
  }
  const opts = (imgs) => ({
    userKey: key,
    adv: aiCfg,
    system: isProfile ? prompts.profile : prompts.system,
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
    logEvent(env, ctx, "error", { where: "refine:photo", status: r.status, reason: r.reason, model: r.model, photos: images.length, kb: imagesKb(images), message: String(r.message || "").slice(0, 160), u: uidOf(cid), event: evId });
    r = await callAI(env, opts([]));
  }
  if (!r.ok) {
    logEvent(env, ctx, "error", { where: "refine", status: r.status, reason: r.reason, model: r.model, ownKey: !!ukey, photos: images.length, u: uidOf(cid), event: evId });
    return json({ ok: false, code: "failed", message: ukey ? explainFailure(r) : "書き直しに失敗しました" }, 502);
  }
  logEvent(env, ctx, "refine", { action, tone: isProfile ? "" : tone, model: r.model, name: cleanName(body.name), mode: isProfile ? "profile" : p.mode, kind: p.kind, photos: images.length, u: uidOf(cid), event: evId, page: oneLine(body.page, 20) });
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
    db.prepare("INSERT INTO events (created_at, type, detail) VALUES (?, ?, ?)").bind(now, action, JSON.stringify({ tone, consent, name: cleanName(body.name), mode: p.mode, kind: p.kind, u: uidOf(cid), event: cleanEventId(body.event), page: oneLine(body.page, 20) })),
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

let statsCache = { at: 0, data: null, e: "" };
async function stats(env, url) {
  // ?e=イベントID のときは、そのイベントで作られた件数だけ
  const e = cleanEventId(url && url.searchParams.get("e"));
  if (statsCache.data && statsCache.e === e && Date.now() - statsCache.at < 5000) return json(statsCache.data);
  const db = await getDb(env);
  const data = { ok: true, generated: 0, copied: 0, later: 0 };
  if (db) {
    // 会場スクリーンの数は、いまの期間だけ（過去のイベントの分は数えない）
    const rg = await rangeOf(env, null);
    const F = isoOf(rg.from);
    const ev = await (e
      ? db.prepare("SELECT type, COUNT(*) AS n FROM events WHERE created_at >= ? AND json_extract(detail, '$.event') = ? GROUP BY type").bind(F, e)
      : db.prepare("SELECT type, COUNT(*) AS n FROM events WHERE created_at >= ? GROUP BY type").bind(F)
    ).all();
    for (const r of ev.results || []) {
      if (r.type === "generate") data.generated = r.n;
      if (r.type === "copy") data.copied = r.n;
      if (r.type === "later") data.later = r.n;
    }
  }
  statsCache = { at: Date.now(), data, e };
  return json(data);
}

async function health(env) {
  return json({
    ok: true,
    version: VERSION,
    hasKey: !!env.GEMINI_API_KEY,
    db: !!(await getDb(env)),
    model: env.GEMINI_MODEL || "gemini-3.8-flash",
    fallback: env.GEMINI_FALLBACK_MODEL || "gemini-flash-lite-latest",
    style: env.GEMINI_API_STYLE || "interactions",
  });
}

// ---------- 過去のイベント（期間で分ける） ----------
// 運営ページは「いまの期間」（いちばん新しい区切りより後）のデータだけを出す。区切りより前は /archive（過去の記録）で見る
// 区切りは settings の archives（[{id, name, preset, until(ミリ秒)}]）。まだ保存していなければ、10/6 のイベントを最初の区切りにする
const ARCHIVE_DEFAULT = [{ id: "kansai-1006", name: "関西を、おもろくする夜。（2026/10/6 富士通ラーニングメディア主催）", preset: "fujitsu", until: Date.parse("2026-10-08T00:00:00+09:00") }];
async function readArchives(env) {
  const s = await readSettings(env);
  const list = safeParse(s.archives, null);
  const arr = Array.isArray(list) ? list : ARCHIVE_DEFAULT;
  const sorted = arr.filter((a) => a && a.id && Number(a.until) > 0).sort((a, b) => a.until - b.until);
  let from = 0;
  return sorted.map((a) => {
    const r = { id: String(a.id), name: String(a.name || a.id), preset: String(a.preset || ""), from, until: Number(a.until) };
    from = r.until;
    return r;
  });
}
// ?a=過去のイベントのID でその期間、なければいまの期間 → {from, to(ミリ秒), archive}
async function rangeOf(env, url) {
  const list = await readArchives(env);
  const id = String((url && url.searchParams.get("a")) || "");
  const hit = id && list.find((a) => a.id === id);
  if (hit) return { from: hit.from, to: hit.until, archive: hit };
  return { from: list.length ? list[list.length - 1].until : 0, to: 8.64e15, archive: null };
}
// 日時の文字（events・posts の created_at と文字で比べる）。「いまの期間」の終わりは 9999年 にする（+275760年 のような形は文字で比べられない）
const isoOf = (ms) => (ms >= 253402300799999 ? "9999-12-31T23:59:59.999Z" : new Date(ms).toISOString());
async function adminArchives(env) {
  const list = await readArchives(env);
  const cur = list.length ? list[list.length - 1].until : 0;
  const db = await getDb(env);
  const out = [];
  for (const a of list) {
    let reports = 0;
    let made = 0;
    if (db) {
      const [r1, r2] = await db.batch([
        db.prepare("SELECT COUNT(*) AS n FROM reports WHERE created_at >= ? AND created_at < ?").bind(a.from, a.until),
        db.prepare("SELECT COUNT(*) AS n FROM events WHERE type = 'generate' AND created_at >= ? AND created_at < ?").bind(isoOf(a.from), isoOf(a.until)),
      ]);
      reports = (r1.results && r1.results[0] && r1.results[0].n) || 0;
      made = (r2.results && r2.results[0] && r2.results[0].n) || 0;
    }
    out.push({ ...a, fromJst: a.from ? jst(isoOf(a.from)) : "", untilJst: jst(isoOf(a.until)), reports, made });
  }
  return json({ ok: true, archives: out.reverse(), currentFrom: cur, currentFromJst: cur ? jst(isoOf(cur)) : "" });
}
// 「ここまでを過去のイベントにする」：いまの期間のデータを、名前をつけて過去の記録に移す（消さない）
async function adminArchiveCreate(request, env) {
  const body = await readJson(request, 4000);
  const name = oneLine(body && body.name, 80);
  if (!name) return json({ ok: false, code: "input", message: "イベントの名前を入れてください" }, 400);
  const db = await getDb(env);
  if (!db) return json({ ok: false, code: "no_db", message: "データベースがありません" }, 503);
  const list = await readArchives(env);
  const next = [...list.map(({ id, name: n, preset, until }) => ({ id, name: n, preset, until })), { id: `a${Date.now().toString(36)}`, name, preset: oneLine(body.preset, 20), until: Date.now() }];
  await db.prepare("INSERT INTO settings (key, value) VALUES ('archives', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(JSON.stringify(next)).run();
  settingsCache.at = 0;
  statsCache = { at: 0, data: null };
  return adminArchives(env);
}

// ---------- 運営用 ----------

async function adminSummary(env, url) {
  const db = await getDb(env);
  const rg = await rangeOf(env, url);
  const F = isoOf(rg.from);
  const T = isoOf(rg.to);
  const out = {
    ok: true,
    db: !!db,
    hasKey: !!env.GEMINI_API_KEY,
    model: env.GEMINI_MODEL || "gemini-3.8-flash",
    fallback: env.GEMINI_FALLBACK_MODEL || "gemini-flash-lite-latest",
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
    db.prepare("SELECT type, COUNT(*) AS n FROM events WHERE created_at >= ? AND created_at < ? GROUP BY type").bind(F, T),
    db.prepare("SELECT COUNT(*) AS n FROM posts WHERE created_at >= ? AND created_at < ?").bind(F, T),
    db.prepare("SELECT detail FROM events WHERE type = 'generate' AND created_at >= ? AND created_at < ? ORDER BY id DESC LIMIT 3000").bind(F, T),
    db.prepare("SELECT detail FROM events WHERE type IN ('copy', 'later') AND created_at >= ? AND created_at < ? ORDER BY id DESC LIMIT 3000").bind(F, T),
    db.prepare("SELECT created_at, detail FROM events WHERE type = 'error' AND created_at >= ? AND created_at < ? ORDER BY id DESC LIMIT 20").bind(F, T),
    db.prepare("SELECT COUNT(*) AS n FROM reports WHERE hidden = 0 AND created_at >= ? AND created_at < ?").bind(rg.from, rg.to),
    db.prepare("SELECT name, created_at FROM reports WHERE hidden = 0 AND created_at >= ? AND created_at < ?").bind(rg.from, rg.to),
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
  const rg = await rangeOf(env, url);
  const { results } = await db.prepare("SELECT * FROM posts WHERE created_at >= ? AND created_at < ? ORDER BY id DESC LIMIT ? OFFSET ?").bind(isoOf(rg.from), isoOf(rg.to), limit, offset).all();
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

async function adminExport(env, url) {
  const db = await getDb(env);
  const rg = await rangeOf(env, url);
  const header = ["日時", "行動", "立場", "ネタ", "回答", "文体", "関西弁", "長さ", "絵文字", "入れたい一言", "選んだパターン", "自分で直した", "投稿文", "エモい案", "ユーモア案", "学び案"];
  const lines = [header];
  if (db) {
    const { results } = await db.prepare("SELECT * FROM posts WHERE created_at >= ? AND created_at < ? ORDER BY id ASC").bind(isoOf(rg.from), isoOf(rg.to)).all();
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
  // 名簿（settings）と過去の記録は残す。消すのは、いまの期間のデータだけ
  const rg = await rangeOf(env, null);
  const F = isoOf(rg.from);
  await db.batch([
    db.prepare("DELETE FROM posts WHERE created_at >= ?").bind(F),
    db.prepare("DELETE FROM events WHERE created_at >= ?").bind(F),
    db.prepare("DELETE FROM stars WHERE report_id IN (SELECT id FROM reports WHERE created_at >= ?)").bind(rg.from),
    db.prepare("DELETE FROM reports WHERE created_at >= ?").bind(rg.from),
  ]);
  statsCache = { at: 0, data: null };
  return json({ ok: true });
}

// ---------- 運営用：利用状況（どれくらい使われているか） ----------
// events の detail に入れている u（端末の目印）・event（イベントID）で数える。u はこの版（2026-10-16）から入れはじめた
const jstDay = (t) => new Date(t + 9 * 3600 * 1000).toISOString().slice(0, 10);
async function adminStats(env, url) {
  const db = await getDb(env);
  if (!db) return json({ ok: false, code: "no_db", message: "データベースがありません" }, 503);
  const days = Math.min(60, Math.max(1, Number(url.searchParams.get("days")) || 14));
  const eRaw = String(url.searchParams.get("e") || "");
  const e = eRaw === "-" ? "-" : cleanEventId(eRaw); // "-" はイベントなし（普段使い）
  const now = Date.now();
  const today = jstDay(now);
  const firstDay = jstDay(now - (days - 1) * 86400000);
  const since = new Date(Date.parse(`${firstDay}T00:00:00+09:00`)).toISOString();
  const todayStart = new Date(Date.parse(`${today}T00:00:00+09:00`)).toISOString();
  const EV = "COALESCE(json_extract(detail, '$.event'), '')";
  const U = "json_extract(detail, '$.u')";
  const cond = e === "-" ? ` AND ${EV} = ''` : e ? ` AND ${EV} = ?` : "";
  const b = (first) => (e && e !== "-" ? [first, e] : [first]);
  const q = (sql, first) => db.prepare(sql).bind(...b(first));
  const [totals, users, daily, dailyU, hourly, gens, convU, byEv, byEvU, names] = await db.batch([
    q(`SELECT type, COUNT(*) AS n, COUNT(DISTINCT ${U}) AS u FROM events WHERE created_at >= ?${cond} GROUP BY type`, since),
    q(`SELECT COUNT(DISTINCT ${U}) AS u FROM events WHERE created_at >= ?${cond} AND COALESCE(${U}, '') != ''`, since),
    q(`SELECT strftime('%Y-%m-%d', created_at, '+9 hours') AS d, type, COUNT(*) AS n FROM events WHERE created_at >= ?${cond} GROUP BY d, type`, since),
    q(`SELECT strftime('%Y-%m-%d', created_at, '+9 hours') AS d, COUNT(DISTINCT ${U}) AS u FROM events WHERE created_at >= ?${cond} AND COALESCE(${U}, '') != '' GROUP BY d`, since),
    q(`SELECT CAST(strftime('%H', created_at, '+9 hours') AS INTEGER) AS h, type, COUNT(*) AS n FROM events WHERE created_at >= ?${cond} GROUP BY h, type`, todayStart),
    q(`SELECT COALESCE(json_extract(detail, '$.kind'), 'post') AS k, COUNT(*) AS n,
         SUM(CASE WHEN COALESCE(json_extract(detail, '$.photos'), 0) > 0 THEN 1 ELSE 0 END) AS wp,
         SUM(COALESCE(json_extract(detail, '$.photos'), 0)) AS ph,
         SUM(CASE WHEN json_extract(detail, '$.ownKey') = 1 THEN 1 ELSE 0 END) AS own,
         AVG(json_extract(detail, '$.ms')) AS ms
       FROM events WHERE type = 'generate' AND created_at >= ?${cond} GROUP BY k`, since),
    q(`SELECT COUNT(DISTINCT ${U}) AS u FROM events WHERE type IN ('copy', 'later') AND created_at >= ?${cond} AND COALESCE(${U}, '') != ''`, since),
    db.prepare(`SELECT ${EV} AS ev, type, COUNT(*) AS n FROM events WHERE created_at >= ? GROUP BY ev, type`).bind(since),
    db.prepare(`SELECT ${EV} AS ev, COUNT(DISTINCT ${U}) AS u FROM events WHERE created_at >= ? AND COALESCE(${U}, '') != '' GROUP BY ev`).bind(since),
    db.prepare("SELECT id, data FROM event_settings"),
  ]);
  const TYPES = ["view", "generate", "refine", "copy", "later", "report", "error"];
  const zero = () => Object.fromEntries(TYPES.map((t) => [t, 0]));
  const total = zero();
  const totalU = zero();
  for (const r of totals.results || []) {
    if (r.type in total) {
      total[r.type] = r.n;
      totalU[r.type] = r.u;
    }
  }
  const dayList = [];
  for (let i = days - 1; i >= 0; i--) dayList.push({ d: jstDay(now - i * 86400000), ...zero(), users: 0 });
  const dayMap = new Map(dayList.map((x) => [x.d, x]));
  for (const r of daily.results || []) {
    const x = dayMap.get(r.d);
    if (x && r.type in x) x[r.type] = r.n;
  }
  for (const r of dailyU.results || []) {
    const x = dayMap.get(r.d);
    if (x) x.users = r.u;
  }
  const hours = Array.from({ length: 24 }, (_, h) => ({ h, ...zero() }));
  for (const r of hourly.results || []) if (hours[r.h] && r.type in hours[r.h]) hours[r.h][r.type] = r.n;
  const kinds = {};
  let photosUsed = 0;
  let photosTotal = 0;
  let ownKey = 0;
  let msSum = 0;
  let msN = 0;
  for (const r of gens.results || []) {
    kinds[r.k] = r.n;
    photosUsed += r.wp || 0;
    photosTotal += r.ph || 0;
    ownKey += r.own || 0;
    if (r.ms) {
      msSum += r.ms * r.n;
      msN += r.n;
    }
  }
  const evName = {};
  for (const r of names.results || []) evName[r.id] = safeParse(r.data).name || r.id;
  const byEvent = new Map();
  const evRow = (id) => {
    if (!byEvent.has(id)) byEvent.set(id, { id, name: id ? evName[id] || id : "イベントなし（普段使い）", users: 0, ...zero() });
    return byEvent.get(id);
  };
  for (const r of byEv.results || []) if (TYPES.includes(r.type)) evRow(r.ev)[r.type] = r.n;
  for (const r of byEvU.results || []) evRow(r.ev).users = r.u;
  const todayRow = dayMap.get(today) || { ...zero(), users: 0 };
  return json({
    ok: true,
    days,
    event: e,
    today: { ...todayRow },
    total,
    users: (users.results && users.results[0] && users.results[0].u) || 0,
    funnel: {
      viewed: totalU.view,
      made: totalU.generate,
      copied: (convU.results && convU.results[0] && convU.results[0].u) || 0,
      reported: totalU.report,
    },
    daily: dayList,
    hourly: hours,
    kinds,
    photos: { used: photosUsed, total: photosTotal },
    ownKey,
    avgMs: msN ? Math.round(msSum / msN) : 0,
    byEvent: [...byEvent.values()].sort((a, b2) => b2.users - a.users || b2.generate - a.generate),
  });
}

// ---------- 運営用：AIへの指示文（書きかえ・元に戻す・ためしに作る） ----------
const PROMPT_LABEL = { system: "投稿文の指示文", headline: "見出し（Headline）の指示文", about: "自己紹介（About）の指示文", ishizaka: "石坂さん風の型", profile: "見出し＋自己紹介まとめて（前の版）" };
async function adminPrompts(env) {
  const s = await readSettings(env, true);
  const prompts = {};
  for (const k of PROMPT_KEYS) {
    const custom = String(s[`prompt.${k}`] || "");
    prompts[k] = { label: PROMPT_LABEL[k] || k, current: custom || PROMPT_DEFAULTS[k], default: PROMPT_DEFAULTS[k], custom: !!custom, hasPrev: !!s[`prompt.${k}.prev`], updatedAt: Number(s[`prompt.${k}.at`]) || 0 };
  }
  return json({ ok: true, prompts, serverKey: !!env.GEMINI_API_KEY });
}
async function adminPromptSave(request, env) {
  const body = await readJson(request, PROMPT_MAX * 4 + 2000);
  const key = body && PROMPT_KEYS.includes(body.key) ? body.key : "";
  if (!key) return json({ ok: false, code: "input", message: "どの指示文かが分かりません" }, 400);
  const db = await getDb(env);
  if (!db) return json({ ok: false, code: "no_db", message: "データベースがありません" }, 503);
  const s = await readSettings(env, true);
  const cur = String(s[`prompt.${key}`] || "");
  let next;
  if (body.restore === "default") next = "";
  else if (body.restore === "prev") next = String(s[`prompt.${key}.prev`] || "");
  else {
    next = String(body.text || "").replace(/\r\n?/g, "\n").trim();
    if (next.length > PROMPT_MAX) return json({ ok: false, code: "input", message: `長すぎます（${PROMPT_MAX}字まで）` }, 400);
    if (next.length < 20) return json({ ok: false, code: "input", message: "短すぎます。元に戻すときは「初期の文に戻す」を押してください" }, 400);
    if (next === PROMPT_DEFAULTS[key]) next = "";
  }
  const up = (k, v) => db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(k, v);
  const del = (k) => db.prepare("DELETE FROM settings WHERE key = ?").bind(k);
  const stmts = [next ? up(`prompt.${key}`, next) : del(`prompt.${key}`), up(`prompt.${key}.at`, String(Date.now()))];
  // ひとつ前の文を覚えておく（「ひとつ前に戻す」用）。同じ文のときは覚えない
  if (cur !== next) stmts.push(cur ? up(`prompt.${key}.prev`, cur) : del(`prompt.${key}.prev`));
  await db.batch(stmts);
  settingsCache.at = 0;
  return adminPrompts(env);
}
// 保存する前に、書きかけの指示文で1本作ってみる（サーバーのキーを使う。記録には残さない）
async function adminPromptTest(request, env) {
  const body = await readJson(request, PROMPT_MAX * 4 + 8000);
  if (!body) return json({ ok: false, code: "input" }, 400);
  if (!env.GEMINI_API_KEY) return json({ ok: false, code: "no_key", message: "サーバーのキー（GEMINI_API_KEY）がないので、ためせません" }, 400);
  if (limited("admin:ptest", 20, 60000)) return json({ ok: false, code: "rate", message: "ちょっと待ってから、もう一回" }, 429);
  const prompts = await promptsOf(env);
  const key = PROMPT_KEYS.includes(body.key) ? body.key : "system";
  const text = String(body.text || "").trim().slice(0, PROMPT_MAX);
  if (text) prompts[key] = finishPrompt(key, text);
  const kind = ["profile", "headline", "about"].includes(key) ? key : "post";
  const sample = String(body.sample || "").trim().slice(0, 400) || (kind !== "post" ? "〇〇大学 経済学部の3年生。ゼミでマーケティングを学びながら、学園祭の広報を担当してSNSのフォロワーを1年で2倍にした" : "企業のブースで、若手社員さんの「失敗してもいいから手を挙げる」という話を聞いて、まず一歩やってみようと思えた");
  const p = sanitizePayload({
    answers: kind !== "post" ? [{ id: "pf_now", label: "いまの取り組み", question: "いま、何をしている？力を入れていることは？", text: sample }] : [{ id: "learn", label: "今日の学び・気づき", question: "今日、「これは学びやわ」って思ったことは？", text: sample }],
    pcond: { role: "大学生", year: "3年", dirs: ["広告・マーケ"], focus: "経験・実績", lang: "日本語", tone: "誠実・きちんと" },
    mode: key === "ishizaka" ? "ishizaka" : body.mode === "first" ? "first" : "",
    kind,
    tone: "emo",
    style: { formality: "おまかせ", kansai: "なし", length: "短め", emoji: "ちょっと", cheer: "なし", sign: "なし" },
  });
  p.eventNote = await eventNoteOf(env, body.event);
  p.ishizakaStyle = prompts.ishizaka;
  const r =
    kind === "profile"
      ? await callAI(env, { system: prompts.profile, input: buildProfileInput(p), schema: PROFILE_SCHEMA, validate: normalizeProfile })
      : kind === "headline"
      ? await callAI(env, { system: prompts.headline, input: buildPartInput(p, "headline"), schema: HEADLINES_SCHEMA, validate: normalizeHeadlines })
      : kind === "about"
      ? await callAI(env, { system: prompts.about, input: buildPartInput(p, "about"), schema: ABOUT_SCHEMA, validate: normalizeAbout })
      : await callAI(env, { system: prompts.system, input: buildUserInput(p), schema: patternsSchema(1, "emo"), validate: (j) => normalizePatterns(j, "", 1, "emo") });
  if (!r.ok) return json({ ok: false, code: "failed", message: explainFailure(r), model: r.model, reason: r.reason });
  const out =
    kind === "profile" ? `【見出し】\n${r.value.headlines.join("\n")}\n\n【自己紹介】\n${r.value.about}` : kind === "headline" ? r.value.map((h, i) => `${i + 1}. ${h}`).join("\n") : kind === "about" ? r.value : r.value[0].body;
  return json({ ok: true, text: out, model: r.model, ms: r.ms, sample });
}

// ---------- 運営用：投稿報告 ----------
async function adminReports(env, url) {
  const db = await getDb(env);
  if (!db) return json({ ok: true, rows: [] });
  const rg = await rangeOf(env, url);
  const [rows, stars] = await db.batch([
    db.prepare("SELECT * FROM reports WHERE created_at >= ? AND created_at < ? ORDER BY created_at DESC LIMIT 1000").bind(rg.from, rg.to),
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
  return json({ ok: true, rows: list });
}

async function adminExportReports(env, url) {
  const db = await getDb(env);
  const rg = await rangeOf(env, url);
  const header = ["報告日時", "名前", "作り方", "投稿のリンク", "本文", "スクリーンに名前", "非表示", "★を付けたパネラー"];
  const lines = [header];
  if (db) {
    const [rows, stars] = await db.batch([
      db.prepare("SELECT * FROM reports WHERE created_at >= ? AND created_at < ? ORDER BY created_at ASC").bind(rg.from, rg.to),
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
