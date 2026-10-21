// 本番の通し確認（GitHub Actions の「本番で通しテスト」から動かす）
// 実際のブラウザで /lscw を開き、本物のAI（Gemini）で 投稿文 → 見出し → 自己紹介 を最後まで作れるかを確かめる。
// できた文章とAIのモデル名をログに出す。1回で AI を3回ほど使う（運営ページの利用状況にも「動作確認ボット」として出る）
// 使い方：BASE_URL=https://… node scripts/smoke-prod.mjs（playwright が必要）
import { chromium } from "playwright";

const BASE = (process.env.BASE_URL || "https://tsukuttaroka.3twowings28113.workers.dev").replace(/\/$/, "");
const EXE = process.env.CHROME_PATH || undefined;
let fails = 0;
const ok = (c, m) => {
  console.log(`${c ? "  OK" : "  NG"} ${m}`);
  if (!c) fails++;
};
const line = (t) => console.log(`\n==================== ${t} ====================`);

const browser = await chromium.launch(EXE ? { executablePath: EXE } : {});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "ja-JP" });
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(String(e)));
const apis = [];
page.on("response", async (r) => {
  if (!/\/api\/(generate|refine)/.test(r.url())) return;
  const body = await r.json().catch(() => ({}));
  apis.push({ url: r.url(), status: r.status(), body });
});
const click = async (sel) => {
  await page.locator(sel).first().click();
  await page.waitForTimeout(300);
};
const lastApi = () => apis[apis.length - 1] || { body: {} };

try {
  line("1. /lscw を開く");
  await page.goto(`${BASE}/lscw`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${BASE}/lscw`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".ev-head", { timeout: 20000 });
  await page.waitForTimeout(1500);
  ok(await page.locator(".co-marquee").count(), "参加企業のロゴの帯がある");
  ok(!(await page.locator("[data-act=openKey]").count()), "AIのキーの設定は出ない（イベントのキーで作る）");
  ok((await page.locator(".pane-tab").count()) === 2, "テーマ・質問数のタブがある");

  line("2. 投稿文を最後まで作る（参加した感想・3問）");
  await page.fill("#myName", "動作確認ボット");
  await click("[data-act=toAnswer]");
  const answers = [
    "外資系企業の人の話を、直接聞いてみたかったから参加した",
    "ブースで若手社員さんに「まず手を挙げてみる」が大事と聞いて、自分も挑戦してみようと思えた",
    "LinkedInのプロフィールを整えて、週1で学んだことを発信する",
    "同じように迷っている学生の背中を押せたらうれしい",
  ];
  for (let i = 0; i < 8 && (await page.locator("#answer").count()); i++) {
    const label = await page.locator(".q-label").innerText();
    await page.fill("#answer", answers[Math.min(i, answers.length - 1)]);
    console.log(`  質問${i + 1}：${label.replace(/\s+/g, "")}`);
    await click("#nextBtn");
    await page.waitForTimeout(900);
  }
  ok(await page.locator("[data-act=generate]").count(), "じぶん色の画面まで進んだ");
  await click("[data-act=generate]");
  await page.waitForSelector(".li-card:not(.sk)", { timeout: 120000 });
  await page.waitForTimeout(800);
  const gen = lastApi();
  ok(gen.status === 200 && gen.body.ok && !gen.body.sample, `本物のAIで作れた（モデル：${gen.body.model || "?"}）`);
  const tabs = await page.locator(".tabs [role=tab]").count();
  for (let t = 0; t < Math.max(1, tabs); t++) {
    if (tabs) await page.locator(".tabs [role=tab]").nth(t).click();
    await page.waitForTimeout(300);
    const name = tabs ? (await page.locator(".tabs [role=tab]").nth(t).innerText()).replace(/\s+/g, "") : "";
    const text = await page.locator("#liBody").innerText();
    console.log(`\n--- できた投稿文（${name}）${text.length}字 ---\n${text}\n`);
    ok(text.length >= 80, `${name}：文章ができている（${text.length}字）`);
    ok(/#LSCW2026/.test(text), `${name}：イベントのハッシュタグが入っている`);
  }
  await click("[data-act=choose]");
  for (let i = 0; i < 4; i++) await click(`.check[data-i="${i}"]`);
  await click("#toGuide");
  ok(await page.locator("#copyOpen").count(), "投稿のしかた（コピーしてLinkedInをひらく）まで進んだ");

  line("3. 見出し（Headline）を作る");
  await page.goto(`${BASE}/lscw`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.removeItem("tsukuttaroka.v1.lscw"));
  await page.goto(`${BASE}/lscw`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  await page.fill("#myName", "動作確認ボット");
  await click("[data-act=kind][data-v=headline]");
  await click("[data-act=toAnswer]");
  const pa = ["〇〇大学 経済学部 3年", "学園祭の広報で、SNSのフォロワーを1年で2倍にした", "SNS分析、Python、データの見える化", "マーケティングの仕事で、人と商品をつなげたい", "人の話を最後まで聞くところ", "マーケティングに関心のある人"];
  for (let i = 0; i < 8 && (await page.locator("#answer").count()); i++) {
    await page.fill("#answer", pa[Math.min(i, pa.length - 1)]);
    await click("#nextBtn");
    await page.waitForTimeout(900);
  }
  await page.waitForSelector(".p-heads", { timeout: 120000 });
  await page.waitForTimeout(800);
  const hs = await page.locator(".p-head").allInnerTexts();
  const hg = lastApi();
  ok(hg.body.ok && !hg.body.sample, `本物のAIで見出しが作れた（モデル：${hg.body.model || "?"}）`);
  ok(hs.length === 5, `見出しが5案（${hs.length}）`);
  console.log(`\n--- できた見出し ---\n${hs.map((h, i) => `${i + 1}. ${h.replace(/\s+/g, " ").replace(/\s*\d+字\s*$/, "").replace(/\s*コピー\s*$/, "").trim()}`).join("\n")}\n`);

  line("4. 自己紹介（About）を作る");
  await click("[data-act=toKind][data-v=about]");
  for (let i = 0; i < 8 && (await page.locator("#answer").count()); i++) {
    await page.fill("#answer", pa[Math.min(i + 4, pa.length - 1)]);
    await click("#nextBtn");
    await page.waitForTimeout(900);
  }
  await page.waitForSelector(".p-about", { timeout: 120000 });
  await page.waitForTimeout(800);
  const ab = await page.locator("#liBody").innerText();
  const ag = lastApi();
  ok(ag.body.ok && !ag.body.sample, `本物のAIで自己紹介が作れた（モデル：${ag.body.model || "?"}）`);
  ok(ab.length >= 80, `自己紹介ができている（${ab.length}字）`);
  console.log(`\n--- できた自己紹介 ---\n${ab}\n`);
  ok(errs.length === 0, "画面のエラーなし " + errs.join(" | "));
} catch (e) {
  fails++;
  console.log("  NG 途中で止まった：", e && e.message);
  await page.screenshot({ path: "smoke-fail.png", fullPage: true }).catch(() => {});
  for (const a of apis) console.log("  API", a.status, a.url, JSON.stringify(a.body).slice(0, 300));
}
await browser.close();
line(fails ? `失敗 ${fails}件` : "ぜんぶOK：本番で最後まで作れました");
process.exit(fails ? 1 : 0);
