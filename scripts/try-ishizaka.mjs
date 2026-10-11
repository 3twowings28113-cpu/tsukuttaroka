const URL = "https://tsukuttaroka.3twowings28113.workers.dev/api/refine";
const style = { formality: "です・ます", kansai: "ちょい足し", length: "ふつう", emoji: "ちょっと" };
const cases = [
  {
    name: "しっかり回答",
    answers: [
      { label: "印象に残ったこと", question: "今日いちばん印象に残ったこと", text: "失敗の話を笑って話せる人ほど強いと思った", chips: ["パネルの話で"] },
      { label: "もらった自分の魅力", question: "相手から言われたあなたの魅力は？", text: "話を広げるのがうまいと言われて意外だった", chips: ["うれしかった"] },
      { label: "これから挑戦したいこと", question: "これから、なにに挑戦してみる？", text: "週1でLinkedInに投稿する", chips: [] },
    ],
    body: "今日の関西を、おもろくする夜。に参加しました。失敗の話を笑って話せる人ほど強いと感じました。初対面の方から話を広げるのがうまいと言ってもらえて、意外でうれしかったです。これから週1でLinkedInに投稿します。皆さんは最近どんな挑戦をしていますか？",
  },
  {
    name: "ひとことだけ",
    answers: [{ label: "印象に残ったこと", question: "今日いちばん印象に残ったこと", text: "楽しかった", chips: [] }],
    body: "関西を、おもろくする夜。に参加しました。とても楽しい時間でした。皆さんはどんな夜を過ごしましたか？",
  },
];
for (const c of cases) {
  const r = await fetch(URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ answers: c.answers, style, tone: "straight", action: "ishizaka", body: c.body, clientId: "try-ishizaka-" + Date.now() }),
  });
  const j = await r.json();
  console.log("===== " + c.name + "（" + r.status + "）\n" + (j.body || JSON.stringify(j)) + "\n");
}
