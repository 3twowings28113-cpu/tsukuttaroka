/*
 * 「投稿したで！」の報告で使う小道具（サーバー用）。
 * 画面側（public/app.js）にも同じ考え方のリンク取り出しがある。直すときは両方そろえる。
 */
// LinkedInの投稿リンクを、貼り付けた文の中から取り出す（「…をチェック https://…」のような文でもOK）
const LINKEDIN_HOST = /(^|\.)linkedin\.com$|^lnkd\.in$/i;
export function extractLinkedInUrl(text) {
  const s = String(text || "").trim();
  if (!s) return { url: "" };
  const m = s.match(/https?:\/\/[^\s<>"'）」』]+/i) || s.match(/(?:www\.)?(?:linkedin\.com|lnkd\.in)\/[^\s<>"'）」』]+/i);
  if (!m) return { error: "url" };
  let raw = m[0];
  if (!/^https?:\/\//i.test(raw)) raw = "https://" + raw;
  let u;
  try {
    u = new URL(raw);
  } catch {
    return { error: "url" };
  }
  if (!LINKEDIN_HOST.test(u.hostname)) return { error: "url" };
  u.protocol = "https:";
  for (const k of [...u.searchParams.keys()]) if (/^(utm_|trk|rcm$)/i.test(k)) u.searchParams.delete(k);
  u.hash = "";
  const out = u.toString();
  return out.length > 600 ? { error: "url" } : { url: out };
}
export function cleanName(s) {
  return String(s || "")
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);
}
// 名簿との照らし合わせ用（空白・中黒・敬称の違いを無視）
export function nameKey(s) {
  return cleanName(s)
    .toLowerCase()
    .replace(/(さん|様|さま)$/, "")
    .replace(/[\s・･.\-_]/g, "");
}
