/*
 * Gemini API の呼び出し（サーバーと、確認スクリプト scripts/check-gemini.mjs の両方で使う）
 * - style "interactions"   : 新しい Interactions API（おすすめ）
 * - style "generateContent": 従来の API（予備）
 * 失敗しても例外は投げず、{ ok:false, status, reason, message } を返す。
 */

export const DEFAULT_BASE = "https://generativelanguage.googleapis.com/v1beta";

export async function geminiJSON({
  apiKey,
  model,
  system,
  input,
  schema,
  style = "interactions",
  thinking = "low",
  timeoutMs = 20000,
  maxOutputTokens = 6000,
  baseUrl = DEFAULT_BASE,
  images = [], // [{ mime, data(base64) }]。端末で小さくした写真
}) {
  const started = Date.now();
  const base = { model, style };
  if (!apiKey) return { ...base, ok: false, status: 0, reason: "NO_KEY", message: "GEMINI_API_KEY が未設定", ms: 0 };

  let url;
  let body;
  if (style === "generateContent") {
    url = `${baseUrl}/models/${encodeURIComponent(model)}:generateContent`;
    body = {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: input }, ...images.map((im) => ({ inlineData: { mimeType: im.mime, data: im.data } }))] }],
      generationConfig: { responseMimeType: "application/json", responseJsonSchema: schema, maxOutputTokens },
    };
    if (thinking) body.generationConfig.thinkingConfig = { thinkingLevel: thinking };
  } else {
    url = `${baseUrl}/interactions`;
    body = {
      model,
      // 写真があるときは、文 → 写真 の順に並べる（Interactions API の画像入力の形）
      input: images.length
        ? [{ type: "text", text: input }, ...images.map((im) => ({ type: "image", data: im.data, mime_type: im.mime }))]
        : input,
      system_instruction: system,
      store: false,
      response_format: { type: "text", mime_type: "application/json", schema },
      generation_config: { max_output_tokens: maxOutputTokens },
    };
    if (thinking) body.generation_config.thinking_level = thinking;
  }

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify(body),
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
      const detail = Array.isArray(err.details) ? err.details.find((d) => d && d.reason) : null;
      return {
        ...base,
        ok: false,
        status: res.status,
        reason: (detail && detail.reason) || err.status || `HTTP_${res.status}`,
        message: String(err.message || raw || "").slice(0, 300),
        ms,
      };
    }
    const text = extractText(data);
    if (!text) {
      const why = (data && (data.status || (data.candidates && data.candidates[0] && data.candidates[0].finishReason))) || "unknown";
      return { ...base, ok: false, status: 200, reason: "EMPTY", message: `出力が空（${why}）`, ms };
    }
    const json = parseJsonLoose(text);
    if (json === undefined) return { ...base, ok: false, status: 200, reason: "BAD_JSON", message: text.slice(0, 200), ms };
    return { ...base, ok: true, status: 200, json, text, ms, usage: (data && (data.usage || data.usageMetadata)) || null };
  } catch (e) {
    return {
      ...base,
      ok: false,
      status: 0,
      reason: e && e.name === "AbortError" ? "TIMEOUT" : "NETWORK",
      message: String((e && e.message) || e),
      ms: Date.now() - started,
    };
  } finally {
    clearTimeout(timer);
  }
}

// どちらのAPIの返事からでも本文を取り出す
export function extractText(data) {
  if (!data || typeof data !== "object") return "";
  if (typeof data.output_text === "string" && data.output_text) return data.output_text;
  const parts = [];
  for (const step of Array.isArray(data.steps) ? data.steps : []) {
    if (!step || (step.type && step.type !== "model_output")) continue;
    for (const c of Array.isArray(step.content) ? step.content : []) {
      if (c && c.type === "text" && typeof c.text === "string") parts.push(c.text);
    }
  }
  if (parts.length) return parts.join("");
  for (const o of Array.isArray(data.outputs) ? data.outputs : []) {
    if (o && o.type === "text" && typeof o.text === "string") parts.push(o.text);
  }
  if (parts.length) return parts.join("");
  const cand = data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts;
  for (const p of Array.isArray(cand) ? cand : []) {
    if (p && typeof p.text === "string" && !p.thought) parts.push(p.text);
  }
  return parts.join("");
}

export function parseJsonLoose(text) {
  const t = String(text || "").trim();
  try {
    return JSON.parse(t);
  } catch {}
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    try {
      return JSON.parse(fence[1]);
    } catch {}
  }
  const a = t.indexOf("{");
  const b = t.lastIndexOf("}");
  if (a >= 0 && b > a) {
    try {
      return JSON.parse(t.slice(a, b + 1));
    } catch {}
  }
  return undefined;
}

// エラーの読み方（確認スクリプトと管理画面で使う）
export function explainFailure(r) {
  const reason = String((r && r.reason) || "");
  const status = r && r.status;
  if (reason === "NO_KEY") return "APIキーが入っていません。";
  if (reason === "ACCESS_TOKEN_TYPE_UNSUPPORTED") return "このキーの形式（AQ.〜）が、このモデル／APIではまだ通りません。別のモデルで試します。";
  if (reason === "API_KEY_INVALID" || (status === 400 && /API key not valid/i.test(r.message || ""))) return "キーが正しくありません（コピー漏れの可能性）。AI Studio でキーをコピーし直してください。";
  if (reason === "API_KEY_SERVICE_BLOCKED" || status === 403) return "このキーでは Gemini API が使えない設定です。AI Studio で新しいキーを作ってください。";
  if (status === 401) return "認証が通りません。AI Studio でキーを作り直すと直ることがあります。";
  if (status === 402) return "前払いの残高がなくなりました。AI Studio の「課金」で残高を追加すると、すぐ直ります。";
  if (status === 404) return "このモデル名は使えません（次の候補を試します）。";
  if (status === 429 || reason === "RESOURCE_EXHAUSTED") return "回数の上限に当たりました。AI Studio で課金（お支払い方法）を設定すると、ほぼ解消します。";
  if (status >= 500) return "Google側が混み合っています。少し待つと直ります。";
  if (reason === "TIMEOUT") return "時間切れ。回線か Google 側が遅いです。";
  if (reason === "NETWORK") return "インターネットにつながりません。";
  if (reason === "BAD_JSON" || reason === "EMPTY") return "返事の形がおかしかった（たまに起きます。もう一度で直ることが多い）。";
  return "不明なエラー。";
}
