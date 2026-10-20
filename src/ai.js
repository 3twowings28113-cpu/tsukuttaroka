/*
 * AIへの指示文と、AIの出力の後始末。
 * 文章の書き方を変えたいときは SYSTEM_PROMPT を直す（ハッシュタグは画面側で自動で付く）。
 */

export const TONE_IDS = ["emo", "humor", "straight"];

// 表記と出典のルール（投稿文とプロフィール文の両方に入れる）
const NOTATION_RULES = `・「LinkedIn」は、LとIだけ大文字で書く（Linkedin、linkedin、Linked In、リンクトイン とは書かない）。
・「LinkedIn Learning」は、LinkedIn と Learning の間に半角スペースを入れて書く。
・出典のない数字や情報は書かない。統計・調査結果・割合・利用者数・ランキング・「〇割の人が」のような一般論の数字は、回答に書かれていなければ使わない。LinkedInの機能や評判の説明も、回答にないものは書かない。`;

// 作るのは常に1本。トーン（エモい・ユーモア・学び）は書き方の選択で決める
export const patternCount = () => 1;

const LENGTH_RULE = {
  短め: "120〜200字",
  ふつう: "200〜350字",
  しっかり: "350〜500字",
};
const EMOJI_RULE = {
  なし: "0個",
  ちょっと: "1〜2個",
  多め: "3〜5個。毎行には付けない",
};
const KANSAI_RULE = {
  なし: "標準語",
  ちょい足し: "軽い関西弁をまぜる",
  こってり: "関西弁。読みやすさは保つ",
};
const ALLOWED = {
  formality: ["おまかせ", "です・ます", "だ・である"],
  kansai: Object.keys(KANSAI_RULE),
  length: Object.keys(LENGTH_RULE),
  emoji: Object.keys(EMOJI_RULE),
  sign: ["なし", "入れる"],
  cheer: ["なし", "入れる"],
  role: ["", "学生", "会社員", "経営者・フリーランス", "その他"],
};

export const SYSTEM_PROMPT = `あなたは、LinkedInの投稿づくりを手伝う、関西出身の編集者です。
回答と好みだけを材料に、その人らしいLinkedIn投稿文を1本書きます（トーンは【トーン】の指定どおり）。投稿は、ビジネスの場で本人が自分の言葉で語るものです。

# 必ず守ること
1. 事実は回答から取る（写真が付いているときは決まり23も）。回答にない人名・数字・発言・エピソード・感想を作らない。材料が少ないときは、盛らずに短くまとめる。
2. 本人の言葉を活かす。回答の言い回しや口ぐせは、できるだけそのまま使う。
3. 学びや気づきは具体的に書く。「勉強になった」「刺激を受けた」だけで終わらせない。
4. 感謝の回答があれば自然に入れる。人名は回答に書かれたものだけを使い、名前の直前に「@」を付けてメンションの形にする（例：@山下 翼）。敬称は付けない。
5. 実績・成果の回答があるときは、数字はそのまま使い、作業の話より結果の話を先に出す。自慢ではなく、役に立った情報として書く。
6. 失敗・つまずきの回答があるときは、言い訳を減らし、そこから得た学びと次の行動で締める。失敗の話より学びが残る分量にする。
7. おすすめ・紹介の回答があるときは、押し売りにならず「何に困ってる人に、どう役に立つか」で語る。
8. 「読者に聞いてみる」で締めるときは、誰でも2〜3語で答えられる軽い問いかけにする。
9. 特定のイベント名・会社名は、回答か【参加したイベント】に書かれたときだけ入れる。【参加したイベント】があるときは、そのイベント名を本文に1回、自然に入れる（書き出しの3行の中か、締めの近く）。
10. ハッシュタグ（#）は書かない。あとで自動で付く。メンション（@）は、人の名前の直前にだけ付ける（決まり4と20のとおり）。
11. マークダウンを使わない。LinkedInは太字や見出しを表示できないので、**、#、行頭の「-」「*」は使わない。区切りが必要なら【】や「・」を使う。
12. 書き出しの1文で手を止めさせる。スマホでは最初の3行ほどしか見えないので、3行以内で続きを読みたくさせる。
13. 2〜3文ごとに改行し、段落の間に空行を1つ入れる。
14. 締めを毎回、問いかけやコメントのお願いにしない。「コメントで教えてください」のようなお願いは、「読者に聞いてみる」の回答があるときか、話の流れでどうしても自然なときだけにする。それ以外は、本人の次の一歩や、いまの気持ちで締める。
15. 好みに従う（文体、関西弁、長さ、絵文字、入れたい一言）。「入れたい一言」は言い回しを変えずに、そのまま入れる。
16. 立場の指定があれば、その立場の人が書いたと自然に読める視点にする。ただし回答にない事実は足さない。
17. 同じ言い回しや同じ語尾を、3回以上くり返さない。
18. 「もらった魅力」の回答は、相手から受け取った言葉として書く（例：「〇〇と言ってもらえた」）。自慢に聞こえないよう、うれしさや意外さ、言葉をくれた相手への感謝と一緒に書く。回答にない褒め言葉を足さない。
19. カレンダーの予定の回答があるときは、予定の名前を勝手に詳しく説明しない。本人の回答と合わせて、やったこと・学びとして自然に書く。
20. アプリの宣伝が「入れる」のときは、本文の終わりのほうに、このアプリを作った人への一文を1回だけ入れる。形は「ちなみにこの文章は、@山下 翼 が作ったアプリ『投稿、つくったろか。』で作りました」のような文。名前の直前に「@」を付ける。「なし」のときは、絶対に入れない。
21. 【投稿テーマ】の指定があるときは、そのテーマに沿った投稿にする。回答とカレンダーの予定はテーマの材料として使い、テーマに関係が薄い話は減らすか書かない。テーマに書かれていない事実は作らない。テーマそのものを文章に書くかは、自然なほうを選ぶ。
22. 【この人の書き方のくせ】があるときは、そこに書かれた一人前・口ぐせ・組み立て・温度感を最優先でまねる（トーン3パターンの型は守りつつ、言葉選びはくせを優先）。長さと絵文字の指定だけは従う。事実は回答から取るルールは変わらない。
23. 【写真】が付いているときは、写真を見て確かに分かること（写っている物、場の様子や雰囲気）だけを材料に足してよい。写っている人の名前・所属、場所、日付、数字、写真の中の文字の意味は、回答に書かれていなければ推測しない。写真の説明を長々と書かず、回答の話を主役にする。写真と回答が食い違うときは回答を優先する。
24. 【好み】の「LinkedInの一文」が「入れる」のときは、終わりのほうに、LinkedInを使うことへの前向きな気持ちを1文だけ、本人の言葉として自然に入れる（例：「LinkedInで発信してみると、新しい自分の可能性が見つかりそうでワクワクします」）。言い回しは投稿の流れに合わせて変えてよい。本人が選んだ一文なので、決まり1の例外としてよい。宣伝口調にせず、LinkedInの機能・数字・評判は書かない。「なし」のときは入れない。
25. 表記と出典は、次のとおりにする。
${NOTATION_RULES}

# トーン（【トーン】の指定どおり、1本だけ書く）
- emo（エモい）：その場の空気や、気持ちが動いた瞬間から書き出す。読み終わると少し温かくなる。
- humor（ユーモア）：関西ノリの一言やツッコミから書き出す。くすっと笑える。自虐や誇張は軽めにし、誰かをいじらない。
- straight（学び）：学びを一文で言い切ってから書き出す。学びを1〜3点に整理し、明日からの行動で締める。

# 出力
次のJSONだけを返す。前後に説明を書かない。
{"patterns":[{"tone":"emo","body":"…"}]}`;

export const ISHIZAKA_STYLE = `【型】上から順に。材料（回答）にない段は省いてよい
1. 1行目：「」のセリフで始める。回答の中に誰かの言葉（言われたこと・聞いた話）があれば、それを言い回しを変えずに「」で引用する。なければ、本人の回答の言葉をそのまま使って、本人の心の叫びとして「」に入れる（例：回答が「先輩とつながれてうれしかった」なら「先輩とつながれた…！」）。回答にない言葉をセリフにしない。セリフの後ろに絵文字を1〜2個。
2. 2行目：【】で囲んだ見出し（20〜60字）。【祝】【ついに】【今日の学び】【はじめての〇〇】のような分類語＋中身の予告＋絵文字。回答にない重要性やニュース性を作らない。
3. 体験：場面を具体的に、回答の言葉で書く。心の声を（　）で1〜2回入れる（例：（え、ほんまに？）（ドキドキ…）（笑））。心の声は、回答に書かれた気持ちや驚きを短く言い換えたものにし、回答にない出来事や事実は入れない。
4. 学び・意味づけ：【今回の学び】の見出しや、✅か「〇」の箇条書き（1項目1〜2文）を使ってよい。学び続けること、つながり、挑戦、常識のアップデート、次の世代、のうち回答に合うものだけにつなげる。無関係なテーマを足さない。
5. 感謝：回答に出てくる人だけ。「〇〇さん、本当にありがとうございました！🙏」の形（人名は決まり4のとおり@を付ける）。
6. 締め：「一緒に〇〇していきましょう！🔥」「これからも挑戦を続けます！🚀」のような前向きな一文。問いかけやコメントのお願いは毎回は置かない（決まり14）。

【ことば】
・一人称は「私」（関西弁の指定があるときは、それに合わせてよい）。
・語尾は「〜なのです」「〜ですよね」「〜と確信しています」で言い切る。「！！」「…」を使ってよい。「〜と思います」を続けて使わない。
・失敗やつまずきは素直に認めて（「お恥ずかしい…」）、学びに変える。
・絵文字は多めに使う。【好み】の絵文字が「ちょっと」でも、この書き方では多めにする（「なし」のときだけ使わない）。目安は本文100字あたり2〜4個。置く場所は、セリフ・見出しの後ろ、段落の終わり、箇条書きの頭、感謝、締め。使う絵文字の例：🌟✨🚀🔥🙏💪🌏⚡💡😊🌱🎉✅。同じ絵文字を3回以上続けない。
・段落は1〜3文ずつ。重要な一文は単独の段落にする。長さは【好み】の指定に従う。
・マークダウン（**、#の見出し、行頭の-）は使わない。区切りは【】、✅、「〇」、空行。

【守ること】
・投稿するのは本人。石坂誠さんや実在の誰かになりすまさず、構成・熱量・ことばの型だけをまねる。石坂さん本人の経歴・家族・肩書きは書かない。
・回答が短くても型は守り、盛らずに短くまとめる。回答にないエピソード、人名、所属、数字、発言、実績、感情を足さない。
・数字や出典のある情報は、回答にあるものだけ。調べた風の情報（「調べてみると」「〇割の人が」）は書かない。
・出力前に、人名・会社名・日付・数字が回答と一致しているか照合する。`;

// ---------- プロフィール文（LinkedInの見出し＋自己紹介）。学生向け ----------
export const PROFILE_PROMPT = `あなたは、学生のLinkedInプロフィールづくりを手伝う編集者です。
回答だけを材料に、LinkedInの「見出し（Headline）」の案を3つと、「自己紹介（About）」の案を1つ書きます。どちらも本人が一人称で書くプロフィールです。

# 必ず守ること
1. 事実は回答から取る。回答にない大学名・学部・学年・団体名・役職・数字・実績・資格・受賞・スキル・人名を作らない。材料が少ないときは、盛らずに短くまとめる。
2. 本人の言葉を活かす。回答の言い回しは、できるだけそのまま使う。
3. 見出しは1案40〜70字を目安にする。「所属｜力を入れていること｜目指していること」のように「｜」で区切ってよい。3案は主役を変える（所属が主役／取り組みが主役／これからが主役 など）。回答に所属がなければ所属は書かない。
4. 自己紹介は250〜500字。です・ます調。1〜2文ごとに改行し、段落の間に空行を1つ入れる。流れは「いま何をしている人か → 力を入れていること（具体的に）→ 強み・大切にしていること → これから挑戦したいこと → つながりたい人への一言」。回答にない段落は書かない。
5. 書き出しの1〜2行で、どんな人かが分かるようにする（スマホでは最初の数行しか見えない）。
6. 学生らしく、背伸びしすぎない。専門用語やカタカナのビジネス語を並べない。「〜と思います」を続けない。
7. 最後は、つながりを歓迎する一文で締める（回答に合わせて。例：「〇〇に関心のある方と、ぜひつながりたいです」）。
8. マークダウン、ハッシュタグ（#）、メンション（@）、絵文字は使わない。
9. 表記と出典は、次のとおりにする。
${NOTATION_RULES}

# 出力
次のJSONだけを返す。前後に説明を書かない。
{"headlines":["…","…","…"],"about":"…"}`;

export const PROFILE_SCHEMA = {
  type: "object",
  properties: {
    headlines: { type: "array", minItems: 3, maxItems: 3, items: { type: "string" } },
    about: { type: "string" },
  },
  required: ["headlines", "about"],
};

// 見出しは1行（LinkedInの見出しは220字まで）
const cleanHeadline = (s) =>
  cleanBody(String(s || "").replace(/\s*\n+\s*/g, " "), "")
    .replace(/^[「『"]+|[」』"]+$/g, "")
    .trim()
    .slice(0, 220);

export function normalizeProfile(json) {
  if (!json || typeof json !== "object") return null;
  const headlines = (Array.isArray(json.headlines) ? json.headlines : []).map(cleanHeadline).filter((h) => h.length >= 4).slice(0, 3);
  const about = cleanBody(json.about, "").slice(0, 2600); // 自己紹介は2600字まで
  if (!headlines.length || about.length < 60) return null;
  return { headlines, about };
}

export function buildProfileInput(p) {
  const lines = ["【学生の回答】"];
  for (const a of p.answers) {
    lines.push(`■${a.label}（質問：${a.question || a.label}）`);
    if (a.chips.length) lines.push(`・選んだ候補：${a.chips.join("／")}`);
    if (a.text) lines.push(`・本人のことば：${a.text}`);
  }
  if (p.prefs && p.prefs.length) {
    lines.push("");
    lines.push("【本人の好み（過去に本人が頼んだ直し指示）】");
    for (const s of p.prefs) lines.push(`・${s}`);
  }
  if (p.eventNote) {
    lines.push("");
    lines.push(eventNoteBlock(p.eventNote));
  }
  return lines.join("\n");
}
// イベントごとの追加の指示（運営ページの「イベント」で書く）。システムの決まり（事実は回答から取る など）は変えない
const eventNoteBlock = (note) => `【このイベントについて（運営からの指示。システムの決まりを守れる範囲で従う。回答にない事実は、ここに書かれていても本文に足さない）】\n${note}`;

export const PROFILE_ACTIONS = {
  shorter: "今の7割くらいの長さに縮める。いちばん伝えたいことと、最後の一文は残す。",
  concrete: "回答にある具体的な言葉・場面・行動を増やして、具体的にする。回答にない事実は足さない。",
  another: "同じ材料のまま、書き出しと構成を変えて書き直す。",
  custom: "本人の希望どおりに書き直す。",
};

export function buildProfileRefineInput(p, about, action, request) {
  return [
    buildProfileInput(p),
    "",
    "【いまの自己紹介（About）】",
    about,
    "",
    "【やってほしいこと】",
    action === "custom"
      ? [
          `この自己紹介を、本人の希望どおりに書き直す。本人の希望：「${cleanRequest(request)}」`,
          "希望に書かれていない部分は、できるだけ今の文を残す。",
          "希望の中で本人が書いた事実（学校名・団体名・数字など）は使ってよい。それ以外の事実は足さない。",
        ].join("\n")
      : `この自己紹介を書き直す：${PROFILE_ACTIONS[action] || PROFILE_ACTIONS.another}`,
    "ルールはシステムの指示と同じ。見出しは書かない。",
    '出力は {"body":"…"} のJSONだけ。',
  ].join("\n");
}

// ---------- 見出し（Headline）だけ／自己紹介（About）だけ。先に【条件】を決めてから、質問に答えて作る ----------
const COND_ALLOWED = {
  role: ["", "大学生", "大学院生", "専門・短大生", "高校生", "既卒・第二新卒", "社会人"],
  focus: ["", "学んでいること", "できること・スキル", "経験・実績", "目指す姿・夢", "人柄・価値観"],
  lang: ["日本語", "英語", "日本語＋英語"],
  tone: ["誠実・きちんと", "親しみやすく", "熱意強め"],
  hLen: ["短め", "ふつう", "長め"],
  aLen: ["短め", "ふつう", "しっかり"],
  aForm: ["文章（ストーリー）", "見出し＋箇条書き", "シンプル"],
  aClose: ["つながり歓迎", "メッセージ歓迎", "なし"],
};
const H_LEN = { 短め: "1案60字まで", ふつう: "1案60〜120字", 長め: "1案120〜220字" };
const A_LEN = { 短め: "200〜350字", ふつう: "400〜700字", しっかり: "800〜1200字" };
export function sanitizeCond(raw) {
  const c = raw && typeof raw === "object" ? raw : {};
  const pick = (k, fb) => (COND_ALLOWED[k].includes(c[k]) ? c[k] : fb);
  const dirs = (Array.isArray(c.dirs) ? c.dirs : [])
    .map((d) => fixLinkedIn(clean(d, 20)))
    .filter(Boolean)
    .slice(0, 3);
  return {
    role: pick("role", ""),
    year: fixLinkedIn(clean(c.year, 20)),
    dirs,
    focus: pick("focus", ""),
    lang: pick("lang", "日本語"),
    tone: pick("tone", "誠実・きちんと"),
    hLen: pick("hLen", "ふつう"),
    aLen: pick("aLen", "ふつう"),
    aForm: pick("aForm", "文章（ストーリー）"),
    aClose: pick("aClose", "つながり歓迎"),
    keywords: fixLinkedIn(clean(c.keywords, 80)),
  };
}

export const HEADLINE_PROMPT = `あなたは、LinkedInのプロフィールづくりを手伝う編集者です。
【条件】と【回答】だけを材料に、LinkedInの「見出し（Headline）」の案を5つ書きます。見出しは名前のすぐ下に出る一行で、検索結果やつながり申請のときに最初に読まれます。

# 必ず守ること
1. 事実は【条件】と【回答】から取る。回答にない学校名・学部・学年・会社名・役職・団体名・数字・実績・資格・受賞・スキルを作らない。材料が少ないときは、盛らずに短くまとめる。
2. 【条件】の「目指す方向」は本人の希望。「〇〇志望」「〇〇に関心」「〇〇を目指す」のように書き、すでにその仕事をしているようには書かない。
3. 1案は1行。長さは【条件】の長さに合わせる（LinkedInの上限は220字）。
4. 区切りには「｜」を使ってよい（例：「所属｜取り組み｜目指す姿」）。区切りは1案に3つまで。
5. 5案は主役を変える。1案目は【条件】の「いちばん伝えたいこと」を主役にする（指定なしなら、回答でいちばん具体的なもの）。残りは、所属・学んでいること／スキル・経験や数字・目指す姿・人柄のうち、回答にあるものを主役にする。同じ言い回しを使い回さない。
6. 「〜をしています」のような文ではなく、名詞で言い切る形を中心にする。
7. 「頑張ります」「よろしくお願いします」、中身のない流行語、根拠のない最上級（「No.1」「最強」など）は使わない。
8. 言語は【条件】に従う。「英語」は自然な英語で書く（学校名・会社名は回答の表記のまま、または一般的な英語表記）。「日本語＋英語」は、日本語のあとに「｜」で英語を続け、全体で220字以内にする。
9. 雰囲気は【条件】に合わせる（誠実・きちんと／親しみやすく／熱意強め）。
10. 【条件】の「入れたいキーワード」があれば、5案のうち3案以上に自然に入れる。
11. マークダウン、ハッシュタグ（#）、メンション（@）、絵文字は使わない。
12. 表記と出典は、次のとおりにする。
${NOTATION_RULES}

# 出力
次のJSONだけを返す。前後に説明を書かない。
{"headlines":["…","…","…","…","…"]}`;

export const ABOUT_PROMPT = `あなたは、LinkedInのプロフィールづくりを手伝う編集者です。
【条件】と【回答】だけを材料に、LinkedInの「自己紹介（概要・About）」を1つ書きます。本人が一人称で書くプロフィールです。

# 必ず守ること
1. 事実は【条件】と【回答】から取る。回答にない学校名・学部・学年・会社名・役職・団体名・数字・実績・資格・受賞・スキル・人名・エピソードを作らない。材料が少ないときは、盛らずに短くまとめる。
2. 【条件】の「目指す方向」は本人の希望として書く（「〇〇に関心があります」「〇〇を目指しています」）。
3. 書き出しの2行で「いま何をしている、どんな人か」が分かるようにする。LinkedInでは最初の数行しか見えず「…もっと見る」で続きが開くので、ここで続きを読みたくさせる。
4. 長さは【条件】の長さに合わせる（LinkedInの上限は2600字）。
5. 形は【条件】に従う。
・文章（ストーリー）：いまの取り組み → 力を入れてきた経験（具体的に）→ そこから得た強み・学び → これからの目標 → 最後の一言、の流れ。1〜2文ごとに改行し、段落の間に空行を1つ入れる。
・見出し＋箇条書き：短い導入の2行のあと、【いま取り組んでいること】【強み】【これから】のような【】の小見出しと「・」の箇条書きで整理する。回答にない項目の小見出しは作らない。
・シンプル：3〜5文の短い自己紹介。
6. 雰囲気は【条件】に合わせる（誠実・きちんと／親しみやすく／熱意強め）。です・ます調。「〜と思います」を続けて使わない。
7. 最後の一言は【条件】に従う。「つながり歓迎」は「〇〇に関心のある方と、ぜひつながりたいです」のように回答に合わせて書く。「メッセージ歓迎」は、気軽にメッセージをもらえるとうれしい、という一文を入れる。「なし」は締めの呼びかけを書かない。
8. 言語は【条件】に従う。「英語」は自然な英語で書く。「日本語＋英語」は、日本語の全文のあとに空行を入れ、「English」の1行と、同じ内容の英語版を続ける（合わせて2600字以内。長くなるときは英語版を短くまとめる）。
9. 【条件】の「入れたいキーワード」があれば、自然な文の中に入れる。
10. 学生は、学生らしく背伸びしすぎない。社会人は、仕事の中身が伝わる言葉で書く。専門用語やカタカナのビジネス語を並べない。
11. マークダウン（**、#の見出し、行頭の-）、ハッシュタグ（#）、メンション（@）、絵文字は使わない。区切りは【】と「・」と空行。
12. 表記と出典は、次のとおりにする。
${NOTATION_RULES}

# 出力
次のJSONだけを返す。前後に説明を書かない。
{"about":"…"}`;

export const HEADLINES_SCHEMA = {
  type: "object",
  properties: { headlines: { type: "array", minItems: 5, maxItems: 5, items: { type: "string" } } },
  required: ["headlines"],
};
export const ABOUT_SCHEMA = { type: "object", properties: { about: { type: "string" } }, required: ["about"] };

export function normalizeHeadlines(json) {
  const list = json && Array.isArray(json.headlines) ? json.headlines : Array.isArray(json) ? json : [];
  const out = [];
  for (const h of list.map(cleanHeadline)) if (h.length >= 4 && !out.includes(h)) out.push(h);
  return out.length >= 3 ? out.slice(0, 5) : null;
}
export function normalizeAbout(json) {
  const about = cleanBody(json && (json.about || json.body), "").slice(0, 2600);
  return about.length >= 60 ? about : null;
}

function condBlock(c, kind) {
  const lines = ["【条件】（本人が選んだもの。立場・学年・目指す方向・キーワードは、本人が書いた事実として使ってよい）"];
  lines.push(`・立場：${c.role || "指定なし"}${c.year ? `（${c.year}）` : ""}`);
  lines.push(`・目指す方向（本人の希望）：${c.dirs.length ? c.dirs.join("／") : "指定なし"}`);
  lines.push(`・いちばん伝えたいこと：${c.focus || "指定なし"}`);
  lines.push(`・言語：${c.lang}`);
  lines.push(`・雰囲気：${c.tone}`);
  if (kind === "headline") lines.push(`・長さ：${c.hLen}（${H_LEN[c.hLen]}）`);
  else {
    lines.push(`・長さ：${c.aLen}（${A_LEN[c.aLen]}${c.lang === "日本語＋英語" ? "。日本語の部分の長さ" : ""}）`);
    lines.push(`・形：${c.aForm}`);
    lines.push(`・最後の一言：${c.aClose}`);
  }
  lines.push(`・入れたいキーワード：${c.keywords || "なし"}`);
  return lines.join("\n");
}
function answersBlock(p) {
  const lines = ["【回答】"];
  for (const a of p.answers) {
    lines.push(`■${a.label}（質問：${a.question || a.label}）`);
    if (a.chips.length) lines.push(`・選んだ候補：${a.chips.join("／")}`);
    if (a.text) lines.push(`・本人のことば：${a.text}`);
  }
  return lines.join("\n");
}
export function buildPartInput(p, kind) {
  const parts = [condBlock(p.cond, kind), answersBlock(p)];
  if (p.prefs && p.prefs.length) parts.push(`【本人の好み（過去に本人が頼んだ直し指示）】\n${p.prefs.map((s) => `・${s}`).join("\n")}`);
  if (p.eventNote) parts.push(`${eventNoteBlock(p.eventNote)}\n※いま作っているのは投稿ではなく、プロフィールの${kind === "headline" ? "見出し" : "自己紹介"}。イベントの説明は参考にとどめ、イベント名や参加したことは、回答に書かれていなければ入れない。`);
  return parts.join("\n\n");
}

export const HEADLINE_ACTIONS = {
  shorter: "5案とも、いまより短くする。いちばん伝えたいことは残す。",
  concrete: "回答にある具体的な言葉・数字・取り組みを使って、5案とも具体的にする。回答にない事実は足さない。",
  english: "5案とも、自然な英語にする。",
  bilingual: "5案とも「日本語｜English」の形にする（1案220字以内）。",
  another: "同じ材料で、いまの5案とはちがう切り口の5案を新しく書く。",
  custom: "本人の希望どおりに、5案を書き直す。",
};
export const ABOUT_ACTIONS = {
  shorter: "今の7割くらいの長さに縮める。書き出しの2行と、最後の一言は残す。",
  concrete: "回答にある具体的な言葉・場面・行動・数字を増やして、具体的にする。回答にない事実は足さない。",
  friendly: "事実は変えずに、もっと親しみやすい言い回しにする。です・ます調は保つ。",
  english: "日本語の自己紹介のあとに空行と「English」の1行を入れ、同じ内容の英語版を続ける（全体で2600字以内）。すでに英語版があれば整える。",
  another: "同じ材料のまま、書き出しと構成を変えて書き直す。",
  custom: "本人の希望どおりに書き直す。",
};
export function buildPartRefineInput(p, kind, current, action, request) {
  const acts = kind === "headline" ? HEADLINE_ACTIONS : ABOUT_ACTIONS;
  const cur = kind === "headline" ? `【いまの見出し案】\n${String(current || "").split("\n").filter(Boolean).map((h, i) => `${i + 1}. ${h}`).join("\n")}` : `【いまの自己紹介（About）】\n${current}`;
  return [
    buildPartInput(p, kind),
    "",
    cur,
    "",
    "【やってほしいこと】",
    action === "custom"
      ? [
          `本人の希望：「${cleanRequest(request)}」。この希望どおりに書き直す。`,
          "希望に書かれていない部分は、できるだけ今の文を残す。",
          "希望の中で本人が書いた事実（学校名・団体名・数字など）は使ってよい。それ以外の事実は足さない。",
        ].join("\n")
      : acts[action] || acts.another,
    "ルールはシステムの指示と同じ。",
    kind === "headline" ? '出力は {"headlines":["…","…","…","…","…"]} のJSONだけ。' : '出力は {"about":"…"} のJSONだけ。',
  ].join("\n");
}

// 「書き方」（作る前に選ぶ）。空はおまかせ
export const MODES = ["", "first", "ishizaka", "custom"];
const MODE_RULE = {
  first: `文章は、次の流れで書く。トーンは【トーン】のとおり。
・1〜2行目で「LinkedInに、はじめて投稿します」と分かるようにする（言い方は自然に変えてよい）。
・次に短い自己紹介。使ってよいのは【自己紹介】と【立場】に書かれたことだけ。どちらもなければ自己紹介は書かない。
・最近感じたことを、回答から1〜2つ。
・これからやってみたいことと、「これからよろしくお願いします」のような、つながりを歓迎する一言。
・専門用語・カタカナのビジネス語・難しい言い回しは使わない。締めは、これからの一歩やあいさつでよい（問いかけにしなくてよい）。
・はじめてらしい少しの緊張や照れはよいが、自分を下げすぎない。`,
  ishizaka: `文章は、次の「石坂さん風」の型で書く。トーンは【トーン】のとおりで、見出しの言葉選びと後段の意味づけに出す。

${ISHIZAKA_STYLE}`,
};
// 石坂さん風の型は、運営ページで書きかえられる（p.ishizakaStyle）。書きかえがなければ上の型
const ishizakaRule = (style) => `文章は、次の「石坂さん風」の型で書く。トーンは【トーン】のとおりで、見出しの言葉選びと後段の意味づけに出す。

${style}`;
const ishizakaRefine = (style) => `石坂さん風（「」のセリフで始まり、【】の見出し、（心の声）、絵文字多め）の投稿スタイルで書き直す。中身は本人の回答だけ。書き方の型だけをまねる。トーン（エモい・ユーモア・学び）の書き出しの決まりより、この型を優先する。

${style}`;

// 運営ページで書きかえられる指示文の初期値（書きかえを消すと、これに戻る）
export const PROMPT_DEFAULTS = {
  system: SYSTEM_PROMPT,
  headline: HEADLINE_PROMPT,
  about: ABOUT_PROMPT,
  ishizaka: ISHIZAKA_STYLE,
  profile: PROFILE_PROMPT,
};
export const PROMPT_KEYS = Object.keys(PROMPT_DEFAULTS);

// 自分で入れた書き方の指示（customモード）。毎回変わるので文を組み立てる
const CUSTOM_RULE_HEAD = `次の【書き方の指定】（本人が入れた指示）の型とふるまいに従って書く。ただし、事実は回答から取ること、ハッシュタグ（#）は書かないこと、この文のほかの決まりは守る。指示が「〜風の誰か」のときも、実在の人物になりすますのでなく型だけをまねる。`;
const CUSTOM_RULE_TAIL = `指示がない部分は、システムの決まりどおりにする。`;

export const REFINE_ACTIONS = {
  shorter: "今の7割くらいの長さに縮める。いちばん伝えたいことと、締めの一文は残す。",
  hotter: "気持ちの熱量を上げる。言い切りを増やし、感情が伝わる言葉を選ぶ。大げさな作り話はしない。",
  concrete: "回答にある具体的な言葉・場面・行動を増やして、具体的にする。回答にない事実は足さない。",
  another: "同じトーンのまま、書き出しと構成を変えて書き直す。",
  ishizaka: ishizakaRefine(ISHIZAKA_STYLE),
  custom: "本人の希望どおりに書き直す。",
};

// 作るパターンのスキーマ（常に1本。toneは指定のトーン）
export function patternsSchema(n, tone) {
  const t = TONE_IDS.includes(tone) ? tone : "emo";
  return {
    type: "object",
    properties: {
      patterns: {
        type: "array",
        minItems: 1,
        maxItems: 1,
        items: {
          type: "object",
          properties: { tone: { type: "string", enum: [t] }, body: { type: "string" } },
          required: ["tone", "body"],
        },
      },
    },
    required: ["patterns"],
  };
}

export const BODY_SCHEMA = {
  type: "object",
  properties: { body: { type: "string" } },
  required: ["body"],
};

// ---------- LinkedInの表記 ----------
// 「LinkedIn」（LとIだけ大文字）、「LinkedIn Learning」（間に半角スペース）にそろえる。
// 音声入力で「リンクトイン」になったものも直す。URL（linkedin.com など）とハッシュタグの中は触らない
export function fixLinkedIn(text) {
  return String(text ?? "")
    .replace(/リンク[トド]イン\s*ラーニング/g, "LinkedIn Learning")
    .replace(/リンク[トド]イン/g, "LinkedIn")
    .replace(/(?<![A-Za-z0-9_./@#＃:-])linked[ 　]?in(?![A-Za-z0-9_/-])(?!\.[A-Za-z])/gi, "LinkedIn")
    .replace(/LinkedIn[ 　]*(?:learning|ラーニング)(?![A-Za-z])/gi, "LinkedIn Learning");
}

// ---------- 入力のチェック ----------
const clean = (v, max) =>
  String(v ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, max);

export function sanitizePayload(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const answers = (Array.isArray(src.answers) ? src.answers : [])
    .slice(0, 15)
    .map((a) => ({
      id: clean(a && a.id, 40),
      label: clean(a && a.label, 40),
      question: clean(a && a.question, 120),
      chips: (Array.isArray(a && a.chips) ? a.chips : []).slice(0, 10).map((c) => fixLinkedIn(clean(c, 40))).filter(Boolean),
      text: fixLinkedIn(clean(a && a.text, 400)),
    }))
    .filter((a) => a.label && (a.text || a.chips.length));
  const st = src.style && typeof src.style === "object" ? src.style : {};
  const pickAllowed = (key, v, fallback) => (ALLOWED[key].includes(v) ? v : fallback);
  const style = {
    formality: pickAllowed("formality", st.formality, "です・ます"),
    kansai: pickAllowed("kansai", st.kansai, "ちょい足し"),
    length: pickAllowed("length", st.length, "ふつう"),
    emoji: pickAllowed("emoji", st.emoji, "ちょっと"),
    sign: pickAllowed("sign", st.sign, "なし"),
    cheer: pickAllowed("cheer", st.cheer, "なし"),
    phrase: fixLinkedIn(clean(st.phrase, 40)),
  };
  const role = pickAllowed("role", clean(src.profile && src.profile.role, 20), "");
  const who = clean(src.name, 40).replace(/\s+/g, " ");
  const theme = fixLinkedIn(clean(src.theme, 60));
  const voice = clean(src.voice, 2000);
  const mode = MODES.includes(src.mode) ? src.mode : "";
  const intro = mode === "first" ? fixLinkedIn(clean(src.intro, 60)).replace(/\s+/g, " ") : "";
  const stylePrompt = mode === "custom" ? clean(src.stylePrompt, 800) : "";
  const tone = TONE_IDS.includes(src.tone) ? src.tone : "emo";
  const prefs = (Array.isArray(src.prefs) ? src.prefs : [])
    .slice(0, 8)
    .map((s) => clean(s, 80))
    .filter(Boolean);
  // kind：post＝投稿文／headline＝見出しだけ／about＝自己紹介だけ／profile＝見出しと自己紹介をまとめて（前の版）
  const kind = ["profile", "headline", "about"].includes(src.kind) ? src.kind : "post";
  const cond = sanitizeCond(src.pcond);
  // eventNote（イベントごとのAIへの追加の指示）と ishizakaStyle（石坂さん風の型の書きかえ）は、サーバーが入れる。端末からは受け取らない
  return { answers, style, profile: { role }, name: who, theme, voice, mode, intro, stylePrompt, prefs, tone, photos: 0, kind, cond, eventNote: "", eventName: "", ishizakaStyle: "" };
}

// 写真（端末で長辺1024pxのJPEGにしてから届く）。形と大きさだけ確かめる。中身の確認はAI側に任せる
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const IMAGE_MAX = 10;
export const IMAGE_MAX_CHARS = 700000; // 1枚あたりのbase64の長さ（約500KB）
export function sanitizeImages(raw) {
  return (Array.isArray(raw) ? raw : [])
    .slice(0, IMAGE_MAX)
    .map((im) => ({
      mime: IMAGE_TYPES.includes(im && im.mime) ? im.mime : "",
      data: typeof (im && im.data) === "string" ? im.data : "",
    }))
    .filter((im) => im.mime && im.data.length >= 100 && im.data.length <= IMAGE_MAX_CHARS && /^[A-Za-z0-9+/]+$/.test(im.data.slice(0, 200)));
}

// ---------- AIに渡す文 ----------
export function buildUserInput(p) {
  const lines = ["【参加者の回答】"];
  for (const a of p.answers) {
    lines.push(`■${a.label}（質問：${a.question || a.label}）`);
    if (a.chips.length) lines.push(`・選んだ候補：${a.chips.join("／")}`);
    if (a.text) lines.push(`・本人のことば：${a.text}`);
  }
  lines.push("");
  if (p.photos) {
    lines.push(`【写真】${p.photos}枚を添付（決まり23のとおり、写真を見て確かに分かることだけ使う）`);
    lines.push("");
  }
  if (p.theme) {
    lines.push(`【投稿テーマ】${p.theme}`);
    lines.push("");
  }
  if (p.voice) {
    lines.push("【この人の書き方のくせ（過去の投稿から分析ずみ。最優先でまねる）】");
    lines.push(p.voice);
    lines.push("");
  }
  if (p.prefs && p.prefs.length) {
    lines.push("【本人の好み（過去に本人が頼んだ直し指示。今回もこの傾向で、最初から）】");
    for (const s of p.prefs) lines.push(`・${s}`);
    lines.push("");
  }
  if (p.eventName) {
    lines.push(`【参加したイベント】${p.eventName}（本人がこのイベントに参加して書く投稿。決まり9のとおり、名前を1回入れる）`);
    lines.push("");
  }
  lines.push(`【立場】${p.profile.role || "指定なし"}`);
  lines.push(`【トーン】${p.tone}（上のトーンの決まりどおり、1本だけ書く）`);
  lines.push("【好み】");
  lines.push(`・文体：${p.style.formality === "おまかせ" ? "おまかせ（本文に合う自然なほう）" : p.style.formality}`);
  lines.push(`・関西弁：${p.style.kansai}（${KANSAI_RULE[p.style.kansai]}）`);
  lines.push(`・長さ：${p.style.length}（本文${LENGTH_RULE[p.style.length]}）`);
  // 石坂さん風は絵文字多め（「なし」を選んだときだけ使わない）
  lines.push(p.mode === "ishizaka" && p.style.emoji !== "なし" ? "・絵文字：多め（石坂さん風なので、本文100字あたり2〜4個）" : `・絵文字：${p.style.emoji}（${EMOJI_RULE[p.style.emoji]}）`);
  lines.push(`・入れたい一言：${p.style.phrase ? `「${p.style.phrase}」` : "なし"}`);
  lines.push(`・アプリの宣伝：${p.style.sign}${p.style.sign === "入れる" ? "（システムの決まり20の一文を入れる）" : ""}`);
  lines.push(`・LinkedInの一文：${p.style.cheer}${p.style.cheer === "入れる" ? "（システムの決まり24の一文を入れる）" : "（入れない）"}`);
  if (p.mode === "first") lines.push(`【自己紹介】${p.intro || "なし"}`);
  if (p.mode === "custom") {
    lines.push("");
    lines.push(`【書き方の指定】（本人が入れた指示。トーンの書き出しの決まりより、こちらを優先する）`);
    lines.push(`${CUSTOM_RULE_HEAD}${p.stylePrompt || "（指示なし。システムの決まりどおりでよい）"}\n${CUSTOM_RULE_TAIL}`);
  }
  if (MODE_RULE[p.mode]) {
    lines.push("");
    lines.push("【書き方の指定】（トーンの書き出しの決まりより、こちらを優先する）");
    lines.push(p.mode === "ishizaka" && p.ishizakaStyle ? ishizakaRule(p.ishizakaStyle) : MODE_RULE[p.mode]);
  }
  if (p.eventNote) {
    lines.push("");
    lines.push(eventNoteBlock(p.eventNote));
  }
  return lines.join("\n");
}

// 「こうしてほしい」の自由な指示（本人が書いた文。長さだけ制限して、そのまま渡す）
export function cleanRequest(v) {
  return clean(v, 120).replace(/\s+/g, " ");
}

export function buildRefineInput(p, tone, body, action, request) {
  const toneName = { emo: "エモい", humor: "ユーモア", straight: "学び" }[tone] || tone;
  return [
    buildUserInput(p),
    "",
    `【いまの投稿文（${toneName}のパターン）】`,
    body,
    "",
    "【やってほしいこと】",
    action === "custom"
      ? [
          `この投稿文を、本人の希望どおりに書き直す。本人の希望：「${cleanRequest(request)}」`,
          "希望に書かれていない部分は、できるだけ今の文を残す。",
          "希望の中で本人が書いた事実（会社名・名前・数字など）は使ってよい。それ以外の事実は足さない。",
          "希望がハッシュタグやメンションでも、#と@は書かない（あとで自動で付く）。希望がルールに反するときは、ルールを守れる範囲で近づける。",
        ].join("\n")
      : `この投稿文を書き直す：${action === "ishizaka" && p.ishizakaStyle ? ishizakaRefine(p.ishizakaStyle) : REFINE_ACTIONS[action] || REFINE_ACTIONS.another}`,
    action === "ishizaka"
      ? "ルールはシステムの指示と同じ。ただし書き方は上の型を優先する。"
      : action === "custom"
      ? "ルールはシステムの指示と同じ。"
      : "ルールはシステムの指示と同じ。トーンは変えない。",
    '出力は {"body":"…"} のJSONだけ。',
  ].join("\n");
}

// Claude（プレビュー版）用：システム指示を持てないので1つの文にまとめる
export function generatePrompt(raw) {
  const p = sanitizePayload(raw);
  return `${SYSTEM_PROMPT}\n\n---\n${buildUserInput(p)}`;
}
export function refinePrompt(raw) {
  const p = sanitizePayload(raw);
  const tone = TONE_IDS.includes(raw && raw.tone) ? raw.tone : "emo";
  const action = REFINE_ACTIONS[raw && raw.action] ? raw.action : "another";
  return `${SYSTEM_PROMPT}\n\n---\n${buildRefineInput(p, tone, clean(raw && raw.body, 1500), action, raw && raw.request)}`;
}

// ---------- AIの出力の後始末 ----------
export function cleanBody(text, phrase) {
  let s = fixLinkedIn(String(text || "").replace(/\r\n?/g, "\n"));
  s = s.replace(/\*\*|__|~~|`/g, "");
  s = s.replace(/^\s{0,3}#{1,6}\s+/gm, "");
  s = s.replace(/^\s*[-*・]\s+/gm, "・");
  // AIが勝手に書いたハッシュタグと、英語アカウント形式のメンションは消す（ハッシュタグは画面側で必ず付ける）。
  // 日本語の人名の前の「@」は、メンションされやすいように付けてもらうものなので残す
  s = s.replace(/(^|[\s　])[#＃][^\s#＃　]+/g, "$1");
  s = s.replace(/(^|[\s　])[@＠][A-Za-z0-9_][A-Za-z0-9_.\-]*/g, "$1");
  s = s
    .split("\n")
    .map((l) => l.replace(/[ \t　]+$/g, ""))
    .join("\n");
  s = s.replace(/\n{3,}/g, "\n\n").trim();
  const ph = String(phrase || "").trim();
  if (ph && s && !s.includes(ph)) {
    const paras = s.split("\n\n");
    if (paras.length >= 2) paras.splice(paras.length - 1, 0, ph);
    else paras.push(ph);
    s = paras.join("\n\n");
  }
  return s;
}

export function normalizePatterns(json, phrase, n, tone) {
  const list = json && Array.isArray(json.patterns) ? json.patterns : Array.isArray(json) ? json : null;
  if (!list) return null;
  const t = TONE_IDS.includes(tone) ? tone : "emo";
  const hit = list.find((p) => p && p.tone === t) || list[0];
  const body = cleanBody(hit && hit.body, phrase);
  return body.length >= 20 ? [{ tone: t, body }] : null;
}
