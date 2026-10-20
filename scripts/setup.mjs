#!/usr/bin/env node
/*
 * 公開まで全自動でやるスクリプト：npm run setup
 *  1. Node.js の確認        2. 部品のインストール    3. Cloudflare ログイン
 *  4. Gemini の動作確認      5. データベース作成      6. 公開
 *  7. キーと合言葉の登録     8. 公開したものの動作確認
 * 何度実行しても大丈夫（作成済みのものはそのまま使う）。
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { findWorking, readDevVars, writeModelVars } from "./check-gemini.mjs";

const DB_NAME = "tsukuttaroka-db";
const isWin = process.platform === "win32";
const say = (s = "") => console.log(s);
const step = (n, s) => say(`\n[${n}/8] ${s}`);
const stop = (msg) => {
  say(`\n止まりました：${msg}`);
  process.exit(1);
};

function run(cmd, args, { interactive = false } = {}) {
  const r = spawnSync(cmd, args, {
    shell: isWin,
    encoding: "utf8",
    stdio: interactive ? "inherit" : ["ignore", "pipe", "pipe"],
    env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" },
    maxBuffer: 20 * 1024 * 1024,
  });
  return { code: r.status, out: `${r.stdout || ""}${r.stderr || ""}` };
}
const wrangler = (args, opts) => run("npx", ["wrangler", ...args], opts);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  say("=== 投稿、つくったろか。セットアップ ===");

  step(1, "Node.js のバージョン確認");
  const major = Number(process.versions.node.split(".")[0]);
  if (major < 20) stop(`Node.js ${process.versions.node} は古いです。20 以上を入れてください（winget install -e --id OpenJS.NodeJS.LTS）`);
  say(`  OK  Node.js ${process.versions.node}`);

  step(2, "部品のインストール");
  if (!existsSync("node_modules/wrangler")) {
    const r = run("npm", ["install", "--no-audit", "--no-fund"], { interactive: true });
    if (r.code !== 0) stop("npm install に失敗しました。上のエラーを確認してください。");
  }
  say("  OK  wrangler あり");

  step(3, "Cloudflare のログイン確認");
  let who = wrangler(["whoami"]);
  if (/not authenticated|wrangler login/i.test(who.out) || who.code !== 0) {
    say("  ブラウザが開くので「Allow（許可）」を押してください…");
    const r = wrangler(["login"], { interactive: true });
    if (r.code !== 0) stop("ログインできませんでした。もう一度 npm run setup を実行してください。");
    who = wrangler(["whoami"]);
  }
  const acct = (who.out.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/) || [""])[0];
  say(`  OK  ログイン済み ${acct}`);

  step(4, "Gemini（AI）の動作確認");
  const vars = readDevVars();
  if (!vars.GEMINI_API_KEY) stop(".dev.vars に GEMINI_API_KEY がありません。");
  if (!vars.ADMIN_PASSCODE) stop(".dev.vars に ADMIN_PASSCODE がありません。");
  const found = await findWorking(vars.GEMINI_API_KEY);
  let aiOk = !!found.primary;
  if (aiOk) {
    writeModelVars(found);
    say(`  → 使うモデル：${found.primary.model}（予備：${found.lite ? found.lite.model : "なし"}）`);
  } else {
    say("  ！ このパソコンからは AI が動きませんでした。公開は続けます（あとでキーを直せば動きます）。");
  }

  step(5, "データベース（D1）の準備");
  let dbId = null;
  const list = wrangler(["d1", "list", "--json"]);
  try {
    const arr = JSON.parse(list.out.slice(list.out.indexOf("["), list.out.lastIndexOf("]") + 1));
    const hit = arr.find((d) => d.name === DB_NAME);
    if (hit) dbId = hit.uuid || hit.database_id || hit.id;
  } catch {}
  if (!dbId) {
    const created = wrangler(["d1", "create", DB_NAME]);
    const m = created.out.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    if (!m) stop(`データベースを作れませんでした。\n${created.out.slice(-800)}`);
    dbId = m[0];
    say(`  OK  作成しました ${dbId}`);
  } else say(`  OK  作成済みを使います ${dbId}`);
  const conf = readFileSync("wrangler.jsonc", "utf8");
  writeFileSync("wrangler.jsonc", conf.replace(/("database_id"\s*:\s*)"[^"]*"/, `$1"${dbId}"`));

  step(6, "公開（deploy）");
  const dep = wrangler(["deploy"]);
  if (dep.code !== 0) {
    if (/workers\.dev subdomain/i.test(dep.out)) stop("Cloudflare の workers.dev サブドメインが未登録です。Cloudflare の管理画面 → Workers & Pages で登録してから、もう一度実行してください。");
    stop(`公開に失敗しました。\n${dep.out.slice(-1500)}`);
  }
  const url = (dep.out.match(/https:\/\/[a-z0-9.-]+\.workers\.dev/i) || [""])[0];
  if (!url) stop(`公開URLが見つかりませんでした。\n${dep.out.slice(-800)}`);
  say(`  OK  ${url}`);

  step(7, "APIキーと合言葉を登録（secret）");
  const tmp = ".secrets.tmp.json";
  writeFileSync(tmp, JSON.stringify({ GEMINI_API_KEY: vars.GEMINI_API_KEY, ADMIN_PASSCODE: vars.ADMIN_PASSCODE }));
  const sec = wrangler(["secret", "bulk", tmp]);
  try {
    unlinkSync(tmp);
  } catch {}
  if (sec.code !== 0) stop(`登録に失敗しました。\n${sec.out.slice(-800)}`);
  say("  OK  登録しました");

  step(8, "公開したアプリの動作確認");
  let health = null;
  for (let i = 0; i < 12; i++) {
    try {
      const res = await fetch(`${url}/api/health`, { cache: "no-store" });
      if (res.ok) {
        health = await res.json();
        if (health.hasKey && health.hasPasscode) break;
      }
    } catch {}
    await sleep(2500);
  }
  if (!health) stop(`${url}/api/health に届きません。1分ほど待ってから、もう一度 npm run setup を実行してください。`);
  say(`  キー：${health.hasKey ? "OK" : "未登録"}　合言葉：${health.hasPasscode ? "OK" : "未登録"}　データベース：${health.db ? "OK" : "NG"}`);
  try {
    const res = await fetch(`${url}/api/admin/test`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-admin-passcode": vars.ADMIN_PASSCODE },
      body: "{}",
    });
    const t = await res.json();
    aiOk = !!t.ok;
    say(t.ok ? `  AI：OK（${t.model}、${t.ms}ミリ秒）「${t.text}」` : `  AI：NG（${t.model || ""} ${t.status || ""} ${t.reason || ""}）→ ${t.hint || ""}`);
  } catch (e) {
    say(`  AIの確認ができませんでした：${e.message}`);
  }

  say("\n==================== できあがり ====================");
  say(`LSCW専用ページ（QR）  ：${url}/lscw`);
  say(`参加者用（普段使い）   ：${url}/`);
  say(`会場スクリーン用QR     ：${url}/qr?preset=lscw&url=${encodeURIComponent(url + "/lscw")}`);
  say(`運営ページ             ：${url}/admin　（合言葉：${vars.ADMIN_PASSCODE}）`);
  say(`リハーサル用（例文入り）：${url}/?demo=1`);
  say(`AI                     ：${aiOk ? "OK" : "NG（上の理由を確認）"}`);
  say("====================================================");
  if (!aiOk) process.exit(2);
}

main().catch((e) => stop((e && e.stack) || String(e)));
