#!/usr/bin/env node
/*
 * Gemini のキーとモデルが「このパソコンから」本当に動くか確かめる。
 *   npm run check            → 結果を表示するだけ
 *   npm run check -- --write → 動いたモデルを wrangler.jsonc に書き込む
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { geminiJSON, explainFailure, DEFAULT_BASE } from "../src/gemini.js";

export const PRIMARY_CANDIDATES = [
  { model: "gemini-3.8-flash", style: "interactions" },
  { model: "gemini-3.7-flash", style: "interactions" },
  { model: "gemini-flash-latest", style: "interactions" },
  { model: "gemini-3.8-flash", style: "generateContent" },
  { model: "gemini-flash-latest", style: "generateContent" },
  { model: "gemini-2.5-flash", style: "generateContent" },
];
export const LITE_CANDIDATES = ["gemini-flash-lite-latest", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-2.5-flash-lite"];

const TEST = {
  system: "あなたは動作確認用のアシスタントです。",
  input: '「ほな、いこか」という意味の短い関西弁を1つ、{"text":"…"} のJSONだけで返して。',
  schema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
};

export function readDevVars(path = ".dev.vars") {
  const out = {};
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

async function tryOne(apiKey, c) {
  const args = { apiKey, ...c, ...TEST, thinking: "low", timeoutMs: 30000, maxOutputTokens: 1000, baseUrl: process.env.GEMINI_BASE_URL || DEFAULT_BASE };
  let r = await geminiJSON(args);
  if (!r.ok && r.status === 400 && !/API key/i.test(r.message || "")) r = await geminiJSON({ ...args, thinking: null });
  if (r.ok && !(r.json && typeof r.json.text === "string")) r = { ...r, ok: false, reason: "BAD_JSON", message: r.text };
  return r;
}

const line = (r) =>
  r.ok
    ? `  OK  ${r.model}（${r.style}）${r.ms}ミリ秒「${r.json.text}」`
    : `  NG  ${r.model}（${r.style}）${r.status || ""} ${r.reason}\n      → ${explainFailure(r)}${r.message ? `\n      （${String(r.message).slice(0, 160)}）` : ""}`;

export async function findWorking(apiKey, log = console.log) {
  let primary = null;
  let firstFail = null;
  for (const c of PRIMARY_CANDIDATES) {
    const r = await tryOne(apiKey, c);
    log(line(r));
    if (r.ok) {
      primary = r;
      break;
    }
    firstFail = firstFail || r;
    if (r.reason === "API_KEY_INVALID" || r.reason === "NETWORK" || r.reason === "NO_KEY") break;
  }
  let lite = null;
  if (primary) {
    for (const m of LITE_CANDIDATES) {
      const r = await tryOne(apiKey, { model: m, style: primary.style });
      log(line(r));
      if (r.ok) {
        lite = r;
        break;
      }
    }
  }
  return { primary, lite, firstFail };
}

export function writeModelVars({ primary, lite }, path = "wrangler.jsonc") {
  let text = readFileSync(path, "utf8");
  const set = (key, value) => {
    const re = new RegExp(`("${key}"\\s*:\\s*)"[^"]*"`);
    text = re.test(text) ? text.replace(re, `$1"${value}"`) : text;
  };
  if (primary) {
    set("GEMINI_MODEL", primary.model);
    set("GEMINI_API_STYLE", primary.style);
  }
  if (lite) set("GEMINI_FALLBACK_MODEL", lite.model);
  writeFileSync(path, text);
}

async function main() {
  const vars = readDevVars();
  const key = process.env.GEMINI_API_KEY || vars.GEMINI_API_KEY;
  if (!key) {
    console.log("GEMINI_API_KEY が見つかりません。.dev.vars に GEMINI_API_KEY=… を書いてください。");
    process.exit(1);
  }
  console.log("Gemini の動作確認をしています…");
  const res = await findWorking(key);
  if (!res.primary) {
    console.log("\n動くモデルが見つかりませんでした。上の NG の理由を見てください。");
    process.exit(1);
  }
  console.log(`\n使うモデル：${res.primary.model}（${res.primary.style}）　予備：${res.lite ? res.lite.model : "なし"}`);
  if (process.argv.includes("--write")) {
    writeModelVars(res);
    console.log("wrangler.jsonc に書き込みました。");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
