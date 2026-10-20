/*
 * 投稿、つくったろか。── 参加者の画面（ブラウザで動く部分）
 * 画面の流れ：ネタをえらぶ → こたえる → じぶん色 → 生成 → えらんで投稿 → 投稿ガイド
 * 文言やネタカードを変えるときは config.js を触る。ここは動きだけ。
 */
(() => {
  "use strict";

  const C = window.APP_CONFIG;
  const MODE = window.APP_MODE === "preview" ? "preview" : "live";

  // イベントごとの色（config.js の theme。運営ページのイベントの色でも上書きできる）。書いていない色は app.css の初期値のまま
  const THEME_VARS = { ground: "--ground", onGround: "--on-ground", onGroundSoft: "--on-ground-soft", onInk: "--on-ink", sheet: "--sheet", focus: "--focus", note: "--note", ink: "--ink", groundText: "--ink-soft", subText: "--muted", accent: "--blue", accentPress: "--blue-press", accentTint: "--blue-tint", mark: "--coral", check: "--check" };
  const HEX = /^#[0-9A-Fa-f]{6}$/;
  function applyTheme(theme) {
    if (!theme) return;
    for (const [k, v] of Object.entries(THEME_VARS)) if (theme[k] && HEX.test(theme[k])) document.documentElement.style.setProperty(v, theme[k]);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta && theme.ground && HEX.test(theme.ground)) meta.setAttribute("content", theme.ground);
  }
  applyTheme(C.theme);
  // イベント専用ページ（public/lscw.html など）。端末に覚えるもの（途中の回答・報告・イベント）は、ページごとに分ける
  const PAGE = window.APP_PAGE && window.APP_PAGE.preset === C.presetId ? window.APP_PAGE : null;
  const PAGE_NS = PAGE ? `.${PAGE.id}` : "";
  const STORE_KEY = "tsukuttaroka.v1" + PAGE_NS;
  const REPORT_KEY = "tsukuttaroka.report" + PAGE_NS; // 「投稿したで！」の報告（最初からつくり直しても残す）
  const CARD = Object.fromEntries(C.cards.map((c) => [c.id, c]));
  // プロフィール文を作る（LinkedInの見出し＋自己紹介）の質問。config.js の profile
  // 見出し（headline）と自己紹介（about）は、別々に作る。先に条件（S.pcond）を決めてから質問。答えは両方で引き継ぐ
  const PF = C.profile || {};
  const PFCARD = Object.fromEntries((PF.cards || []).map((c) => [c.id, c]));
  const PARTS = ["headline", "about"];
  const profileOn = () => !!(PF.enabled && (PF.cards || []).length && PF.headline && PF.about);
  const isProfile = () => PARTS.includes(S.kind);
  const partCfg = (k) => PF[k || S.kind] || {};
  const condDefault = (k) => ((PF.conds || {})[k] && PF.conds[k].default !== undefined ? PF.conds[k].default : ((PF.conds || {})[k] && (PF.conds[k].options || [])[0]) || "");
  const defaultCond = () => ({
    role: condDefault("role"),
    year: "",
    dirs: [],
    dirOther: "",
    focus: condDefault("focus"),
    lang: condDefault("lang") || "日本語",
    tone: condDefault("tone") || "誠実・きちんと",
    hLen: condDefault("hLen") || "ふつう",
    aLen: condDefault("aLen") || "ふつう",
    aForm: condDefault("aForm") || "文章（ストーリー）",
    aClose: condDefault("aClose") || "つながり歓迎",
    keywords: "",
  });
  const TONES = C.tones;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition || null;
  const NS = "http://www.w3.org/2000/svg";

  // ---------- 小道具 ----------
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
  // 「/」は改行してよい位置の目印。plain は目印を消した文、fmt は画面用（、・/ の後ろで改行できる）
  const plain = (s) => String(s ?? "").replace(/\//g, "");
  const fmt = (s) => {
    const t = String(s ?? "");
    return t.includes("/") ? esc(t).replace(/\//g, "<wbr>") : esc(t).replace(/([、・])/g, "$1<wbr>");
  };
  // 運営ページで入れた文（日付の「10/31」などの / をそのまま出す）。、・｜ の後ろで改行できる
  const txt = (s) => esc(s).replace(/([、・｜])/g, "$1<wbr>");
  const pickOne = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const count = (s) => Array.from(s || "").length;
  const rid = () =>
    window.crypto && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
  const store = {
    get() {
      try {
        const raw = localStorage.getItem(STORE_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    },
    set(v) {
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(v));
      } catch {}
    },
    clear() {
      try {
        localStorage.removeItem(STORE_KEY);
      } catch {}
    },
  };

  const reportStore = {
    get() {
      try {
        const v = JSON.parse(localStorage.getItem(REPORT_KEY) || "null");
        return v && v.id && v.name ? v : null;
      } catch {
        return null;
      }
    },
    set(v) {
      try {
        localStorage.setItem(REPORT_KEY, JSON.stringify(v));
      } catch {}
    },
  };
  let REP = reportStore.get();
  const RC = C.report || {};

  // 最初の画面で入れる名前（集計と、報告の名前に使う。最初からつくり直しても残す）
  const NAME_KEY = "tsukuttaroka.name";
  let MYNAME = "";
  try {
    MYNAME = localStorage.getItem(NAME_KEY) || "";
  } catch {}
  const myName = () => MYNAME.replace(/\s+/g, " ").trim().slice(0, 40);
  function saveName(v) {
    MYNAME = String(v || "").slice(0, 40);
    try {
      if (MYNAME.trim()) localStorage.setItem(NAME_KEY, MYNAME);
      else localStorage.removeItem(NAME_KEY);
    } catch {}
  }

  // 主催のフォロー：「開く」を押した＝opened、「フォローした」にチェック＝done（端末に覚えておく）
  // followRequired が false のときは「おすすめ」だけ（始める前に必須にしない）
  const FOLLOW_KEY = "tsukuttaroka.follow" + PAGE_NS;
  let FOLLOW = "";
  try {
    FOLLOW = localStorage.getItem(FOLLOW_KEY) || "";
  } catch {}
  const followNeeded = () => !!C.followUrl && C.followRequired !== false;
  const followed = () => !followNeeded() || FOLLOW === "done";
  const followSuggest = () => !!C.followUrl && C.followRequired === false && FOLLOW !== "done";
  // メンション（1つ：config の mention ／ 2つ以上：mentions。運営ページのイベントでも決められる）
  const mentionList = () => {
    const list = Array.isArray(C.mentions) && C.mentions.length ? C.mentions : C.mention && C.mention.name ? [C.mention] : [];
    return list.filter((m) => m && m.name).slice(0, 5);
  };
  const mentionInText = () => (Array.isArray(C.mentions) && C.mentions.length ? C.mentionInText !== false : !!(C.mention && C.mention.inText));
  const followName = () => C.followName || (mentionList()[0] || {}).name || "主催";
  function setFollow(v) {
    FOLLOW = v;
    try {
      if (v) localStorage.setItem(FOLLOW_KEY, v);
      else localStorage.removeItem(FOLLOW_KEY);
    } catch {}
  }

  // 書き方（作る前に選ぶ）
  const MODES = (C.modes && C.modes.length ? C.modes : [{ id: "", label: "おまかせ" }]).map((m) => ({ ...m, id: m.id || "" }));
  const modeOf = (id, tone) => {
    const hit = MODES.find((m) => m.id === (id || "") && (!tone || !m.tone || m.tone === tone));
    return hit || MODES.find((m) => m.id === (id || "")) || MODES[0];
  };

  // 自分のGemini APIキー（イベント後も各自で使えるように。端末に覚えておく。サーバーには保存しない）
  const KEY_KEY = "tsukuttaroka.geminikey";
  let MYKEY = "";
  try {
    MYKEY = localStorage.getItem(KEY_KEY) || "";
  } catch {}
  function saveApiKey(v) {
    MYKEY = String(v || "").trim().slice(0, 300);
    try {
      if (MYKEY) localStorage.setItem(KEY_KEY, MYKEY);
      else localStorage.removeItem(KEY_KEY);
    } catch {}
  }

  // イベント（運営ページで作る。?e=イベントID で開く）。あいことばが合えば、主催のAIキーで作れる（参加者はキーを作らなくていい）
  const EV_KEY = "tsukuttaroka.event" + PAGE_NS;
  const QS = new URLSearchParams(location.search);
  let EVID = "";
  let EVPASS = "";
  let EVENT = null; // サーバーから読んだもの {id, name, hashtags, cheerAlways, preset, needsPass, hasKey, open, mentions, followUrl, info, schedule, theme}
  try {
    const v = JSON.parse(localStorage.getItem(EV_KEY) || "null");
    if (v && v.id) {
      EVID = String(v.id);
      EVPASS = String(v.pass || "");
    }
  } catch {}
  if (QS.has("e")) {
    const id = String(QS.get("e") || "").trim().toLowerCase().slice(0, 40);
    if (id !== EVID) EVPASS = "";
    EVID = id; // ?e= を空で開くと、イベントから外れる
  } else if (!EVID && PAGE && PAGE.event) EVID = PAGE.event; // イベント専用ページは、そのページのイベントで動く
  // QRに入れたあいことば（?p=）は、読んだらアドレス欄から消す（スクショや共有で広がらないように）
  const URL_PASS = String(QS.get("p") || "").trim().slice(0, 60);
  if (QS.has("p")) {
    QS.delete("p");
    try {
      history.replaceState(null, "", location.pathname + (QS.toString() ? `?${QS}` : "") + location.hash);
    } catch {}
  }
  function saveEvent() {
    try {
      if (EVID) localStorage.setItem(EV_KEY, JSON.stringify({ id: EVID, pass: EVPASS }));
      else localStorage.removeItem(EV_KEY);
    } catch {}
  }
  const eventNeedsPass = () => !!(EVENT && EVENT.needsPass);
  // あいことばのないイベントは、URLを開いただけで、イベントのAIキー（なければサーバーのキー）で作れる
  const eventKeyReady = () => !!(EVENT && EVENT.hasKey && (!EVENT.needsPass || EVPASS));

  // Googleカレンダー（秘密のiCalアドレス）。URLはこの端末にだけ保存する
  const CAL_KEY = "tsukuttaroka.cal";
  let CALURL = "";
  try {
    CALURL = localStorage.getItem(CAL_KEY) || "";
  } catch {}
  function saveCalUrl(v) {
    CALURL = String(v || "").trim().slice(0, 300);
    try {
      if (CALURL) localStorage.setItem(CAL_KEY, CALURL);
      else localStorage.removeItem(CAL_KEY);
    } catch {}
  }

  // じぶんの書き方の癖（過去の投稿を1回だけ分析した結果。この端末にだけ保存する）
  const VOICE_KEY = "tsukuttaroka.voice";
  let VOICE = { text: "", on: false };
  try {
    const v = JSON.parse(localStorage.getItem(VOICE_KEY) || "null");
    if (v && typeof v.text === "string" && v.text) VOICE = { text: v.text, on: v.on !== false };
  } catch {}
  function saveVoice() {
    try {
      if (VOICE.text) localStorage.setItem(VOICE_KEY, JSON.stringify(VOICE));
      else localStorage.removeItem(VOICE_KEY);
    } catch {}
  }

  // 上級者向け：Gemini以外のAI（Claude・OpenAI互換）をつなぐ設定
  const AISET_KEY = "tsukuttaroka.aiset";
  let AISET = null;
  try {
    const v = JSON.parse(localStorage.getItem(AISET_KEY) || "null");
    if (v && v.key && v.model) AISET = { provider: "openai", ...v };
  } catch {}
  const advOn = () => !!(AISET && AISET.on && AISET.key && AISET.model);
  const aiReady = () => !!MYKEY || advOn() || eventKeyReady();
  function saveAISet() {
    try {
      if (AISET && AISET.on && AISET.key && AISET.model) localStorage.setItem(AISET_KEY, JSON.stringify(AISET));
      else localStorage.removeItem(AISET_KEY);
    } catch {}
  }

  // 文字を大きく（画面全体を一回り大きくする。端末に覚えておく）
  const BIG_KEY = "tsukuttaroka.big";
  const isBig = () => document.documentElement.classList.contains("is-big");
  function setBig(on) {
    document.documentElement.classList.toggle("is-big", on);
    try {
      if (on) localStorage.setItem(BIG_KEY, "1");
      else localStorage.removeItem(BIG_KEY);
    } catch {}
  }
  try {
    if (localStorage.getItem(BIG_KEY) === "1") document.documentElement.classList.add("is-big");
  } catch {}

  const ICON = {
    check: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    back: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    mic: '<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><rect x="8.5" y="3" width="7" height="11.5" rx="3.5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M8.5 21h7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
    pen: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M4 20l1-4.2L15.6 5.2a2 2 0 0 1 2.8 0l.4.4a2 2 0 0 1 0 2.8L8.2 19 4 20z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/></svg>',
    copy: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2.5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" fill="none" stroke="currentColor" stroke-width="2.2"/></svg>',
    person: '<svg viewBox="0 0 48 48" width="48" height="48" aria-hidden="true"><circle cx="24" cy="19" r="8" fill="currentColor"/><path d="M9 41c1.8-8 8-12 15-12s13.2 4 15 12" fill="currentColor"/></svg>',
  };

  // ---------- 状態 ----------
  const SIZES = C.sizes.map((z) => z.n);
  const setsOf = (n) => C.sets.filter((s) => s.size === n);
  const setById = (id) => C.sets.find((s) => s.id === id) || null;
  const setCards = (id) => ((setById(id) || { cards: [] }).cards || []).filter((cid) => CARD[cid]);
  const recommendedSet = (n) => setsOf(n).find((s) => s.recommended) || setsOf(n)[0] || null;
  // 問数を変えたとき：同じ theme のセットがあればそれ、なければおすすめ
  const setForSize = (n, theme) => setsOf(n).find((s) => theme && s.theme === theme) || recommendedSet(n);
  const fitSize = (len) => SIZES.find((n) => n >= len) || SIZES[SIZES.length - 1];
  const styleDefault = (k) => (!C.style[k] ? "" : C.style[k].default !== undefined ? C.style[k].default : C.style[k].options[0]);
  const defaultStyle = () => ({
    role: styleDefault("role"),
    formality: styleDefault("formality"),
    kansai: styleDefault("kansai"),
    length: styleDefault("length"),
    emoji: styleDefault("emoji"),
    sign: styleDefault("sign"),
    cheer: styleDefault("cheer") || "なし",
    phrase: "",
  });
  function freshState(clientId) {
    const size = SIZES.includes(C.defaultSize) ? C.defaultSize : SIZES[0];
    const first = recommendedSet(size);
    return {
      v: 2,
      step: "pick",
      kind: "post", // 作るもの：post＝投稿文／profile＝プロフィール文（見出し＋自己紹介）
      quick: false, // 「おまかせで始める」から来た（じぶん色をとばして、そのまま作る）
      mode: "", // 書き方：""＝おまかせ／first＝はじめての投稿／ishizaka＝石坂さん風
      intro: "", // はじめての投稿の、ひとこと自己紹介
      size,
      setId: first ? first.id : null,
      selected: first ? setCards(first.id) : [C.requiredCardId],
      cursor: 0,
      answers: {},
      free: false, // ボリューム「じぶんで選ぶ」（ネタをいくつでも）
      customTheme: "", // 「じぶんで決める」のテーマ（AIにそのまま渡る）
      style: defaultStyle(),
      pcond: defaultCond(), // 見出し・自己紹介の条件
      presults: { headline: null, about: null }, // 見出し {list, edited}／自己紹介 {text, edited}
      results: null,
      tab: TONES[0].id,
      consent: !!C.consentDefault,
      checks: C.checklist.map(() => false),
      done: null,
      sent: [],
      clientId: clientId || rid(),
    };
  }

  // マイ投稿記録（つくった投稿文を、この端末にだけ残す）
  const HIST_KEY = "tsukuttaroka.hist";
  function histGet() {
    try {
      const v = JSON.parse(localStorage.getItem(HIST_KEY) || "[]");
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  }
  function histAdd(entry) {
    try {
      const list = histGet();
      list.unshift(entry);
      localStorage.setItem(HIST_KEY, JSON.stringify(list.slice(0, 20)));
    } catch {}
  }
  function histDel(at) {
    try {
      localStorage.setItem(HIST_KEY, JSON.stringify(histGet().filter((h) => h.at !== at)));
    } catch {}
  }

  // じぶんの好みの履歴（「こうしてほしい」で頼んだ直し指示。この端末にだけ残る。次回の生成に自動で反映する）
  const PREF_KEY = "tsukuttaroka.prefs";
  function prefsGet() {
    try {
      const v = JSON.parse(localStorage.getItem(PREF_KEY) || "[]");
      return Array.isArray(v) ? v.filter((p) => p && typeof p.text === "string" && p.text) : [];
    } catch {
      return [];
    }
  }
  function prefsAdd(text) {
    const t = String(text || "").trim().slice(0, 80);
    if (!t) return;
    try {
      const list = prefsGet().filter((p) => p.text !== t);
      list.unshift({ at: Date.now(), text: t });
      localStorage.setItem(PREF_KEY, JSON.stringify(list.slice(0, 30)));
    } catch {}
  }
  function prefsDel(at) {
    try {
      localStorage.setItem(PREF_KEY, JSON.stringify(prefsGet().filter((p) => p.at !== at)));
    } catch {}
  }
  function prefsClear() {
    try {
      localStorage.removeItem(PREF_KEY);
    } catch {}
  }
  function prefsTop(n) {
    const seen = new Set();
    return prefsGet().filter((p) => (seen.has(p.text) ? false : (seen.add(p.text), true))).slice(0, n);
  }

  let S = freshState();
  // その場だけの状態（保存しない）
  const T = {
    busy: false,
    refining: null,
    editing: false,
    error: "",
    fresh: false,
    loadTimer: null,
    listening: false,
    micBlocked: !SR,
    micReason: SR ? "" : "unsupported",
    swapOpen: false,
    reporting: false,
    ask: "", // 「こうしてほしい」の下書き
    modeFrom: "", // 書き方シートをどこから開いたか（gen＝作る前／regen＝作り直し）
    rep: null, // 報告シートの下書き
    photos: [], // えらんだ写真（4枚まで。端末で小さくしたもの {url, mime, data, kb}。保存しない。リロードで消える）
    photoBusy: false, // 写真を小さくしている途中
    photoWhat: "",
    photoWant: "",
  };

  function save() {
    const copy = { ...S, step: S.step === "loading" ? "style" : S.step, updatedAt: Date.now() };
    store.set(copy);
  }
  function restore(saved) {
    const base = freshState(saved.clientId);
    const st = { ...base, ...saved };
    st.selected = (st.selected || []).filter((id, i, a) => CARD[id] && a.indexOf(id) === i);
    if (!st.selected.includes(C.requiredCardId) && CARD[C.requiredCardId]) st.selected.unshift(C.requiredCardId);
    // 問数（前の版で保存された状態にも対応）。選んでいる数が問数を超えないようにする
    st.size = SIZES.includes(saved.size) ? saved.size : fitSize(st.selected.length);
    if (st.selected.length > st.size) st.selected = st.selected.slice(0, st.size);
    const s = setById(st.setId);
    if (!s || s.size !== st.size || s.cards.length !== st.selected.length || !s.cards.every((id) => st.selected.includes(id))) st.setId = null;
    st.style = { ...defaultStyle(), ...(st.style || {}) };
    if (!MODES.some((m) => m.id === st.mode)) st.mode = "";
    st.intro = String(st.intro || "").slice(0, 60);
    st.stylePrompt = String(st.stylePrompt || "").slice(0, 800);
    st.checks = C.checklist.map((_, i) => !!(st.checks || [])[i]);
    // 前の版の「プロフィール文（見出し＋自己紹介まとめて）」は、見出しと自己紹介に分けて引き継ぐ
    const pr = saved.presults && typeof saved.presults === "object" ? saved.presults : {};
    st.presults = {
      headline: pr.headline && Array.isArray(pr.headline.list) && pr.headline.list.length ? { list: pr.headline.list.map(String).slice(0, 5), edited: !!pr.headline.edited } : null,
      about: pr.about && typeof pr.about.text === "string" && pr.about.text ? { text: pr.about.text, edited: !!pr.about.edited } : null,
    };
    if (st.results && st.results.kind === "profile") {
      const old = st.results.profile || {};
      if (!st.presults.headline && Array.isArray(old.headlines) && old.headlines.length) st.presults.headline = { list: old.headlines.map(String), edited: false };
      if (!st.presults.about && typeof old.about === "string" && old.about) st.presults.about = { text: old.about, edited: !!old.edited };
      st.results = null;
    }
    if (st.kind === "profile") st.kind = "headline";
    st.kind = PARTS.includes(st.kind) && profileOn() ? st.kind : "post";
    const pc = saved.pcond && typeof saved.pcond === "object" ? saved.pcond : {};
    st.pcond = { ...defaultCond(), ...pc, dirs: Array.isArray(pc.dirs) ? pc.dirs.map(String).slice(0, 3) : [] };
    const resultsOk = (r) =>
      r && (r.single
        ? TONES.filter((t) => r[t.id] && typeof r[t.id].body === "string" && r[t.id].body).length === 1
        : TONES.every((t) => r[t.id] && typeof r[t.id].body === "string"));
    if (st.results && !resultsOk(st.results)) st.results = null;
    if (PARTS.includes(st.kind)) {
      const has = !!st.presults[st.kind];
      if (!["pick", "answer", "result"].includes(st.step) || (st.step === "result" && !has)) st.step = has ? "result" : "pick";
    }
    if ((st.step === "result" && !PARTS.includes(st.kind) && !st.results) || (st.step === "done" && !st.done)) st.step = st.results ? "result" : "style";
    if (st.step === "guide" && !st.results) st.step = "style";
    if (!["pick", "answer", "style", "result", "guide", "done"].includes(st.step)) st.step = "pick";
    return st;
  }
  const hasProgress = (st) =>
    st && (st.step !== "pick" || Object.values(st.answers || {}).some((a) => (a.text || "").trim() || (a.chips || []).length));

  // ---------- ネタの並び ----------
  // 最後に必ず聞く、完全に任意のひとつ（入力しなくてもOK。ネタの選択には数えない）
  const FEEL_CARD = {
    id: "feel",
    label: "投稿に入れたい/こと・気持ち",
    caption: "むりには聞かへんで",
    question: "最後にひとつ。投稿に入れたいことや、/伝えたい気持ちはある？/（無くてOK。とばしてな）",
    placeholder: "例：同じことで悩んでる人に、背中を押してほしい",
    required: false,
  };
  // 聞く順番：必須 → 選んだ順（セットの順）→ 入れたいこと・気持ち。自分で足したネタは「締めのネタ」の前に入る
  function flowCards() {
    if (isProfile()) return profileCards();
    const sel = S.selected.map((id) => CARD[id]).filter(Boolean);
    return [...sel.filter((c) => c.required), ...sel.filter((c) => !c.required), FEEL_CARD];
  }
  // 見出し・自己紹介の質問：条件に合わせて、聞き方・例・候補を変える。「いちばん伝えたいこと」の質問は2問目で必須
  const condDirs = () => {
    const c = S.pcond || {};
    const list = [...(c.dirs || [])];
    const other = String(c.dirOther || "").trim().slice(0, 20);
    if (other && !list.includes(other)) list.push(other);
    return list.slice(0, 3);
  };
  function profileCards(kind) {
    const c = S.pcond || {};
    const ids = (partCfg(kind).cards || []).slice();
    const fid = (PF.focusCard || {})[c.focus] || "";
    const ordered = [];
    const push = (id) => {
      if (id && PFCARD[id] && !ordered.includes(id)) ordered.push(id);
    };
    push(ids[0]);
    push(fid);
    ids.forEach(push);
    const work = c.role === "社会人";
    const extra = [];
    for (const d of condDirs()) for (const ch of (PF.dirChips || {})[d] || []) if (!extra.includes(ch)) extra.push(ch);
    return ordered.map((id) => {
      const card = PFCARD[id];
      const base = (work && card.chipsWork) || card.chips || [];
      const chips = card.dirChips ? [...extra, ...base.filter((x) => !extra.includes(x))] : base;
      return {
        ...card,
        question: (work && card.questionWork) || card.question,
        placeholder: (work && card.placeholderWork) || card.placeholder,
        chips: chips.slice(0, 9),
        required: !!card.required || id === fid,
      };
    });
  }
  function addCard(id) {
    const last = C.lastCards || [];
    const at = S.selected.findIndex((x) => last.includes(x));
    if (at === -1 || last.includes(id)) S.selected.push(id);
    else S.selected.splice(at, 0, id);
  }
  function matchSet() {
    const hit = setsOf(S.size).find((s) => s.cards.length === S.selected.length && s.cards.every((id) => S.selected.includes(id)));
    return hit ? hit.id : null;
  }
  const answerOf = (id) => S.answers[id] || { chips: [], text: "" };
  const hasText = (id) => count((answerOf(id).text || "").trim()) >= 2;

  function payload() {
    let answers = flowCards()
      .map((c) => {
        const a = answerOf(c.id);
        return {
          id: c.id,
          label: plain(c.label),
          question: plain(c.question),
          chips: (a.chips || []).slice(0, 10),
          text: (a.text || "").trim().slice(0, 400),
        };
      })
      .filter((a) => a.text || a.chips.length);
    // 写真のこと（えらんでたら、AIにも伝える）
    const pw = (T.photoWhat || "").trim();
    const pq = (T.photoWant || "").trim();
    if (!isProfile() && T.photos.length && (pw || pq)) {
      answers = answers.concat([{ id: "photo", label: "写真のこと", question: "この写真はなに？何を伝えたい？", chips: [], text: [pw && `写真（${T.photos.length}枚）：${pw}`, pq && `伝えたいこと：${pq}`].filter(Boolean).join("｜") }]);
    }
    return {
      answers,
      theme: String(S.customTheme || "").trim().slice(0, 60),
      voice: VOICE.on && VOICE.text ? VOICE.text.slice(0, 2000) : "",
      profile: { role: S.style.role || "" },
      style: {
        formality: S.style.formality,
        kansai: S.style.kansai,
        length: S.style.length,
        emoji: S.style.emoji,
        sign: S.style.sign || "なし",
        cheer: C.cheerAlways ? "入れる" : C.style.cheer ? S.style.cheer || "なし" : "なし",
        phrase: (S.style.phrase || "").trim().slice(0, 40),
      },
      mode: S.mode || "",
      intro: S.mode === "first" ? (S.intro || "").trim().slice(0, 60) : "",
      stylePrompt: S.mode === "custom" ? (S.stylePrompt || "").trim().slice(0, 800) : "",
      prefs: prefsTop(8),
      tone: TONES.some((t) => t.id === (S.startTone || "emo")) ? (S.startTone || "emo") : "emo",
      name: myName(),
      followed: !!C.followUrl && FOLLOW === "done",
      kind: S.kind || "post",
      pcond: isProfile() ? { ...S.pcond, dirs: condDirs() } : undefined,
      event: EVENT ? EVENT.id : "",
      page: PAGE ? PAGE.id : "",
      clientId: S.clientId,
    };
  }
  // 投稿文の最後：主催のメンション（文字）とハッシュタグ
  const mentionText = () => (mentionInText() ? mentionList().map((m) => `@${m.name}`).join(" ") : "");
  const tailText = () => [mentionText(), C.hashtags.join(" ")].filter(Boolean).join("\n");
  const finalText = (tone) => `${(S.results[tone].body || "").trim()}\n\n${tailText()}`;
  function composeUrl(text) {
    const base = C.linkedinComposeUrl || "https://www.linkedin.com/feed/?shareActive=true";
    if (!C.prefillText || !text) return base;
    return base + (base.includes("?") ? "&" : "?") + "text=" + encodeURIComponent(text);
  }

  // ---------- 画面 ----------
  const screen = $("#screen");
  const dock = $("#dock");
  const sheet = $("#sheet");
  const toastEl = $("#toast");
  const STEP_INDEX = { pick: 0, answer: 1, style: 2, loading: 3, result: 3, guide: 3, done: 3 };
  const STEP_NAMES = ["ネタ", "こたえる", "じぶん色", "投稿"];

  function render() {
    const view = { pick: viewPick, answer: viewAnswer, style: viewStyle, loading: viewLoading, result: viewResult, guide: viewGuide, done: viewDone }[S.step] || viewPick;
    const { html, dockHtml } = view();
    screen.innerHTML = html;
    dock.innerHTML = dockHtml ? `<div class="dock-inner">${dockHtml}</div>` : "";
    dock.hidden = !dockHtml;
    document.body.classList.toggle("has-dock", !!dockHtml);
    renderStepper();
    paintClouds(document);
    if (S.step === "answer") autoGrow($("#answer"));
    if (S.step === "result") fitPreview();
  }

  function keepScroll(fn) {
    const y = window.scrollY;
    fn();
    window.scrollTo(0, y);
  }

  function go(step) {
    stopMic();
    S.step = step;
    T.error = "";
    save();
    render();
    window.scrollTo(0, 0);
    const h = $("h1", screen);
    if (h) h.focus({ preventScroll: true });
  }

  function renderStepper() {
    const el = $("#stepper");
    if (!el) return;
    const now = STEP_INDEX[S.step] ?? 0;
    // 結果に飛べるのは、いま作っているもの（投稿文／プロフィール文）の結果があるときだけ
    const reachable = [true, true, true, isProfile() ? !!S.presults[S.kind] : !!S.results];
    // 見出し・自己紹介は「じぶん色」のかわりに、最初に条件を決める
    const steps = isProfile() ? [[0, "条件"], [1, "こたえる"], [3, "できあがり"]] : STEP_NAMES.map((name, i) => [i, name]);
    el.innerHTML = steps.map(([i, name], pos) => {
      const state = i < now ? "is-done" : i === now ? "is-now" : "";
      const can = i !== now && reachable[i] && S.step !== "loading" && !(i === 1 && flowCards().length === 0);
      return `<button type="button" class="dot ${state}" ${can ? `data-act="jump" data-i="${i}"` : "disabled"} aria-label="${pos + 1}. ${name}${i === now ? "（いまここ）" : ""}" ${i === now ? 'aria-current="step"' : ""}>${i < now ? ICON.check : pos + 1}</button>`;
    }).join("");
  }

  // ① ネタをえらぶ
  function viewPick() {
    const n = S.selected.length;
    const full = n >= S.size;
    const badge = '<span class="badge">おすすめ</span>';
    const sizeRows =
      C.sizes
        .map(
          (z) => `<button type="button" class="opt" role="radio" aria-checked="${!S.free && z.n === S.size}" data-act="size" data-n="${z.n}">
          <span class="opt-dot" aria-hidden="true"></span>
          <span class="opt-main">
            <span class="opt-head"><b class="opt-big">${z.n}問</b><span class="opt-name">${esc(z.name)}</span>${z.recommended ? badge : ""}<span class="opt-time">${esc(z.minutes || "")}</span></span>
            <span class="opt-who bx">${fmt(z.who || "")}</span>
          </span>
        </button>`
        )
        .join("") +
      `<button type="button" class="opt" role="radio" aria-checked="${!!S.free}" data-act="sizeFree">
          <span class="opt-dot" aria-hidden="true"></span>
          <span class="opt-main">
            <span class="opt-head"><span class="opt-name">じぶんで選ぶ</span></span>
            <span class="opt-who bx">聞きたいネタを、いくつでもえらぶ（15まで）</span>
          </span>
        </button>`;
    // どんな投稿にする？（テーマ。size=3のセットを代表に出す。3問のセットがないテーマは最初のセット）
    const customOn = !!String(S.customTheme || "").trim();
    const themeReps = [];
    for (const s of C.sets) if (!themeReps.some((t) => t.theme === s.theme)) themeReps.push(C.sets.find((x) => x.theme === s.theme && x.size === 3) || s);
    const curTheme = (setById(S.setId) || {}).theme || "";
    const themeRows =
      themeReps
        .map(
          (s) => `<button type="button" class="opt" role="radio" aria-checked="${!customOn && curTheme === s.theme}" data-act="theme" data-v="${esc(s.theme)}">
          <span class="opt-dot" aria-hidden="true"></span>
          <span class="opt-main">
            <span class="opt-head"><span class="opt-name">${esc(s.label)}</span>${s.recommended ? badge : ""}</span>
            <span class="opt-cards">${s.cards.filter((id) => CARD[id]).map((id) => `<span class="nw">${esc(plain(CARD[id].label))}</span>`).join("／<wbr>")}</span>
            <span class="opt-who bx">${fmt(s.who || "")}</span>
          </span>
        </button>`
        )
        .join("") +
      `<button type="button" class="opt" role="radio" aria-checked="${customOn}" data-act="themeCustom">
          <span class="opt-dot" aria-hidden="true"></span>
          <span class="opt-main">
            <span class="opt-head"><span class="opt-name">じぶんで決める</span></span>
            <span class="opt-who bx">下の入力欄に書くと、そのテーマで作る</span>
          </span>
        </button>`;
    const cards = C.cards
      .map((c) => {
        const on = S.selected.includes(c.id);
        const locked = !on && full;
        return `<button type="button" class="card${locked ? " is-locked" : ""}" data-act="card" data-id="${esc(c.id)}" aria-pressed="${on}"${locked ? ' aria-disabled="true"' : ""}>
          ${c.required ? '<span class="req">必須</span>' : ""}
          <span class="mark" aria-hidden="true">${on ? ICON.check : ""}</span>
          <span class="card-t bx">${fmt(c.label)}</span>
          <span class="card-c bx">${fmt(c.caption || "")}</span>
        </button>`;
      })
      .join("");
    const swap =
      S.size > 1 || S.free
        ? `<details class="swap" id="swap"${T.swapOpen || !S.setId ? " open" : ""}>
            <summary><span>${S.free ? "えらぶネタ（いくつでも）" : "ネタを自分で入れかえる"}</span><span class="swap-count">${S.free ? `${n}問` : `${n} / ${S.size}`}</span></summary>
            <p class="swap-note">${S.free ? "押した分だけ質問になるで（15まで）。必須の「学び・気づき」は外せへん。" : `${S.size}問まで選べるで。${full ? "ほかのネタにしたいときは、先にどれか外してな。" : `あと${S.size - n}つ選べるで。`}`}</p>
            <div class="cards">${cards}</div>
          </details>`
        : "";
    const quickSet = recommendedSet(SIZES.includes(C.defaultSize) ? C.defaultSize : SIZES[0]);
    const quickSize = C.sizes.find((z) => quickSet && z.n === quickSet.size);
    const html = `
      <div class="big-row"><button type="button" class="big-toggle" data-act="bigText" aria-pressed="${isBig()}"><span class="big-a" aria-hidden="true">あ</span>${isBig() ? "文字を元にもどす" : "文字を大きくする"}</button></div>
      ${eventHeadHtml()}
      ${aiReady() && (MYKEY || advOn() || EVENT.needsPass) ? `<p class="key-on bx">${advOn() ? `じぶんのAI（${esc(AISET.model)}）で文章を作るで` : MYKEY ? "じぶんのGeminiで文章を作るで" : "イベントのあいことばで作るで"}</p>` : ""}
      <section class="hero cloud" data-bump="46" data-seed="3">
        ${C.eventPage || !(C.eventSub || C.eventName) ? "" : `<p class="hero-eyebrow">${esc(C.eventSub || "")}${C.eventName ? `<br>「${esc(C.eventName)}」` : ""}</p>`}
        <h1 class="hero-title bx" tabindex="-1">${fmt(C.appName)}</h1>
        ${
          profileOn()
            ? `<p class="kind-q">なにを作る？</p>
          <div class="kind-switch seg" role="group" aria-label="作るもの" style="--cols:3">
            <button type="button" class="bx" data-act="kind" data-v="post" aria-pressed="${S.kind === "post"}">投稿文</button>
            <button type="button" class="bx" data-act="kind" data-v="headline" aria-pressed="${S.kind === "headline"}">見出し<span class="kind-sub">Headline</span></button>
            <button type="button" class="bx" data-act="kind" data-v="about" aria-pressed="${S.kind === "about"}">自己紹介<span class="kind-sub">About</span></button>
          </div>`
            : ""
        }
        <p class="hero-lead bx">${S.kind === "headline" ? "条件を決めて、<wbr>質問に答えるだけ。<br>プロフィールの<wbr>「見出し」の案が<wbr>5つできるで。" : S.kind === "about" ? "条件を決めて、<wbr>質問に答えるだけ。<br>プロフィールの<wbr>「自己紹介（概要）」が<wbr>できるで。" : "しゃべって答えるだけ。<br>LinkedInの投稿文が<wbr>できあがるで。"}</p>
        <div class="name-box${T.nameMissing ? " is-missing" : ""}">
          <label class="name-label" for="myName">まず、お名前<span class="req-inline">必須</span></label>
          <input id="myName" class="name-input" type="text" maxlength="40" autocomplete="name" enterkeyhint="done" placeholder="例：山下 翼" value="${esc(MYNAME)}">
          <p class="name-note bx">LinkedInと同じ名前で。<wbr>投稿の報告にも使うで</p>
        </div>
        ${followNeeded() ? followGateHtml() : ""}
        <p class="hero-note bx">${isProfile() ? "下で条件を決めると、<wbr>あなたに合わせた質問になるで。<wbr>書いたことだけ使うで" : "何も選ばんでOK。<wbr>質問に答えるだけで<wbr>投稿文ができるで"}</p>
        ${
          eventKeyReady() && !MYKEY
            ? ""
            : `<p class="key-entry"><button type="button" class="btn btn-secondary btn-block${aiReady() ? "" : " is-unset"}" data-act="openKey">${aiReady() ? "作るAIを見る・変える" : eventNeedsPass() ? '<span class="badge-unset">未設定</span>イベントのあいことばを入れる' : '<span class="badge-unset">未設定</span>文章を作るAIを紐づける（無料・約5分）'}</button></p>`
        }
        ${isProfile() ? "" : `<p class="key-entry"><button type="button" class="btn btn-secondary btn-block bx" data-act="cal">カレンダーから<wbr>投稿をつくる<wbr>${CALURL ? "（つないでる）" : "（まずつなぐ・1分）"}<span class="badge-opt">任意</span></button></p>`}
        ${histGet().length ? `<p class="key-entry"><button type="button" class="btn btn-secondary btn-block" data-act="hist">マイ投稿記録（${histGet().length}件）</button></p>` : ""}
        ${isProfile() ? "" : `<p class="key-entry"><button type="button" class="btn btn-secondary btn-block bx" data-act="voice">じぶんの書き方を<wbr>おぼえさせる<wbr>${VOICE.text ? (VOICE.on ? "（適用中）" : "（おぼえてる・止まってる）") : "（一度だけでOK）"}<span class="badge-opt">任意</span></button></p>`}
      </section>
      ${
        isProfile()
          ? condFormHtml()
          : `<section class="block photo-block">
        <h2 class="sec-title">写真から作る<span class="badge-opt">任意</span></h2>
        <p class="sec-note bx">写真を入れると、<wbr>AIが写真も見て書くで（${PHOTO_LIMIT}枚まで）。<wbr>入れんでもOK。</p>
        ${photoFieldHtml()}
      </section>
      <h2 class="pick-divider"><span>自分で選ぶ人は、こちら</span></h2>
      <section class="block has-scribble">
        <h2 class="sec-title" id="themeTitle">どんな投稿にする？</h2>
        <span class="scribble sc-nanyate" aria-hidden="true">なんやて</span>
        <div class="opts" role="radiogroup" aria-labelledby="themeTitle">${themeRows}</div>
        <p class="sec-note">テーマを押すと、質問の並びが自動で切り替わるで。質問の中身は「ネタを自分で入れかえる」で変えられる。</p>
        <div class="field custom-theme">
          <label class="field-label" for="customTheme">じぶんで決める${customOn ? '<span class="req-inline">必須</span>' : "（任意）"}</label>
          <input id="customTheme" class="phrase" type="text" maxlength="60" autocomplete="off" placeholder="例：娘の運動会の話を書きたい" value="${esc(S.customTheme || "")}">
          <p class="field-note bx">ここに書いたテーマがAIにそのまま伝わるで。<wbr>${customOn ? "「じぶんで決める」のときは、<wbr>テーマを書くのが必須やで。" : "当てはまるテーマが無いときは、<wbr>ここに書いてな。"}</p>
        </div>
      </section>
      <section class="block">
        <h2 class="sec-title">いま選んでる質問（この順で聞くで）</h2>
        <p class="flow-now">${flowCards()
          .map((c) => `<span class="nw">${esc(plain(c.label))}</span>`)
          .join("／<wbr>")}</p>
      </section>
      <section class="block">
        <h2 class="sec-title" id="sizeTitle">どれだけ書く？</h2>
        <div class="opts" role="radiogroup" aria-labelledby="sizeTitle">${sizeRows}</div>
      </section>
      ${swap}`
      }
      ${C.report ? `<p class="self-report">${
        REP
          ? `<button type="button" class="btn-text" data-act="reportSelf">${ICON.check}<span class="bx">投稿の報告ずみ<wbr>（直す・リンクを足す）</span></button>`
          : '<button type="button" class="btn-text bx" data-act="reportSelf">アプリを使わずに<wbr>投稿した人は、<wbr>ここから報告</button>'
      }</p>` : ""}
      ${MODE === "preview" ? '<p class="center"><button type="button" class="btn-text" data-act="demo">例文を入れて試す</button></p>' : ""}`;
    const dockHtml = isProfile()
      ? `<button type="button" class="btn btn-primary" data-act="toAnswer">この条件で質問へ<span class="btn-sub">${flowCards().length}問</span></button>`
      : `<button type="button" class="btn btn-primary" data-act="toAnswer">このネタで始める<span class="btn-sub">${n}問</span></button>`;
    return { html, dockHtml };
  }

  // 見出し・自己紹介の条件（最初の画面の下）。決めた条件で、質問の聞き方と候補が変わる
  function condFormHtml() {
    const K = PF.conds || {};
    const c = S.pcond;
    const kind = S.kind;
    const seg = (key, cols) => {
      const def = K[key];
      if (!def) return "";
      const note = def.notes && def.notes[c[key]] ? `<p class="field-note bx">${fmt(def.notes[c[key]])}</p>` : "";
      return `<div class="field">
          <div class="field-label" id="cl-${key}">${fmt(def.label)}${key === "role" ? '<span class="req-inline">必須</span>' : ""}</div>
          <div class="seg" role="group" aria-labelledby="cl-${key}" style="--cols:${cols || Math.min(3, def.options.length)}">
            ${def.options.map((o) => `<button type="button" class="bx" data-act="cond" data-k="${key}" data-v="${esc(o)}" aria-pressed="${c[key] === o}">${fmt(o)}</button>`).join("")}
          </div>${note}
        </div>`;
    };
    const work = c.role === "社会人";
    const yearChips = ((work ? K.year && K.year.chipsWork : K.year && K.year.chips) || [])
      .map((y) => `<button type="button" class="chip chip-s" data-act="condYear" data-v="${esc(y)}" aria-pressed="${c.year === y}">${esc(y)}</button>`)
      .join("");
    const dirMax = (K.dirs && K.dirs.max) || 3;
    const dirs = ((K.dirs && K.dirs.options) || [])
      .map((d) => {
        const on = (c.dirs || []).includes(d);
        return `<button type="button" class="chip chip-s" data-act="condDir" data-v="${esc(d)}" aria-pressed="${on}"${!on && (c.dirs || []).length >= dirMax ? ' aria-disabled="true"' : ""}>${esc(d)}</button>`;
      })
      .join("");
    const cards = flowCards();
    return `<section class="block cond-block" aria-labelledby="condTitle">
        <h2 class="sec-title" id="condTitle">${esc(plain(partCfg().label || ""))}の条件を決める</h2>
        <p class="sec-note bx">${fmt(partCfg().lead || "")}</p>
        <div class="fields cond-fields">
          ${seg("role", 3)}
          <div class="field">
            <label class="field-label" for="condYear">${esc(plain((K.year && K.year.label) || "学年・年次（任意）"))}</label>
            <div class="chips">${yearChips}</div>
            <input id="condYear" class="phrase" type="text" maxlength="20" autocomplete="off" placeholder="${esc((K.year && K.year.placeholder) || "")}" value="${esc(c.year || "")}">
          </div>
          <div class="field">
            <div class="field-label" id="cl-dirs">${esc(plain((K.dirs && K.dirs.label) || "目指す方向"))}</div>
            <div class="chips" role="group" aria-labelledby="cl-dirs">${dirs}</div>
            <input id="condDirOther" class="phrase" type="text" maxlength="20" autocomplete="off" placeholder="${esc((K.dirs && K.dirs.placeholder) || "")}" value="${esc(c.dirOther || "")}" aria-label="ほかの目指す方向">
          </div>
          ${seg("focus", 2)}
          ${seg("lang", 3)}
          ${seg("tone", 3)}
          ${kind === "headline" ? seg("hLen", 3) : seg("aLen", 3)}
          ${kind === "about" ? seg("aForm", 3) + seg("aClose", 3) : ""}
          <div class="field">
            <label class="field-label" for="condKeywords">${esc(plain((K.keywords && K.keywords.label) || "入れたいキーワード（任意）"))}</label>
            <input id="condKeywords" class="phrase" type="text" maxlength="80" autocomplete="off" placeholder="${esc((K.keywords && K.keywords.placeholder) || "")}" value="${esc(c.keywords || "")}">
          </div>
        </div>
      </section>
      <section class="block">
        <h2 class="sec-title">この条件で聞く質問（${cards.length}問）</h2>
        <p class="flow-now">${cards.map((x) => `<span class="nw">${esc(plain(x.label))}${x.required ? "＊" : ""}</span>`).join("／<wbr>")}</p>
        <p class="sec-note bx">＊は必須。<wbr>ほかは「とばす」でOK。<wbr>答えは${kind === "headline" ? "自己紹介" : "見出し"}を作るときにも<wbr>引き継ぐで。</p>
      </section>`;
  }

  // 写真の欄（最初の画面と、じぶん色の画面の両方で同じものを出す。写真は端末で小さくしてから持つ）
  function photoFieldHtml() {
    const n = T.photos.length;
    const grid = n
      ? `<div class="photo-grid">${T.photos
          .map((p, i) => `<div class="photo-cell"><img src="${esc(p.url)}" alt="選んだ写真${i + 1}枚目"><button type="button" class="photo-x" data-act="photoClear" data-i="${i}" aria-label="${i + 1}枚目の写真をやめる">×</button></div>`)
          .join("")}</div><p class="photo-count bx">${n}枚 / ${PHOTO_LIMIT}枚<wbr>${n > 1 ? "（全部まとめてAIが見るで）" : ""}</p>`
      : "";
    const pickBtn = T.photoBusy
      ? `<p class="photo-busy" role="status">写真を読みこんでるで…</p>`
      : n < PHOTO_LIMIT
      ? `<label class="btn btn-secondary btn-block photo-pick" for="photoInput">${n ? `写真を足す（あと${PHOTO_LIMIT - n}枚）` : `写真をえらぶ（何枚でも・${PHOTO_LIMIT}枚まで）`}</label><input id="photoInput" type="file" accept="image/*" multiple class="sr-only">`
      : "";
    const extra = n
      ? `<input id="photoWhat" class="phrase" type="text" maxlength="60" autocomplete="off" placeholder="写真は何？（例：ブースで社員さんと話してるところ）" value="${esc(T.photoWhat || "")}" aria-label="写真は何？">
        <input id="photoWant" class="phrase" type="text" maxlength="60" autocomplete="off" placeholder="伝えたいこと（例：会場の熱気）" value="${esc(T.photoWant || "")}" aria-label="写真で伝えたいこと">
        ${n > 1 ? '<button type="button" class="btn-text photo-clear-all" data-act="photoClear" data-i="all">写真を全部やめる</button>' : ""}`
      : "";
    return `<div class="photo-field">${grid}${pickBtn}${extra}<p class="photo-note bx">写真は小さくしてAIに見せるだけ。<wbr>このアプリには保存せえへん。<wbr>写真そのものは、<wbr>投稿のときにLinkedInで添付してな。</p></div>`;
  }

  // イベント専用ページの上に出す案内（イベント名・日時・会場・タイムスケジュール）
  function eventHeadHtml() {
    const ep = C.eventPage;
    if (!ep) return "";
    const hasSchedule = Array.isArray(ep.schedule) && ep.schedule.length;
    return `<section class="ev-head" aria-label="イベントの案内">
        <h2 class="ev-head-title bx">${txt(C.eventName || ep.title || "")}</h2>
        ${ep.when ? `<p class="ev-head-line bx"><span class="ev-head-k">日時</span>${txt(ep.when)}</p>` : ""}
        ${ep.place ? `<p class="ev-head-line bx"><span class="ev-head-k">会場</span>${ep.mapUrl ? `<a href="${esc(ep.mapUrl)}" target="_blank" rel="noopener">${txt(ep.place)}</a>` : txt(ep.place)}</p>` : ""}
        <div class="ev-head-links${hasSchedule && ep.siteUrl ? " is-two" : ""}">
          ${hasSchedule ? '<button type="button" class="btn btn-primary" data-act="schedule">タイムスケジュール</button>' : ""}
          ${ep.siteUrl ? `<a class="btn btn-secondary" href="${esc(ep.siteUrl)}" target="_blank" rel="noopener">公式サイト</a>` : ""}
        </div>
      </section>`;
  }
  // タイムスケジュール（日ごとにまとめる。今日の日付なら「きょう」、いまの時間の行に「いまここ」）
  function jstNow() {
    const d = new Date(Date.now() + 9 * 3600 * 1000);
    return { m: d.getUTCMonth() + 1, d: d.getUTCDate(), min: d.getUTCHours() * 60 + d.getUTCMinutes() };
  }
  const startMin = (t) => {
    const m = String(t || "").match(/(\d{1,2})[:：](\d{2})/);
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
  };
  function scheduleHtml() {
    const ep = C.eventPage || {};
    const groups = [];
    for (const it of ep.schedule || []) {
      if (!it || !it.title) continue;
      let g = groups.find((x) => x.day === (it.day || ""));
      if (!g) groups.push((g = { day: it.day || "", items: [] }));
      g.items.push(it);
    }
    const now = jstNow();
    const isToday = (day) => {
      const m = String(day).match(/(\d{1,2})\/(\d{1,2})/);
      return !!m && Number(m[1]) === now.m && Number(m[2]) === now.d;
    };
    const body = groups
      .map((g) => {
        const today = isToday(g.day);
        // いまの行：始まりの時刻がいまより前で、いちばん遅いもの（「終日」などの時刻なしは対象外）
        let cur = -1;
        if (today) g.items.forEach((it, i) => {
          const s = startMin(it.time);
          if (s != null && s <= now.min && (cur === -1 || s >= startMin(g.items[cur].time))) cur = i;
        });
        return `<section class="sch-day">
          <h3 class="sch-day-title bx">${txt(g.day || "スケジュール")}${today ? '<span class="sch-today">きょう</span>' : ""}</h3>
          <ol class="sch-list">${g.items
            .map((it, i) => `<li class="sch-item${i === cur ? " is-now" : ""}">
              <span class="sch-time">${esc(it.time || "")}</span>
              <span class="sch-main"><b class="bx">${txt(it.title)}</b>${i === cur ? '<span class="sch-now">いまここ</span>' : ""}${it.note ? `<span class="sch-note bx">${txt(it.note)}</span>` : ""}</span>
            </li>`)
            .join("")}</ol>
        </section>`;
      })
      .join("");
    return `
      <div class="sheet-grip" aria-hidden="true"></div>
      <h2 class="sheet-title" id="sheetTitle">タイムスケジュール</h2>
      <p class="sheet-lead bx">${txt(C.eventName || ep.title || "")}</p>
      ${body || '<p class="key-on">まだスケジュールは入ってへん。</p>'}
      ${ep.note ? `<p class="sch-foot bx">${txt(ep.note)}</p>` : ""}
      <div class="stack">
        ${ep.siteUrl ? `<a class="btn btn-secondary btn-block" href="${esc(ep.siteUrl)}" target="_blank" rel="noopener">${esc(ep.siteLabel || "公式サイト")}</a>` : ""}
        <button type="button" class="btn btn-primary btn-block" data-act="closeSheet">とじる</button>
      </div>`;
  }

  // ② こたえる
  function viewAnswer() {
    const list = flowCards();
    S.cursor = Math.max(0, Math.min(S.cursor, list.length - 1));
    const i = S.cursor;
    const c = list[i];
    const a = answerOf(c.id);
    const isLast = i === list.length - 1;
    const chips = (c.chips || []).length
      ? `<div class="chips" role="group" aria-label="候補（タップで追加）">${c.chips
          .map((ch) => `<button type="button" class="chip bx" data-act="chip" data-v="${esc(ch)}" aria-pressed="${(a.chips || []).includes(ch)}">${fmt(ch)}</button>`)
          .join("")}</div>`
      : "";
    const html = `
      <div class="q-head">
        <span class="q-progress"><b>${i + 1}</b> / ${list.length}</span>
        <span class="q-label">${esc(plain(c.label))}${c.required ? '<span class="req-inline">必須</span>' : ""}</span>
      </div>
      <div class="q-cloud cloud" data-bump="30" data-seed="${i + 7}">
        <h1 class="q-text bx" tabindex="-1">${fmt(c.question)}</h1>
        ${c.note ? `<p class="q-note">${esc(c.note)}</p>` : ""}
      </div>
      <div id="voice" aria-live="polite">${voiceHtml()}</div>
      <div class="answer-wrap">
        <label class="answer-label" for="answer">文字で書いてもOK</label>
        <textarea id="answer" class="answer" rows="4" maxlength="400" placeholder="${esc(c.placeholder || "")}">${esc(a.text || "")}</textarea>
      </div>
      ${chips ? `<div class="chips-wrap"><p class="chips-label">ことばを足す（タップで選ぶだけ）</p>${chips}</div>` : ""}`;
    const canNext = !c.required || hasText(c.id);
    const dockHtml = `
      <button type="button" class="btn btn-secondary btn-icon" data-act="back" aria-label="もどる">${ICON.back}</button>
      ${c.required ? "" : '<button type="button" class="btn btn-secondary btn-skip" data-act="skip">とばす</button>'}
      <button type="button" class="btn btn-primary" id="nextBtn" data-act="next" aria-disabled="${!canNext}">${isLast ? (S.kind === "headline" ? "見出しをつくる" : S.kind === "about" ? "自己紹介をつくる" : S.quick ? "書き方をえらぶ" : "じぶん色へ") : "つぎへ"}</button>`;
    return { html, dockHtml };
  }

  // 音声入力の案内（パソコンは Windows＋H や Mac の音声入力、スマホはキーボードのマイク）
  const UA = navigator.userAgent || "";
  const IS_WIN = /Windows/i.test(UA);
  const IS_MAC = /Macintosh/i.test(UA) && !("ontouchend" in document);
  const IS_ANDROID = /Android/i.test(UA);
  const IS_PC = IS_WIN || IS_MAC || (/Linux|CrOS/i.test(UA) && !IS_ANDROID);
  function altVoiceHint(blocked) {
    if (IS_WIN) return blocked ? "入力欄をクリックして「Windowsキー＋H」を押すと、Windowsの音声入力が使えるで。" : "うまくいかへんときは、入力欄をクリックして「Windowsキー＋H」でもOKやで。";
    if (IS_MAC) return blocked ? "入力欄をクリックして地球儀キー（fn）を2回押すと、Macの音声入力が使えるで。" : "うまくいかへんときは、入力欄をクリックして地球儀キー（fn）を2回でもOKやで。";
    return blocked ? "キーボードのマイクボタンで話してもOKやで。" : "うまくいかへんときは、キーボードのマイクボタンでもOKやで。";
  }
  const micDenied = () => T.micReason === "not-allowed" || T.micReason === "service-not-allowed";
  function micTitle() {
    if (micDenied()) return "マイクが許可されてへんみたい";
    if (T.micReason === "audio-capture") return "マイクが見つからへんみたい";
    if (T.micReason === "unsupported") return "このブラウザは、ここの音声入力に対応してへんみたい";
    return "このブラウザでは、ここの音声入力が使えへんみたい";
  }
  function micHelp() {
    const lines = [];
    if (micDenied()) lines.push(IS_PC ? "アドレスバー左のマークから、マイクを「許可」にすると使えるで。" : "ブラウザの設定で、このサイトのマイクを「許可」にすると使えるで。");
    else if (T.micReason === "audio-capture") lines.push("マイクがつながってるか、ほかのアプリが使ってないか見てみてな。");
    else if (IS_PC) lines.push("Chrome か Edge で開くと使えることが多いで。");
    else if (IS_ANDROID) lines.push("Chromeで開くと使えることが多いで。");
    lines.push(altVoiceHint(true));
    return lines;
  }
  function voiceHtml() {
    if (T.micBlocked) {
      const retry = SR && T.micReason !== "unsupported" ? '<button type="button" class="hint-retry" data-act="micRetry">もう一回ためす</button>' : "";
      return `<div class="hint-box">${ICON.mic}<div><b class="bx">${fmt(micTitle())}</b>${micHelp()
        .map((l) => `<span class="hint-sub">${esc(l)}</span>`)
        .join("")}${retry}</div></div>`;
    }
    return `<div class="voice-row">
      <button type="button" class="mic${T.listening ? " is-on" : ""}" data-act="mic" aria-pressed="${T.listening}" aria-label="${T.listening ? "音声入力を止める" : "話して入力"}">${ICON.mic}</button>
      <div class="voice-text"><div class="voice-label">${T.listening ? "聞いてるで…" : "押して、話してな"}</div><div class="voice-sub bx">${T.listening ? "話し終わったら、<wbr>自動で止まるで" : "話し終わったら<wbr>自動で止まるで。<wbr>続きは、<wbr>もう一回押してな"}</div></div>
    </div>
    <p class="voice-alt bx">${fmt(altVoiceHint(false))}</p>`;
  }

  // ③ じぶん色
  function viewStyle() {
    const notes = C.styleNotes || {};
    const field = (key) => {
      const def = C.style[key];
      const cur = S.style[key] !== undefined && S.style[key] !== "" ? S.style[key] : styleDefault(key);
      const cols = def.options.length <= 3 ? def.options.length : 2;
      const note = notes[key] && notes[key][cur] ? `<p class="field-note">${fmt(notes[key][cur])}</p>` : "";
      return `<div class="field">
        <div class="field-label" id="lab-${key}">${fmt(def.label)}</div>
        <div class="seg" role="group" aria-labelledby="lab-${key}" style="--cols:${cols}">
          ${def.options.map((o) => `<button type="button" class="bx" data-act="style" data-k="${key}" data-v="${esc(o)}" aria-pressed="${cur === o}">${fmt(o)}</button>`).join("")}
        </div>${note}
      </div>`;
    };
    const html = `
      <div class="page-head has-scribble">
        <p class="page-step">3 / 4</p>
        <h1 class="page-title" tabindex="-1">じぶん色をまぜる</h1>
        <p class="page-lead">そのままでもOK。変えたいとこだけ触ってな。</p>
        <span class="scribble sc-hona" aria-hidden="true">ほな</span>
      </div>
      ${
        myName()
          ? ""
          : `<div class="name-box${T.nameMissing ? " is-missing" : ""}">
        <label class="name-label" for="myName">まず、お名前<span class="req-inline">必須</span></label>
        <input id="myName" class="name-input" type="text" maxlength="40" autocomplete="name" enterkeyhint="done" placeholder="例：山下 翼" value="${esc(MYNAME)}">
        <p class="name-note bx">LinkedInと同じ名前で。<wbr>投稿の報告にも使うで</p>
      </div>`
      }
      ${T.error ? `<div class="alert" role="alert">${esc(T.error)}</div>` : ""}
      <div class="fields">
        <div class="field">
          <div class="field-label" id="lab-mode">書き方</div>
          <div class="opts" role="radiogroup" aria-labelledby="lab-mode">${modeOpts()}</div>
          ${introField()}${stylePromptField()}
        </div>
        ${field("role")}${field("formality")}${field("kansai")}${field("length")}${field("emoji")}${C.style.sign ? field("sign") : ""}${C.style.cheer && !C.cheerAlways ? field("cheer") : ""}
        <div class="field">
          <div class="field-label">写真（任意・${PHOTO_LIMIT}枚まで）</div>
          ${photoFieldHtml()}
        </div>
        <div class="field">
          <label class="field-label" for="phrase">入れたい一言（任意）</label>
          <input id="phrase" class="phrase" type="text" maxlength="40" autocomplete="off" placeholder="例：今日もええ日やった！" value="${esc(S.style.phrase)}">
          <p class="field-note">口ぐせや決め台詞。作ったパターン全部に、そのまま入るで。</p>
        </div>
      </div>`;
    const dockHtml = `
      <button type="button" class="btn btn-secondary btn-icon" data-act="back" aria-label="もどる">${ICON.back}</button>
      <button type="button" class="btn btn-primary" data-act="generate">${T.error ? "もう一回つくる" : "つくってもらう"}</button>`;
    return { html, dockHtml };
  }

  // 生成中
  function viewLoading() {
    const html = `
      <div class="loading">
        <div class="cloud load-cloud" data-bump="34" data-seed="11">
          <p class="loading-line" id="loadLine" aria-live="polite">${esc(C.loadingLines[0])}</p>
          <p class="loading-sub">10秒くらいでできるで</p>
        </div>
        <div class="feed" aria-hidden="true">
          <div class="li-card sk">
            <div class="li-head"><div class="li-avatar"></div><div class="sk-lines"><i style="width:34%"></i><i style="width:52%"></i></div></div>
            <div class="sk-lines sk-body"><i></i><i></i><i style="width:78%"></i><i style="width:0"></i><i></i><i style="width:64%"></i></div>
          </div>
        </div>
      </div>`;
    return { html, dockHtml: "" };
  }

  // ④ 見出し（5案）／自己紹介。それぞれコピーして、LinkedInのプロフィールに貼る
  function viewProfileResult() {
    const kind = S.kind;
    const cfg = partCfg();
    const r = S.presults[kind];
    const busy = !!T.refining;
    const other = kind === "headline" ? "about" : "headline";
    const otherCfg = partCfg(other);
    const left = profileCards(other).filter((c) => !(answerOf(c.id).text || "").trim() && !(answerOf(c.id).chips || []).length).length;
    const tweak = `<div class="tweak" role="group" aria-label="${kind === "headline" ? "見出しのちょい直し（5案ぜんぶ）" : "自己紹介のちょい直し"}">
          ${kind === "about" ? `<button type="button" class="chip chip-edit" data-act="edit">${ICON.pen}<span>自分で直す</span></button>` : ""}
          ${(cfg.refineActions || []).map((a) => `<button type="button" class="chip" data-act="refine" data-id="${esc(a.id)}"${busy ? " disabled" : ""}>${esc(a.label)}</button>`).join("")}
        </div>
        <div class="ask">
          <label class="ask-label" for="askText">「こうしてほしい」を書いて直す</label>
          <div class="ask-row">
            <input id="askText" class="phrase" type="text" maxlength="120" enterkeyhint="send" autocomplete="off" placeholder="${kind === "headline" ? "例：大学名は入れないで" : "例：サークル名を入れて"}" value="${esc(T.ask)}">
            <button type="button" class="btn btn-primary btn-ask" data-act="ask"${busy ? " disabled" : ""}>直す</button>
          </div>
          <p class="field-note bx">${kind === "headline" ? "5案ぜんぶを<wbr>書き直すで。" : "自己紹介を<wbr>書き直すで。"}</p>
        </div>`;
    let main = "";
    if (kind === "headline") {
      main = `<section class="block">
        <h2 class="sec-title">見出しの案（5つ）</h2>
        <p class="sec-note bx">名前のすぐ下に出る一行。<wbr>好きな案を1つ選んで<wbr>コピーしてな（220字まで）。</p>
        <ol class="p-heads${busy ? " is-busy" : ""}">${r.list
          .map(
            (h, i) => `<li class="p-head">
              <p class="p-head-text bx">${esc(h)}</p>
              <div class="p-head-foot"><span class="p-count">${count(h)}字</span><button type="button" class="btn btn-secondary btn-copy" data-act="pCopy" data-k="h${i}"${busy ? " disabled" : ""}>${ICON.copy}<span>コピー</span></button></div>
            </li>`
          )
          .join("")}</ol>
        ${busy ? '<p class="li-busy-line" role="status">書き直し中…</p>' : ""}
        ${tweak}
      </section>`;
    } else {
      main = T.editing
        ? `<section class="block"><label class="edit-label" for="editBody">自己紹介を直す</label>
           <textarea id="editBody" class="edit-body">${esc(r.text)}</textarea></section>`
        : `<section class="block">
          <h2 class="sec-title">自己紹介（About）の案</h2>
          <article class="li-card p-about${busy ? " is-busy" : ""}" aria-label="自己紹介の案">
            <div class="li-body" id="liBody">${esc(r.text.trim())}</div>
            ${busy ? '<div class="li-busy" role="status">書き直し中…</div>' : ""}
          </article>
          <div class="count-row"><span>${count(r.text.trim())}字</span><span>2600字まで</span></div>
          <p class="center"><button type="button" class="btn btn-primary btn-copy" data-act="pCopy" data-k="about"${busy ? " disabled" : ""}>${ICON.copy}<span>自己紹介をコピー</span></button></p>
          ${tweak}
        </section>`;
    }
    const steps = (cfg.steps || []).map((x, i) => `<li><span class="n" aria-hidden="true">${i + 1}</span><div>${fmt(x)}</div></li>`).join("");
    const html = `
      <div class="stamp-row">
        <div class="stamp cloud${T.fresh ? " is-fresh" : ""}" data-bump="24" data-seed="5"><span>できたで！</span></div>
        <span class="scribble sc-honma" aria-hidden="true">ほんま</span>
      </div>
      ${r.sample ? `<p class="notice">いまはサンプル文を表示中（AIの準備がまだ）</p>` : ""}
      <p class="cond-now bx">条件：${esc([S.pcond.role, S.pcond.year, condDirs().join("・"), S.pcond.lang, S.pcond.tone, kind === "headline" ? S.pcond.hLen : S.pcond.aLen].filter(Boolean).join("／"))}<button type="button" class="btn-text" data-act="condEdit"${busy ? " disabled" : ""}>条件を変える</button></p>
      ${main}
      ${steps && !T.editing ? `<section class="block"><h2 class="sec-title">LinkedInに入れるには</h2><ol class="guide">${steps}</ol></section>` : ""}
      ${
        T.editing
          ? ""
          : `<section class="next-part">
        <p class="next-part-title">${S.presults[other] ? `作った「${esc(plain(otherCfg.label || ""))}」を見る` : `つぎは「${esc(plain(otherCfg.label || ""))}」も作る？`}</p>
        <p class="next-part-note bx">${S.presults[other] ? "さっき作ったものに、<wbr>もどれるで。" : left ? `答えは引き継ぐで。<wbr>足りない質問（${left}問）だけ聞くで。` : "答えは引き継ぐで。<wbr>そのまま作れるで。"}</p>
        <button type="button" class="btn btn-secondary btn-block" data-act="toKind" data-v="${other}"${busy ? " disabled" : ""}>${esc(plain(otherCfg.label || ""))}${S.presults[other] ? "を見る" : "を作る"}</button>
      </section>
      <p class="center"><button type="button" class="btn-text" data-act="pRegen"${busy ? " disabled" : ""}>同じ条件で、もう一回つくる</button></p>`
      }`;
    const dockHtml = T.editing
      ? `<button type="button" class="btn btn-secondary" data-act="editCancel">やめる</button>
         <button type="button" class="btn btn-primary" data-act="editSave">この文にする</button>`
      : `<button type="button" class="btn btn-secondary btn-icon" data-act="back" aria-label="質問にもどる">${ICON.back}</button>
         <a class="btn btn-primary" data-act="pOpen" href="${esc(PF.openUrl || "https://www.linkedin.com/")}" target="_blank" rel="noopener">LinkedInをひらく</a>`;
    return { html, dockHtml };
  }

  // ④ えらんで投稿
  function viewResult() {
    if (isProfile()) return viewProfileResult();
    const t = S.tab;
    const r = S.results[t];
    const tone = TONES.find((x) => x.id === t) || TONES[0];
    const text = finalText(t);
    const tabs = TONES.map(
      (x) => `<button type="button" role="tab" id="tab-${x.id}" aria-selected="${x.id === t}" aria-controls="panel" tabindex="${x.id === t ? 0 : -1}" data-act="tab" data-id="${x.id}">${esc(x.label)}</button>`
    ).join("");
    const card = T.editing
      ? `<label class="edit-label" for="editBody">本文を直す</label>
         <textarea id="editBody" class="edit-body">${esc(r.body)}</textarea>
         <p class="edit-note">${mentionText() ? "メンションと" : ""}ハッシュタグは最後に自動で付くで。</p>
         <div class="edit-add">
           <label class="field-label" for="editAdd">伝えたいことを足す（任意）</label>
           <input id="editAdd" class="phrase" type="text" maxlength="120" autocomplete="off" placeholder="例：参加の申し込みはここから、と入れておきたい">
           <button type="button" class="btn-text" data-act="editAddAppend">本文の最後に付けたす</button>
         </div>`
      : `<article class="li-card${T.refining === t ? " is-busy" : ""}" aria-label="LinkedInでの見え方">
          <div class="li-head">
            <div class="li-avatar">${ICON.person}</div>
            <div><div class="li-name">${esc(myName() || "あなた")}</div><div class="li-meta">${esc(S.style.role || "LinkedInメンバー")}</div><div class="li-meta">たった今</div></div>
          </div>
          <div class="li-body is-clamped" id="liBody">${esc(r.body.trim())}\n\n<span class="li-tags">${mentionText() ? `<span class="li-tag">${esc(mentionText())}</span>\n` : ""}${C.hashtags.map((h) => `<span class="li-tag">${esc(h)}</span>`).join(" ")}</span></div>
          <button type="button" class="li-more" id="liMore" data-act="more">もっと見る</button>
          ${T.refining === t ? '<div class="li-busy" role="status">書き直し中…</div>' : ""}
        </article>`;
    const html = `
      <div class="stamp-row">
        <div class="stamp cloud${T.fresh ? " is-fresh" : ""}" data-bump="24" data-seed="5"><span>できたで！</span></div>
        <span class="scribble sc-honma" aria-hidden="true">ほんま</span>
      </div>
      ${S.results.sample ? `<p class="notice">${MODE === "preview" ? "プレビュー：いまはサンプル文を表示中" : "いまはサンプル文を表示中（AIの準備がまだ）"}</p>` : ""}
      ${S.results.via === "claude" ? '<p class="notice">プレビュー版：文章はClaudeで作成（本番はGemini）</p>' : ""}
      <div class="mode-row"><span class="bx">書き方：<b>${esc(modeOf(S.resultMode != null ? S.resultMode : S.mode, S.tab).label)}</b></span><button type="button" class="btn-text" data-act="modeOpen"${T.refining ? " disabled" : ""}>書き方を変える</button></div>
      ${S.results.single ? "" : `<div class="tabs" role="tablist" aria-label="トーン">${tabs}</div><p class="tone-note">${esc(tone.note)}</p>`}
      <section id="panel" role="tabpanel" aria-labelledby="tab-${t}">
        <div class="feed">
          <div class="feed-label"><span>LinkedInでの見え方</span><span>最初の3行が勝負</span></div>
          ${card}
        </div>
        <div class="count-row"><span>本文 ${count(r.body.trim())}字</span><span>タグ込み ${count(text)} / 3000字</span></div>
        ${
          T.editing
            ? ""
            : `<div class="tweak" role="group" aria-label="ちょい直し">
                <button type="button" class="chip chip-edit" data-act="edit">${ICON.pen}<span>自分で直す</span></button>
                ${C.refineActions.map((a) => `<button type="button" class="chip" data-act="refine" data-id="${esc(a.id)}"${T.refining ? " disabled" : ""}>${esc(a.label)}</button>`).join("")}
              </div>
              <div class="ask">
                <label class="ask-label" for="askText">「こうしてほしい」を書いて直す</label>
                <div class="ask-row">
                  <input id="askText" class="phrase" type="text" maxlength="120" enterkeyhint="send" autocomplete="off" placeholder="例：会社名（〇〇）を入れて" value="${esc(T.ask)}">
                  <button type="button" class="btn btn-primary btn-ask" data-act="ask"${T.refining ? " disabled" : ""}>直す</button>
                </div>
                <div class="ask-ex" role="group" aria-label="例（タップで入る）">${(C.askExamples || []).map((x) => `<button type="button" class="chip chip-s" data-act="askEx" data-v="${esc(x)}"${T.refining ? " disabled" : ""}>${esc(x)}</button>`).join("")}${prefsTop(3).map((p) => `<button type="button" class="chip chip-s" data-act="askEx" data-v="${esc(p.text)}"${T.refining ? " disabled" : ""}>${esc(p.text)}</button>`).join("")}</div>
                ${prefsGet().length ? `<p class="center"><button type="button" class="btn-text" data-act="prefOpen">じぶんの好みの履歴（${prefsGet().length}件）を見る・消す</button></p>` : ""}
                <p class="field-note bx">${S.results.single ? "表示中の文を<wbr>直すで。" : `いま表示中の<wbr>「${esc(tone.label)}」の文だけ<wbr>直すで。`}</p>
              </div>`
        }
      </section>`;
    const dockHtml = T.editing
      ? `<button type="button" class="btn btn-secondary" data-act="editCancel">やめる</button>
         <button type="button" class="btn btn-primary" data-act="editSave">この文にする</button>`
      : `<button type="button" class="btn btn-secondary btn-icon" data-act="back" aria-label="じぶん色にもどる">${ICON.back}</button>
         <button type="button" class="btn btn-primary" data-act="choose"${T.refining ? ' aria-disabled="true"' : ""}>この案でいく</button>`;
    return { html, dockHtml };
  }

  // プレビューの「…もっと見る」は、3行に収まらないときだけ出す
  function fitPreview() {
    const body = $("#liBody");
    const more = $("#liMore");
    if (!body || !more) return;
    requestAnimationFrame(() => {
      more.hidden = body.scrollHeight <= body.clientHeight + 2;
    });
  }

  // 投稿のしかた（LinkedInをひらく前に読む）。step は自動で番号を振る
  function guideSteps(after) {
    const lastNote = C.report
      ? (S.sendJudge !== false && myName() ? "審査員には、下のボタンを押したときに届くで" : "おわったら、この画面にもどって「報告する」を押してな")
      : (after ? "これで完了。おつから！" : "投稿できたら、この画面をとじてもOK");
    const steps = [
      `<b>LinkedInがひらいたら、下の「投稿」をタップ</b><span class="sub">パソコンは、ホーム上の「投稿を開始」</span>`,
      `<b>入力欄を長押しして「貼り付け」</b><span class="sub">もう文章が入ってたら、そのままでOK</span>`,
    ];
    const ms = mentionList();
    if (ms.length) {
      const how = ms.map((m) => `<span class="key">${esc(m.typeHint || `@${m.name}`)}</span> と打って<span class="nw">「${esc(m.name)}」</span>をタップ`).join("／");
      steps.push(
        mentionText()
          ? `<b>（できる人だけ）最後の <span class="key">${esc(mentionText())}</span> をメンションにする</b><span class="sub">貼っただけでは青い名前にならへん。その行を消して、${how}</span>`
          : `<b>本文の最後で、${how}</b><span class="sub">コピペの@はメンションにならへんから、ここだけ手で打ってな</span>`
      );
    }
    if (T.photos.length) steps.push(`<b>えらんだ写真（${T.photos.length}枚）を添付する</b><span class="sub">入力欄の下の写真マークから、まとめて選べるで。添付わすれに注意やで</span>`);
    else steps.push(`<b>写真を1枚つけると、見てもらいやすい</b><span class="sub">写ってる人には一声かけてな</span>`);
    steps.push(`<b>右上の「投稿」をタップ</b><span class="sub">${lastNote}</span>`);
    return `<ol class="guide">${steps.map((s, i) => `<li><span class="n" aria-hidden="true">${i + 1}</span><div>${s}</div></li>`).join("")}</ol>`;
  }
  function viewGuide() {
    const text = finalText(S.tab);
    const html = `
      <div class="done-cloud cloud" data-bump="34" data-seed="9">
        <h1 class="done-title" tabindex="-1">あとは投稿するだけ！</h1>
        <p class="done-lead bx">先に、この順番を見てな。<wbr>見たら、いちばん下の<wbr>青いボタンを押すと、<wbr>文章をコピーして<wbr>LinkedInがひらくで。</p>
      </div>
      ${C.followUrl && (!followed() || followSuggest()) ? `<div class="follow-first"><p class="follow-lead"><b>${followSuggest() ? "よかったら、フォローも" : "投稿の前に、まずフォロー"}</b><span class="sub">${esc(followName())}の<wbr>LinkedInページを<wbr>フォローしておくと、<wbr>最新の情報が届くで</span></p><a class="btn btn-secondary btn-block" href="${esc(C.followUrl)}" target="_blank" rel="noopener" data-act="followOpen">${esc(followName())}をフォローする</a></div>` : ""}
      ${guideSteps(false)}
      <details class="copied">
        <summary>コピーする文章を見る</summary>
        <label class="sr-only" for="copiedText">コピーする文章</label>
        <textarea id="copiedText" readonly>${esc(text)}</textarea>
      </details>
      <div class="done-foot">
        <button type="button" class="btn-text" data-act="later">あとで投稿する（自分に送る）</button>
      </div>`;
    const dockHtml = `
      <button type="button" class="btn btn-secondary btn-icon" data-act="toResult" aria-label="文章にもどる">${ICON.back}</button>
      <a class="btn btn-primary" id="copyOpen" href="${esc(composeUrl(text))}" target="_blank" rel="noopener" data-act="copyOpen">${ICON.copy}<span>コピーしてLinkedInをひらく</span></a>`;
    return { html, dockHtml };
  }

  // LinkedInをひらいたあと（もどってきた人向け）
  function viewDone() {
    const d = S.done;
    const tag = C.feedTag || C.hashtags[0];
    const reported = C.report && REP && REP.source === "app" && REP.doneText === d.text;
    const title = d.action === "later" ? (d.shared ? "送ったで！" : "コピーしたで！") : "いってらっしゃい！";
    const lead =
      d.action === "later"
        ? "投稿するときは、この順番でどうぞ。"
        : reported
        ? "もう報告も済んでるで。<wbr>投稿のリンクを足したい人は、<wbr>下のボタンから。"
        : C.report
        ? "投稿できたら、<wbr>下の「報告する」を押してな。<wbr>審査員が読むで！"
        : "無事に投稿できたら完璧やで。<wbr>つぎの投稿も、<wbr>また作りに来てな。";
    const html = `
      <div class="done-cloud cloud" data-bump="34" data-seed="9">
        <h1 class="done-title" tabindex="-1">${title}</h1>
        <p class="done-lead bx">${lead}</p>
      </div>
      <div class="stack">
        <a class="btn btn-primary btn-block" href="${esc(composeUrl(d.text))}" target="_blank" rel="noopener">LinkedInをもう一回ひらく</a>
        <button type="button" class="btn btn-secondary btn-block" data-act="recopy">${ICON.copy}<span>もう一回コピー</span></button>
        ${C.eventPage && (C.eventPage.schedule || []).length ? '<button type="button" class="btn btn-secondary btn-block" data-act="schedule">つぎは何がある？（タイムスケジュール）</button>' : ""}
        ${followSuggest() ? `<a class="btn btn-secondary btn-block" href="${esc(C.followUrl)}" target="_blank" rel="noopener" data-act="followOpen">${esc(followName())}をフォローする</a>` : ""}
      </div>
      <details class="copied"${d.action === "later" ? " open" : ""}>
        <summary>投稿のしかたを見る</summary>
        ${guideSteps(true)}
      </details>
      <details class="copied">
        <summary>コピーした文章を見る</summary>
        <label class="sr-only" for="copiedText">コピーした文章</label>
        <textarea id="copiedText" readonly>${esc(d.text)}</textarea>
      </details>
      <div class="tips">
        <p><b>みんなの投稿も見てみよ</b><br>LinkedInで <span class="key">${esc(tag)}</span> をタップすると並んでるで。コメントし合うと、つながりが続くで。</p>
        ${C.report ? '<p><b>表彰は会場で</b><br>表彰は、会場で投稿して審査員に届いた人から選ばれるで。</p>' : ""}
      </div>
      <p class="center small"><a href="${esc(C.signupUrl)}" target="_blank" rel="noopener">LinkedInのアカウントがまだの人はこちら</a></p>
      <div class="done-foot">
        <button type="button" class="btn-text" data-act="toResult">別のパターンにする</button>
        <button type="button" class="btn-text" data-act="restart">最初からつくる</button>
      </div>`;
    const dockHtml = reported
      ? `<button type="button" class="btn btn-secondary btn-block btn-reported" data-act="report">${ICON.check}<span>報告ずみ（直す・リンクを足す）</span></button>`
      : C.report
      ? '<button type="button" class="btn btn-primary" data-act="report">投稿できたら、報告する</button>'
      : '<button type="button" class="btn btn-primary" data-act="restart">もう一本つくる</button>';
    return { html, dockHtml };
  }

  // ---------- シート（投稿前チェック・確認） ----------
  function openSheet(html, focusSel) {
    sheet.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheetTitle">${html}</div>`;
    sheet.hidden = false;
    document.body.classList.add("no-scroll");
    paintClouds(sheet);
    const f = focusSel ? $(focusSel, sheet) : $("button, a", sheet);
    if (f) f.focus({ preventScroll: true });
  }
  function closeSheet() {
    // 「書き方を変える」を開いて、作り直さずに閉じたときは、元の書き方にもどす
    if (T.modeFrom === "regen" && S.results && S.resultMode != null && S.mode !== S.resultMode) {
      S.mode = S.resultMode;
      save();
    }
    T.modeFrom = "";
    sheet.hidden = true;
    sheet.innerHTML = "";
    document.body.classList.remove("no-scroll");
  }

  function checkSheetHtml() {
    const ready = S.checks.every(Boolean);
    const text = finalText(S.tab);
    return `
      <div class="sheet-grip" aria-hidden="true"></div>
      <h2 class="sheet-title" id="sheetTitle">投稿前チェック</h2>
      <p class="sheet-lead">4つ確認したら、ボタンが押せるようになるで。</p>
      <div class="checklist">
        ${C.checklist.map((c, i) => `<button type="button" class="check" role="checkbox" aria-checked="${S.checks[i]}" data-act="check" data-i="${i}"><span class="box" aria-hidden="true">${S.checks[i] ? ICON.check : ""}</span><span>${esc(c)}</span></button>`).join("")}
      </div>
      <div class="consent">
        <button type="button" class="switch" role="switch" aria-checked="${S.consent}" aria-labelledby="consentLabel" data-act="consent"></button>
        <div><div class="consent-label bx" id="consentLabel">${fmt(C.consentLabel)}</div><div class="consent-note">${esc(C.consentNote)}</div></div>
      </div>
      ${C.report && myName() ? `<div class="consent consent-judge">
        <button type="button" class="switch" role="switch" aria-checked="${S.sendJudge !== false}" aria-labelledby="judgeLabel" data-act="sendJudge"></button>
        <div><div class="consent-label bx" id="judgeLabel">審査員にも、<wbr>この文章を送る</div><div class="consent-note bx">${esc(myName())}さんの投稿として、<wbr>表彰の候補になるで。<wbr>あとで直すこともできるで。</div></div>
      </div>` : ""}
      <div class="stack">
        <button type="button" class="btn btn-primary btn-block" id="toGuide" data-act="toGuide" aria-disabled="${!ready}">つぎへ（投稿のしかた）</button>
        <button type="button" class="btn-text" data-act="closeSheet">もどって直す</button>
      </div>`;
  }
  function refreshCheckSheet() {
    const sc = $(".sheet", sheet);
    const y = sc ? sc.scrollTop : 0;
    openSheet(checkSheetHtml(), null);
    const sc2 = $(".sheet", sheet);
    if (sc2) sc2.scrollTop = y;
  }

  // ---------- 「投稿したで！」の報告 ----------
  // LinkedInの投稿リンクを、貼り付けた文の中から取り出す（サーバーの src/report.js と同じ考え方）
  function pickLinkedInUrl(text) {
    const t = String(text || "").trim();
    if (!t) return { url: "" };
    const m = t.match(/https?:\/\/[^\s<>"'）」』]+/i) || t.match(/(?:www\.)?(?:linkedin\.com|lnkd\.in)\/[^\s<>"'）」』]+/i);
    if (!m) return { error: "url" };
    let raw = m[0];
    if (!/^https?:\/\//i.test(raw)) raw = "https://" + raw;
    try {
      const u = new URL(raw);
      if (!/(^|\.)linkedin\.com$|^lnkd\.in$/i.test(u.hostname)) return { error: "url" };
      u.protocol = "https:";
      for (const k of [...u.searchParams.keys()]) if (/^(utm_|trk|rcm$)/i.test(k)) u.searchParams.delete(k);
      u.hash = "";
      return { url: u.toString() };
    } catch {
      return { error: "url" };
    }
  }
  const canPaste = () => !!(navigator.clipboard && navigator.clipboard.readText && window.isSecureContext);

  // entry：「done」＝投稿ガイドから（アプリで作った投稿）／「pick」＝最初の画面から（自分で書いた人・報告を直す人）
  function openReport(entry) {
    let mode, keep;
    if (entry === "done") {
      mode = "app";
      keep = !!(REP && REP.source === "app" && S.done && REP.doneText === S.done.text);
    } else {
      mode = REP ? REP.source : "self";
      keep = !!REP;
    }
    T.rep = {
      mode,
      editing: keep,
      name: (REP && REP.name) || myName(),
      url: keep ? REP.url || "" : "",
      body: keep ? REP.body || "" : mode === "app" ? (S.done && S.done.text) || "" : "",
      tone: keep ? REP.tone || "" : mode === "app" && S.done ? S.done.tone || "" : "",
      doneText: keep ? REP.doneText || "" : mode === "app" && S.done ? S.done.text : "",
      screenOk: REP ? REP.screenOk !== false : RC.screenDefault !== false,
    };
    openSheet(reportSheetHtml(), !T.rep.name ? "#rName" : T.rep.mode === "self" ? "#rUrl" : "#rSend");
  }
  function reportSheetHtml() {
    const r = T.rep;
    const self = r.mode === "self";
    const linkField = `<div class="field">
          <label class="field-label" for="rUrl">投稿のリンク<span class="field-hint">あれば</span></label>
          <div class="paste-row">
            <input id="rUrl" class="phrase" type="url" inputmode="url" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="https://www.linkedin.com/posts/…" value="${esc(r.url)}">
            ${canPaste() ? '<button type="button" class="btn btn-secondary btn-paste" data-act="rPaste">貼り付け</button>' : ""}
          </div>
          <p class="field-note bx">${fmt(RC.linkHelp || "")}</p>
        </div>`;
    const bodyField = self
      ? `<div class="field">
          <label class="field-label" for="rBody">投稿した文章<span class="field-hint">貼り付け。リンクがあれば省略OK</span></label>
          <textarea id="rBody" class="r-text" rows="6" maxlength="3500" placeholder="LinkedInに投稿した文章を貼り付け">${esc(r.body)}</textarea>
        </div>`
      : `<details class="r-body">
          <summary>パネラーに届く本文を見る・直す</summary>
          <textarea id="rBody" class="r-text" rows="8" maxlength="3500">${esc(r.body)}</textarea>
          <p class="field-note">LinkedInで書き直した人は、ここも同じに直してな。</p>
        </details>`;
    return `
      <div class="sheet-grip" aria-hidden="true"></div>
      <h2 class="sheet-title" id="sheetTitle">${r.editing ? "報告を直す" : self ? "投稿したことを報告" : "投稿できた？"}</h2>
      <p class="sheet-lead bx">${r.editing ? "直して、もう一回送ってな。" : self ? "報告すると、<wbr>パネラーが読んで<wbr>表彰の候補にするで！" : "名前を入れて「報告する」を<wbr>押すだけでOK。<wbr>パネラーが読んで<wbr>表彰の候補にするで！"}</p>
      <div class="r-fields">
        <div class="field">
          <label class="field-label" for="rName">お名前<span class="field-hint">LinkedInと同じ名前</span></label>
          <input id="rName" class="phrase" type="text" maxlength="40" autocomplete="name" placeholder="例：山下 翼" value="${esc(r.name)}">
        </div>
        ${self ? linkField : `<details class="r-more"${r.url ? " open" : ""}><summary>リンクも送る（できる人だけ）</summary>${linkField}</details>`}
        ${bodyField}
      </div>
      <div class="consent">
        <button type="button" class="switch" role="switch" aria-checked="${r.screenOk}" aria-labelledby="rScreenLabel" data-act="rScreen"></button>
        <div><div class="consent-label bx" id="rScreenLabel">${fmt(RC.screenLabel || "会場スクリーンに名前を出す")}</div><div class="consent-note bx">${fmt(RC.screenNote || "")}</div></div>
      </div>
      <p class="r-note bx">${fmt(RC.note || "")}</p>
      <p class="r-error" id="rError" role="alert"></p>
      <div class="stack">
        <button type="button" class="btn btn-primary btn-block" id="rSend" data-act="rSend">${r.editing ? "直して送る" : "報告する"}</button>
        <button type="button" class="btn-text" data-act="closeSheet">${r.editing ? "やめとく" : "あとで"}</button>
      </div>`;
  }
  function modeOpts() {
    return MODES.map(
      (m) => `<button type="button" class="opt" role="radio" aria-checked="${(S.mode || "") === m.id && (!m.tone || (S.startTone || "emo") === m.tone)}" data-act="mode" data-id="${esc(m.id)}" data-tone="${esc(m.tone || "")}">
          <span class="opt-dot" aria-hidden="true"></span>
          <span class="opt-main">
            <span class="opt-head"><span class="opt-name">${esc(m.label)}</span></span>
            <span class="opt-who bx">${fmt(m.sub || "")}</span>
          </span>
        </button>`
    ).join("");
  }
  function introField() {
    if (S.mode !== "first") return "";
    return `<div class="intro-box">
        <label class="field-label" for="intro">${esc(C.introLabel || "ひとこと自己紹介（任意）")}</label>
        <input id="intro" class="phrase" type="text" maxlength="60" autocomplete="off" placeholder="${esc(C.introPlaceholder || "")}" value="${esc(S.intro)}">
        <p class="field-note bx">${fmt(C.introNote || "")}</p>
      </div>`;
  }
  function stylePromptField() {
    if (S.mode !== "custom") return "";
    return `<div class="intro-box">
        <label class="field-label" for="stylePrompt">書き方の指示<span class="req-inline">必須</span></label>
        <textarea id="stylePrompt" class="phrase" rows="3" maxlength="800" autocomplete="off" placeholder="例：やさしい語り口で、最後は必ず質問で締める">${esc(S.stylePrompt || "")}</textarea>
        <p class="field-note bx">ここに書いたことを、AIにそのまま伝えるで。<wbr>「〇〇風の誰か」のときも、<wbr>なりすましでなく型だけまねる。</p>
      </div>`;
  }
  function modeSheetHtml() {
    const regen = T.modeFrom === "regen";
    return `
      <div class="sheet-grip" aria-hidden="true"></div>
      <h2 class="sheet-title" id="sheetTitle">どんな感じの文章にする？</h2>
      <p class="sheet-lead bx">${regen ? "いまの文は、<wbr>新しく作り直すで。" : "迷ったら、<wbr>そのまま「つくる」でOK。"}</p>
      <div class="opts" role="radiogroup" aria-labelledby="sheetTitle">${modeOpts()}</div>
      ${introField()}${stylePromptField()}
      <div class="stack">
        <button type="button" class="btn btn-primary btn-block" data-act="modeGo">${regen ? "この書き方で作り直す" : "この書き方でつくる"}</button>
        ${regen ? "" : '<button type="button" class="btn btn-secondary btn-block" data-act="modeStyle">文体や関西弁も決める</button>'}
        <button type="button" class="btn-text" data-act="closeSheet">もどる</button>
      </div>`;
  }
  function openModeSheet(from) {
    T.modeFrom = from;
    openSheet(modeSheetHtml(), "[data-act=modeGo]");
  }
  function followGateHtml() {
    const done = FOLLOW === "done";
    const opened = !!FOLLOW;
    return `<div class="follow-gate${T.followMissing && !done ? " is-missing" : ""}${done ? " is-done" : ""}">
          <p class="name-label">つぎに、主催をフォロー<span class="req-inline">必須</span></p>
          <p class="name-note bx">${esc(followName())}の<wbr>LinkedInページを開いて<wbr>「フォロー」を押してな。<wbr>終わったら、<wbr>この画面にもどって<wbr>チェック。</p>
          <a class="btn btn-secondary btn-block btn-follow" href="${esc(C.followUrl)}" target="_blank" rel="noopener" data-act="followOpen">${opened ? "もう一回ひらく" : "LinkedInページをひらく"}<span class="btn-sub">別のタブで開くで</span></a>
          <button type="button" class="check follow-check" role="checkbox" aria-checked="${done}" data-act="followCheck"><span class="box" aria-hidden="true">${done ? ICON.check : ""}</span><span>フォローした</span></button>
        </div>`;
  }
  // 始める前の確認：名前 → フォロー
  function needName() {
    if (!myName()) {
      T.nameMissing = true;
      keepScroll(render);
      const box = $("#myName");
      if (box) {
        box.scrollIntoView({ block: "center" });
        box.focus({ preventScroll: true });
      }
      toast("最初に、お名前を入れてな", 2000);
      return true;
    }
    if (!followed()) {
      T.followMissing = true;
      keepScroll(render);
      const g = $(".follow-gate");
      if (g) g.scrollIntoView({ block: "center" });
      const f = $(FOLLOW ? "[data-act=followCheck]" : "[data-act=followOpen]");
      if (f) f.focus({ preventScroll: true });
      toast(FOLLOW ? "フォローできたら「フォローした」にチェックしてな" : "先に、主催のLinkedInページをフォローしてな", 2400);
      return true;
    }
    return false;
  }

  function helpHtml() {
    const H = C.help || {};
    const tips = (H.tips && H.tips[S.step]) || [];
    return `
      <div class="sheet-grip" aria-hidden="true"></div>
      <h2 class="sheet-title" id="sheetTitle">困ったら</h2>
      <div class="help-staff cloud" data-bump="26" data-seed="21"><b class="bx">${fmt(H.staff || "")}</b><span>${esc(H.staffSub || "")}</span></div>
      ${tips.length ? `<ul class="help-tips">${tips.map((t) => `<li class="bx">${fmt(t)}</li>`).join("")}</ul>` : ""}
      ${C.eventPage && (C.eventPage.schedule || []).length ? '<button type="button" class="btn btn-secondary btn-block" data-act="schedule">タイムスケジュールを見る</button>' : ""}
      ${eventKeyReady() && !MYKEY && !advOn() ? "" : `<button type="button" class="btn btn-secondary btn-block" data-act="openKey">文章を作るAIを紐づける${aiReady() ? "（紐づけずみ）" : ""}</button>`}
      <button type="button" class="btn btn-secondary btn-block" data-act="bigText"><span class="big-a" aria-hidden="true">あ</span>${isBig() ? "文字を元の大きさにもどす" : "文字を大きくする"}</button>
      <div class="stack">
        <button type="button" class="btn btn-primary btn-block" data-act="closeSheet">とじる</button>
        ${S.step !== "pick" && S.step !== "loading" ? '<button type="button" class="btn-text" data-act="restart">最初からやり直す</button>' : ""}
      </div>`;
  }

  // 文章を作るAIを紐づけるシート。はじめての人でも手順どおりにできるように
  function keyHtml() {
    const geminiOn = !!MYKEY && !advOn();
    return `
      <div class="sheet-grip" aria-hidden="true"></div>
      <h2 class="sheet-title" id="sheetTitle">文章を作るAIを紐づける</h2>
      ${eventPassHtml()}
      <p class="sheet-lead bx">投稿文を作るAI（Gemini）を、<wbr>あなた自身のアカウントで使えるようにするで。<wbr>キーは無料で作れて、<wbr>一度紐づけたら二度と入らなくていい。</p>
      ${advOn() ? `<p class="key-on bx">いま：<b>Gemini以外のAI（${esc(AISET.model)}）で作ってるで</b>。<wbr>Geminiに戻すときは、下の「上級者向け」でやめる。</p>` : MYKEY ? '<p class="key-on bx">いま：<b>Gemini（じぶんのキー）で作ってるで</b>。設定ずみ（この端末）</p>' : '<p class="key-off bx">いまは、<b>まだAIがつながってへん</b>。<wbr>このままだと投稿文が作れへんから、<wbr>下の手順どおりに約5分でつなげてな。</p>'}
      <ol class="key-steps">
        <li class="bx">下の「Google AI Studioをひらく」を押して、いつもGmailで使ってる自分のGoogleアカウントでログインする</li>
        <li class="bx">開いたページに<b>「APIキーを作成」</b>（英語なら「Create API key」）というボタンがあるので押す。「プロジェクトを選んで」みたいなの出たら、一番上のままでOK</li>
        <li class="bx">長い文字（<b>「AIza」か「AQ.」で始まる</b>）が出てくる。これがキーや。右横の<b>コピーマーク</b>（四角が2つ重なったマーク）を押して、まるごとコピーする</li>
        <li class="bx">この画面にもどって、下の「<b>貼り付け</b>」ボタンを押す（長押し貼り付けでもOK）</li>
        <li class="bx">最後に<b>「これで紐づける」</b>を押す。確認がとれて「つながった！」が出たら完成</li>
      </ol>
      <div class="key-box">
        <label class="key-label" for="apiKeyInput">Gemini APIキー${MYKEY ? '<span class="key-ok">紐づけずみ（この端末）</span>' : '<span class="key-ng">未設定</span>'}</label>
        <input id="apiKeyInput" class="name-input" type="password" autocomplete="off" inputmode="text" maxlength="300" placeholder="キーをまるごと貼り付け" value="${esc(MYKEY)}">
        <div class="key-actions">
          <button type="button" class="btn btn-secondary" data-act="pasteKey">貼り付け</button>
          <a class="btn btn-secondary" href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">Google AI Studioをひらく</a>
          <button type="button" class="btn btn-primary" data-act="saveKey">これで紐づける</button>
        </div>
        <p class="key-on" id="keyStatus" hidden></p>
        ${MYKEY && !advOn() ? '<button type="button" class="btn-text" data-act="clearKey">この端末のキーを消す</button>' : ""}
      </div>
      <details class="key-trouble" ${advOn() ? "open" : ""}>
        <summary>上級者向け：Gemini以外のAIをつなぐ（Claude・GPTなど）</summary>
        <div class="key-box">
          <p class="key-note bx">AIごとの「APIキー」が必要やで。<wbr>下でAIを選んで、<wbr>キーとモデル名を入れて「このAIをつなぐ」。<wbr>ここをつなぐと、Geminiのキーは使わへん。</p>
          <label class="key-label" for="advProvider">つなぐAI</label>
          <select id="advProvider" class="name-input">
            <option value="anthropic" ${(AISET && AISET.provider === "anthropic") ? "selected" : ""}>Claude（Anthropic）</option>
            <option value="openai" ${(AISET && AISET.provider === "openai") ? "selected" : ""}>OpenAI互換（GPT・Groq・OpenRouterなど）</option>
          </select>
          <input id="advBase" class="name-input" type="url" autocomplete="off" inputmode="url" maxlength="200" placeholder="Base URL（わからなければ、そのままでOK）" value="${esc((AISET && AISET.baseUrl) || "")}">
          <input id="advModel" class="name-input" type="text" autocomplete="off" inputmode="text" maxlength="80" placeholder="モデル名（例：claude-sonnet-4-5／gpt-4o-mini）" value="${esc((AISET && AISET.model) || "")}">
          <input id="advKey" class="name-input" type="password" autocomplete="off" maxlength="200" placeholder="そのAIのAPIキー" value="">
          <div class="key-actions">
            <button type="button" class="btn btn-primary" data-act="advSave">このAIをつなぐ</button>
            ${advOn() ? '<button type="button" class="btn-text" data-act="advOff">つなぐのをやめる（Geminiに戻す）</button>' : ""}
          </div>
        </div>
        <details class="key-trouble">
          <summary>Claude（Anthropic）の設定方法（くわしく）</summary>
          <ol class="key-steps">
            <li class="bx">ブラウザで <b>console.anthropic.com</b> を開いて、Claude（claude.ai）で使ってるアカウントでログインする</li>
            <li class="bx">左のメニューの「<b>API Keys</b>」を開いて、「<b>Create Key</b>」を押す。名前は「tsukuttaroka」など、わかる名前でOK</li>
            <li class="bx">「<b>sk-ant-</b>」で始まる長い文字が出る。コピーマークで、まるごとコピーする</li>
            <li class="bx">Claudeは、<b>先にお金をチャージ（クレジット追加）</b>しておく必要があることが多い。左の「<b>Billing</b>」（お支払い）を開いて、5ドルぐらい入れておけば、よほど使わん限り1か月以上もつ</li>
            <li class="bx">この画面にもどって、AIで「Claude（Anthropic）」を選び、Base URLは<b>そのまま（空でもOK）</b>。モデル名は「<b>claude-sonnet-4-5</b>」（おすすめ）か「claude-haiku-4-5」（安くて速い）を入れる</li>
            <li class="bx">キーを貼り付けて「このAIをつなぐ」を押して完成</li>
          </ol>
        </details>
        <details class="key-trouble">
          <summary>OpenAI互換（GPT・Groq・OpenRouter）の設定方法（くわしく）</summary>
          <ol class="key-steps">
            <li class="bx">OpenAIなら：ブラウザで <b>platform.openai.com</b> を開いてログイン → 左の「<b>API keys</b>」→「<b>Create new secret key</b>」→「<b>sk-</b>」で始まる文字をコピーする</li>
            <li class="bx">Base URLは「<b>https://api.openai.com/v1</b>」のまま。ほかの会社（Groq、OpenRouterなど）のときは、その会社が案内してるURLを入れてな</li>
            <li class="bx">モデル名は「<b>gpt-4o-mini</b>」みたいに、そのAIの名前を入れてな。Groqなら「llama-3.3-70b-versatile」など</li>
            <li class="bx">キーを貼り付けて「このAIをつなぐ」を押して完成</li>
          </ol>
        </details>
      </details>
      <details class="key-trouble">
        <summary>うまくいかへんときは</summary>
        <ul>
          <li class="bx">コピーマークが見当たらへんときは、キーの文字を長押し →「すべて選択」→「コピー」でもOK</li>
          <li class="bx">キーは「AIza」か「AQ.」ではじまる長い文字や。それ以外の形のときは、コピーが途中で切れてるかも。もう一度、最初からコピーし直してみて</li>
          <li class="bx">「課金」という言葉が出ても怖がらなくて大丈夫。ふだんの使い方なら、無料のままで足りる</li>
          <li class="bx">キーは人に見せたり、SNSに載せたりせえへん。この端末に保存して終わり</li>
        </ul>
      </details>
      <div class="stack"><button type="button" class="btn btn-secondary btn-block" data-act="closeSheet">とじる</button></div>`;
  }

  // カレンダー（Googleカレンダーの「秘密のiCalアドレス」）から投稿をつくる
  function calSheetHtml() {
    const evs = T.calEvents || [];
    const busy = !!T.calBusy;
    return `
      <div class="sheet-grip" aria-hidden="true"></div>
      <h2 class="sheet-title" id="sheetTitle">カレンダーから投稿をつくる</h2>
      <p class="sheet-lead bx">Googleカレンダーをつなげると、<wbr>予定の話から投稿文が作れる。</p>
      ${
        CALURL
          ? ""
          : `<ol class="key-steps">
        <li class="bx">ブラウザ（Chromeなど）で <b>calendar.google.com</b> を開いて、Googleアカウントでログインする</li>
        <li class="bx">右上の<b>歯車マーク</b>→「設定」→ 左のリストから、自分のカレンダーをタップする</li>
        <li class="bx">下のほうに「<b>秘密のiCalアドレス</b>」という欄がある。右のコピーマークで、URLをまるごとコピーする</li>
        <li class="bx">この画面にもどって、下の入力欄に貼り付けて「つなぐ」を押す</li>
      </ol>`
      }
      <div class="key-box">
        <label class="key-label" for="calUrl">カレンダーのURL${CALURL ? '<span class="key-ok">つないでる（この端末）</span>' : '<span class="key-sub">まだつながってない</span>'}</label>
        <input id="calUrl" class="name-input" type="url" autocomplete="off" inputmode="url" maxlength="300" placeholder="https://calendar.google.com/…　を貼り付け" value="${esc(CALURL)}">
        <div class="key-actions">
          <button type="button" class="btn btn-primary" data-act="saveCal">${CALURL ? "URLを入替える" : "つなぐ"}</button>
          ${CALURL ? '<button type="button" class="btn-text" data-act="clearCal">つながりを消す</button>' : ""}
        </div>
        <p class="key-note bx">URLはこの端末にしか保存せえへん。<wbr>このURLを知ってる人は、<wbr>予定の「入ってる/空いてる」が<wbr>見れるようになるから、<wbr>人に教えんように。</p>
      </div>
      ${
        CALURL && !busy
          ? `<div class="stack">
        <button type="button" class="btn btn-primary btn-block" data-act="calFetch" data-range="today">今日の予定から投稿をつくる</button>
        <button type="button" class="btn btn-secondary btn-block" data-act="calFetch" data-range="week">この1週間のふりかえり投稿をつくる</button>
      </div>`
          : ""
      }
      ${busy ? '<p class="key-on">カレンダーを見てるで…</p>' : ""}
      ${
        !busy && T.calDone && !evs.length
          ? `<p class="key-on bx">予定は見つからへんかった。<wbr>${T.calRange === "week" ? "この1週間は空やったかも。" : "今日は空いてるか、ほかのカレンダーかも。"}</p>`
          : ""
      }
      ${
        !busy && evs.length
          ? `<div class="cal-list">${evs
              .map(
                (e, i) =>
                  `<button type="button" class="cal-ev" data-act="${T.calRange === "week" ? "calWeekTap" : "calPick"}" data-i="${i}"><span class="d">${esc(e.day)}</span><span class="t bx">${esc(e.title)}</span></button>`
              )
              .join("")}</div>
      ${
        T.calRange === "week"
          ? '<p class="key-on bx">予定は、このままでOK。<wbr>下のボタンで作るで。押した予定だけにも変えられる。</p><div class="stack"><button type="button" class="btn btn-primary btn-block" data-act="calWeekGo">この予定でふりかえりをつくる</button></div>'
          : '<p class="key-on bx">押した予定の話から、質問が始まるで</p>'
      }`
          : ""
      }
      <div class="stack"><button type="button" class="btn btn-secondary btn-block" data-act="closeSheet">とじる</button></div>`;
  }

  // じぶんの好み（直し指示の履歴）のシート
  function prefHtml() {
    const list = prefsGet();
    const rows = list.length
      ? list
          .map(
            (p) => `<div class="hist-item">
          <p class="bx">${esc(p.text)}</p>
          <button type="button" class="btn-text hist-del" data-act="prefDel" data-at="${p.at}">これを消す</button>
        </div>`
          )
          .join("")
      : '<p class="key-on bx">まだ履歴はあらへん。</p>';
    return `
      <div class="sheet-grip" aria-hidden="true"></div>
      <h2 class="sheet-title" id="sheetTitle">じぶんの好みの履歴</h2>
      <p class="sheet-lead bx">「こうしてほしい」で頼んだことを、<wbr>この端末にだけ覚えてるで。<wbr>次に投稿をつくるときは、<wbr>この好みをふまえて最初から作る。<wbr>使うほど、じぶん色にできあがるで。</p>
      ${rows}
      <div class="stack">
        ${list.length ? '<button type="button" class="btn btn-secondary btn-block" data-act="prefClearAll">履歴をぜんぶ消す</button>' : ""}
        <button type="button" class="btn btn-secondary btn-block" data-act="closeSheet">とじる</button>
      </div>`;
  }

  // マイ投稿記録のシート
  function histHtml() {    const list = histGet();
    const rows = list.length
      ? list
          .map((h) => {
            const d = new Date(h.at);
            const when = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
            return `<div class="hist-item">
          <p class="hist-at bx">${esc(when)}${h.theme ? `・${esc(h.theme)}` : ""}</p>
          ${(h.bodies || [])
            .map(
              (b) => `<div class="hist-body">
                <p class="bx">${esc(b.body).replace(/\n/g, "<br>")}</p>
                <button type="button" class="btn-text" data-act="histCopy" data-at="${h.at}" data-id="${esc(b.id)}">${ICON.copy}<span>コピー</span></button>
              </div>`
            )
            .join("")}
          <button type="button" class="btn-text hist-del" data-act="histDel" data-at="${h.at}">この記録を消す</button>
        </div>`;
          })
          .join("")
      : '<p class="key-on bx">まだ記録はあらへん。投稿をつくると、この端末に残るで。</p>';
    return `
      <div class="sheet-grip" aria-hidden="true"></div>
      <h2 class="sheet-title" id="sheetTitle">マイ投稿記録</h2>
      <p class="sheet-lead bx">つくった投稿文の記録や。<wbr>この端末にだけ残ってて、<wbr>使い回すときはコピーしてな。<wbr>20件まで残るで。</p>
      ${rows}
      <div class="stack"><button type="button" class="btn btn-secondary btn-block" data-act="closeSheet">とじる</button></div>`;
  }

  // じぶんの書き方（過去の投稿）をおぼえさせるシート
  function voiceIntakeHtml() {
    return `<ol class="key-steps">
        <li class="bx">ブラウザで <b>linkedin.com</b> を開いて、右上の自分のアイコン → <b>「設定とプライバシー」</b>を開く</li>
        <li class="bx">「<b>データのプライバシー</b>」→「<b>データの取得</b>」→「投稿を含むデータ」でリクエスト（理由はどれでもOK）</li>
        <li class="bx">LinkedInから<b>メールが届く</b>（数十秒〜数分）。リンクから、<b>zipファイル</b>をダウンロードする</li>
        <li class="bx">zipを開くと、ファイルがいっぱいある。その中の <b>「shares.csv」</b>が過去の投稿や。それだけを、下の箱に入れてな</li>
      </ol>
      <div class="drop-zone" id="voiceDrop">
        <label class="btn btn-primary btn-block" for="voiceFile">ファイルをえらぶ（drag & drop もOK）</label>
        <input id="voiceFile" type="file" accept=".csv,.txt,text/csv,text/plain" class="sr-only">
        <p class="drop-note bx">ここに <b>shares.csv</b> を、<wbr>パソコンならドラッグ＆ドロップでも入れられるで。<wbr>スマホは「ファイルをえらぶ」から。<wbr>zipのままだと読めへんから、<wbr>中の csv をえらんでな。</p>
      </div>
      <div class="field">
        <label class="field-label" for="voicePaste">ファイルが無い人は：過去の投稿を、そのまま貼り付け</label>
        <textarea id="voicePaste" class="edit-body" rows="5" placeholder="自分の投稿文を、そのまま貼り付け。何個でもOK。間は空行で分けてな"></textarea>
        <p class="field-note">LinkedInのプロフィールの「活動」から、自分の投稿をコピーして貼ればOK。</p>
        <button type="button" class="btn btn-secondary btn-block" data-act="voicePasteLearn">貼り付けた投稿からおぼえさせる</button>
      </div>
      ${T.voiceRaw && T.voiceCount ? `<p class="key-on bx">「${esc(T.voiceName || "ファイル")}」から <b>${T.voiceCount}件</b>の投稿を見つけたで。</p><div class="stack"><button type="button" class="btn btn-primary btn-block" data-act="voiceLearn">この内容でおぼえさせる</button></div>` : ""}`;
  }
  // じぶんの書き方のシート（マイクのvoiceHtmlと名前がかぶらないように）
  function voiceSheetHtml() {
    const has = !!VOICE.text;
    return `
      <div class="sheet-grip" aria-hidden="true"></div>
      <div class="skip-row"><button type="button" class="btn btn-secondary btn-block" data-act="closeSheet">とばしてOK（あとでいい）。ふつうに作れるで</button></div>
      <h2 class="sheet-title" id="sheetTitle">じぶんの書き方をおぼえさせる</h2>
      <p class="sheet-lead bx">これは、やらなくてもOKやで。全然飛ばして進めて大丈夫。<wbr>やるなら：いつもの自分の投稿文の<wbr>「くせ」を、一度だけAIに学ばせるで。<wbr><b>一度おぼえたら、この先の投稿にもずっと反映されるで</b>（この端末の中だけ）。<wbr>もうファイルを読み込むこともなく、<wbr>APIの消費も一度だけで済むで。</p>
      ${
        has
          ? `<div class="voice-state">
        <p class="voice-stat bx">${VOICE.on ? "いま：<b>じぶんの書き方で作ってる（ON）</b>" : "いま：<b>つかってない（OFF）</b>。ふつうの作り方やで"}</p>
        <div class="stack">
          <button type="button" class="btn ${VOICE.on ? "btn-secondary" : "btn-primary"} btn-block" data-act="voiceToggle">${VOICE.on ? "じぶんの書き方をやめる（OFFにする）" : "じぶんの書き方で作る（ONにする）"}</button>
        </div>
        <details class="key-trouble" open>
          <summary>AIがおぼえた「くせ」（見るだけ）</summary>
          <p class="voice-profile bx">${esc(VOICE.text).replace(/\n/g, "<br>")}</p>
        </details>
        <details class="key-trouble">
          <summary>もう一度ファイルから学び直す・消す</summary>
          ${voiceIntakeHtml()}
          <button type="button" class="btn-text hist-del" data-act="voiceErase">この端末からおぼえた書き方を消す</button>
        </details>
      </div>`
          : voiceIntakeHtml()
      }
      <div class="stack">
        <button type="button" class="btn btn-primary btn-block" data-act="closeSheet">とじる</button>
        ${has ? "" : '<p class="key-on bx">飛ばしても、ふつうに投稿文は作れるで</p>'}
      </div>`;
  }

  // LinkedInのCSV（shares.csv）やテキストから、投稿文だけを抜き出す
  function csvParse(text) {
    const rows = [];
    let row = [];
    let cell = "";
    let q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) {
        if (ch === '"') {
          if (text[i + 1] === '"') {
            cell += '"';
            i++;
          } else q = false;
        } else cell += ch;
      } else if (ch === '"') q = true;
      else if (ch === ",") {
        row.push(cell);
        cell = "";
      } else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        row.push(cell);
        cell = "";
        if (row.some((c) => c !== "")) rows.push(row);
        row = [];
      } else cell += ch;
    }
    row.push(cell);
    if (row.some((c) => c !== "")) rows.push(row);
    return rows;
  }
  function htmlText(s) {
    return String(s || "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|h\d)>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\r\n?/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }
  function extractPosts(text) {
    let texts = [];
    if (/<\/?(html|body|p|div|br)[\s>]/i.test(text) || /share|comment/i.test(text.slice(0, 800))) {
      const rows = csvParse(text);
      if (rows.length > 1) {
        const header = rows[0].map((h) => String(h).toLowerCase());
        let col = header.findIndex((h) => /share/.test(h) && /comment|text|content/.test(h));
        if (col === -1) col = header.findIndex((h) => /comment/.test(h));
        if (col === -1) {
          col = 0;
          let best = -1;
          for (let c = 0; c < (rows[1] || []).length; c++) {
            const len = rows.reduce((s, r) => s + String(r[c] || "").length, 0);
            if (len > best) {
              best = len;
              col = c;
            }
          }
        }
        texts = rows.slice(1).map((r) => htmlText(r[col] || ""));
      }
    }
    if (!texts.length) texts = String(text).split(/\n\s*\n/);
    return texts.map((t) => htmlText(t).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")).filter((t) => count(t) >= 30);
  }
  function readVoiceFile(f) {
    if (!f) return;
    if (/\.zip$/i.test(f.name)) {
      toast("zipのままだと読めへんで。zipを開いて、中の「shares.csv」をえらんでな", 4000);
      return;
    }
    const rd = new FileReader();
    rd.onload = () => {
      const posts = extractPosts(String(rd.result || ""));
      if (!posts.length) {
        toast("投稿文が見つからへんかった。「shares.csv」を入れるか、投稿をそのままコピペしてな", 3800);
        return;
      }
      T.voiceRaw = posts.slice(0, 40).join("\n----\n").slice(0, 15000);
      T.voiceCount = posts.length;
      T.voiceName = f.name;
      openSheet(voiceSheetHtml(), "[data-act=voiceLearn]");
      toast(`${posts.length}件の投稿を見つけたで`, 2200);
    };
    rd.readAsText(f);
  }

  function reportDoneHtml() {
    return `
      <div class="r-done">
        <div class="stamp cloud is-fresh" data-bump="24" data-seed="13"><span>届いたで！</span></div>
        <h2 class="sheet-title" id="sheetTitle">パネラーに届いたで！</h2>
        <p class="sheet-lead bx">表彰、お楽しみに。<wbr>リンクはあとから<wbr>足すこともできるで。</p>
        <div class="stack"><button type="button" class="btn btn-primary btn-block" data-act="closeSheet">とじる</button></div>
      </div>`;
  }
  function reportError(msg, focusSel) {
    const e = $("#rError", sheet);
    if (e) e.textContent = msg;
    const f = focusSel && $(focusSel, sheet);
    if (f) f.focus();
  }
  async function pasteUrl() {
    try {
      const t = await navigator.clipboard.readText();
      const u = pickLinkedInUrl(t);
      const box = $("#rUrl", sheet);
      if (!box) return;
      box.value = u.url || String(t || "").trim();
      reportError(u.error ? "コピーしたのがLinkedInのリンクやないみたい。もう一回コピーしてな" : "");
    } catch {
      toast("入力欄を長押しして「貼り付け」してな", 2200);
      const box = $("#rUrl", sheet);
      if (box) box.focus();
    }
  }
  async function sendReport() {
    if (T.reporting) return;
    const r = T.rep;
    const self = r.mode === "self";
    const name = ($("#rName", sheet).value || "").replace(/\s+/g, " ").trim();
    const rawUrl = ($("#rUrl", sheet).value || "").trim();
    const bodyBox = $("#rBody", sheet);
    const body = ((bodyBox && bodyBox.value) || "").trim();
    if (!name) return reportError("名前を入れてな。LinkedInと同じ名前やと、パネラーが見つけやすいで", "#rName");
    const u = pickLinkedInUrl(rawUrl);
    if (u.error) return reportError("LinkedInの投稿のリンクを貼ってな（なくてもOK）", "#rUrl");
    if (self && !u.url && !body) return reportError("リンクか文章の、どっちかを入れてな", "#rUrl");
    if (!self && !body && !u.url) return reportError("本文が空っぽみたい。「パネラーに届く本文」を見てな");
    T.reporting = true;
    const btn = $("#rSend", sheet);
    if (btn) {
      btn.setAttribute("aria-disabled", "true");
      btn.textContent = "送ってるで…";
    }
    const payload = {
      clientId: S.clientId,
      name,
      url: u.url,
      body,
      source: self ? "self" : "app",
      tone: self ? "" : r.tone,
      screenOk: r.screenOk,
      event: EVENT ? EVENT.id : "",
    };
    try {
      const res =
        MODE === "preview"
          ? await new Promise((ok) => setTimeout(() => ok({ ok: true, id: "preview", url: u.url }), 450))
          : await postJSON("api/report", payload, 15000);
      REP = {
        id: res.id,
        name,
        url: res.url || u.url,
        body,
        source: payload.source,
        tone: payload.tone,
        screenOk: r.screenOk,
        doneText: self ? "" : r.doneText,
        at: Date.now(),
      };
      reportStore.set(REP);
      T.rep = null;
      openSheet(reportDoneHtml(), "[data-act=closeSheet]");
      keepScroll(render);
    } catch (e) {
      const code = e && e.code;
      reportError(
        code === "rate"
          ? "ちょっと待ってから、もう一回押してな"
          : code === "url"
          ? "LinkedInの投稿のリンクを貼ってな（なくてもOK）"
          : code === "name"
          ? "名前を入れてな"
          : code === "empty"
          ? "リンクか文章の、どっちかを入れてな"
          : code === "timeout"
          ? "時間がかかりすぎて止まってしもた。もう一回押してな"
          : "送られへんかった。電波のええとこで、もう一回押してな"
      );
      if (btn) {
        btn.setAttribute("aria-disabled", "false");
        btn.textContent = r.editing ? "直して送る" : "報告する";
      }
    } finally {
      T.reporting = false;
    }
  }

  // 「コピーしてLinkedInをひらく」と同時に、審査員へ報告する（LinkedInに行ったまま戻らない人のため）
  function autoReport(text) {
    if (MODE === "preview") return;
    const keep = REP && REP.source === "app";
    const payload = {
      clientId: S.clientId,
      name: myName(),
      url: keep ? REP.url || "" : "",
      body: text,
      source: "app",
      tone: S.tab,
      screenOk: REP ? REP.screenOk !== false : RC.screenDefault !== false,
      event: EVENT ? EVENT.id : "",
    };
    postJSON("api/report", payload, 15000)
      .then((res) => {
        REP = { id: res.id, name: payload.name, url: res.url || payload.url, body: text, source: "app", tone: payload.tone, screenOk: payload.screenOk, doneText: text, at: Date.now() };
        reportStore.set(REP);
        if (S.step === "done") keepScroll(render);
        toast("審査員にも届いたで！", 1800);
      })
      .catch(() => toast("審査員への送信に失敗したで。下の「報告する」を押してな", 3000));
  }

  // ---------- コピー ----------
  // ボタンを押したその場で実行する（ブラウザの制限のため）。古い方法と新しい方法の両方を試す
  function copyNow(text) {
    let ok = false;
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;font-size:16px;";
      document.body.appendChild(ta);
      ta.focus({ preventScroll: true });
      ta.select();
      ta.setSelectionRange(0, text.length);
      ok = document.execCommand && document.execCommand("copy");
      ta.remove();
    } catch {}
    try {
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).catch(() => {});
        ok = true;
      }
    } catch {}
    return ok;
  }

  // 上級者向け設定をサーバーへ渡すときの、日本語も入るbase64
  const b64utf8 = (s) => {
    const b = new TextEncoder().encode(s);
    let bin = "";
    for (const ch of b) bin += String.fromCharCode(ch);
    return btoa(bin);
  };

  // ---------- 写真 ----------
  // えらんだ写真は、すぐ端末で長辺1024pxのJPEGにする。大きい元の写真は持ち続けない（iPhoneで画面が落ちる対策）
  const PHOTO_LIMIT = 10;
  const PHOTO_MAX_PX = 1024;
  const PHOTO_MANY_PX = 768; // 5枚目からは少し小さくする（送る量を抑えて、会場のWi-Fiでも届くように）
  const PHOTO_MAX_CHARS = 650000; // サーバーの上限（700000）より少し小さく
  function shrinkPhoto(file, maxPx = PHOTO_MAX_PX) {
    return new Promise((resolve, reject) => {
      const src = URL.createObjectURL(file);
      const img = new Image();
      let settled = false;
      const finish = (err, v) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        URL.revokeObjectURL(src);
        img.onload = img.onerror = null;
        img.src = "";
        if (err) reject(err);
        else resolve(v);
      };
      const timer = setTimeout(() => finish(Object.assign(new Error("写真の読みこみが15秒で終わらへんかった"), { code: "photo_timeout" })), 15000);
      img.onload = () => {
        try {
          const w0 = img.naturalWidth;
          const h0 = img.naturalHeight;
          if (!w0 || !h0) throw Object.assign(new Error("写真の大きさが読めへんかった"), { code: "photo_size" });
          const k = Math.min(1, maxPx / Math.max(w0, h0));
          const cv = document.createElement("canvas");
          cv.width = Math.max(1, Math.round(w0 * k));
          cv.height = Math.max(1, Math.round(h0 * k));
          const g = cv.getContext("2d");
          g.fillStyle = "#fff"; // 透明なところは白に
          g.fillRect(0, 0, cv.width, cv.height);
          g.drawImage(img, 0, 0, cv.width, cv.height);
          let url = "";
          for (const q of [0.8, 0.65, 0.5]) {
            url = cv.toDataURL("image/jpeg", q);
            if (url.length - url.indexOf(",") - 1 <= PHOTO_MAX_CHARS) break;
          }
          cv.width = cv.height = 0;
          const data = url.slice(url.indexOf(",") + 1);
          if (!url.startsWith("data:image/jpeg") || data.length < 100 || data.length > PHOTO_MAX_CHARS) {
            throw Object.assign(new Error("写真を小さくできへんかった"), { code: "photo_encode" });
          }
          finish(null, { url, mime: "image/jpeg", data, kb: Math.round((data.length * 3) / 4 / 1024) });
        } catch (e) {
          finish(e);
        }
      };
      img.onerror = () => finish(Object.assign(new Error("この形式の写真は、このブラウザで開けへんかった"), { code: "photo_decode" }));
      img.src = src;
    });
  }
  async function addPhotos(files) {
    if (T.photoBusy) return;
    T.photoBusy = true;
    if (S.step === "style" || S.step === "pick") keepScroll(render);
    let failed = 0;
    let over = false;
    for (const f of files) {
      if (T.photos.length >= PHOTO_LIMIT) {
        over = true;
        break;
      }
      try {
        T.photos.push(await shrinkPhoto(f, T.photos.length >= 4 ? PHOTO_MANY_PX : PHOTO_MAX_PX));
      } catch (e) {
        failed += 1;
        clientLog("photo", e, { kb: Math.round((f.size || 0) / 1024), message: `${(e && e.message) || e}（${f.type || "形式不明"}）` });
      }
    }
    T.photoBusy = false;
    if (S.step === "style" || S.step === "pick") keepScroll(render);
    if (failed) toast(`写真${failed}枚が読みこめへんかった。別の写真にするか、写真なしで進めてな`, 3600);
    else if (over) toast(`写真は${PHOTO_LIMIT}枚までやで`, 2400);
  }
  const photoKb = () => T.photos.reduce((n, p) => n + (p.kb || 0), 0);
  // 写真が多いほど、AIの返事を長く待つ（サーバーは、写真で失敗したら写真なしで作り直すので、その分も見込む）
  const photoTimeout = (base) => (T.photos.length ? Math.min(150000, base + 30000 + T.photos.length * 6000) : base);
  // 生成と書き直しのときだけ、写真を付けて送る（記録用の送信には付けない）
  const withPhotos = (p) => (T.photos.length && p.kind !== "profile" ? { ...p, images: T.photos.map((x) => ({ mime: x.mime, data: x.data })) } : p);

  // ---------- 失敗の記録（運営ページの「最近のエラー」に出る） ----------
  function clientLog(where, e, extra) {
    if (MODE === "preview") return;
    const body = {
      where,
      code: (e && e.code) || (e && e.name) || "",
      message: String((extra && extra.message) || (e && e.message) || e || "").slice(0, 200),
      photos: extra && extra.photos != null ? extra.photos : T.photos.length,
      kb: (extra && extra.kb) || photoKb(),
      clientId: S.clientId,
      name: myName(),
      event: EVENT ? EVENT.id : "",
    };
    try {
      fetch("api/clientlog", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), keepalive: true }).catch(() => {});
    } catch {}
  }
  // 作っている途中で画面が閉じた（落ちた・再読み込みされた）ことに、次に開いたとき気づけるようにする
  const PENDING_KEY = "tsukuttaroka.pending";
  function markPending(on) {
    try {
      if (on) localStorage.setItem(PENDING_KEY, JSON.stringify({ at: Date.now(), photos: T.photos.length, kb: photoKb() }));
      else localStorage.removeItem(PENDING_KEY);
    } catch {}
  }
  function takePending() {
    try {
      const v = JSON.parse(localStorage.getItem(PENDING_KEY) || "null");
      localStorage.removeItem(PENDING_KEY);
      return v && Date.now() - v.at < 10 * 60 * 1000 ? v : null;
    } catch {
      return null;
    }
  }

  // ---------- AIとの通信 ----------
  async function postJSON(url, body, timeoutMs) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    const headers = { "content-type": "application/json" };
    if (/api\/(generate|refine|style)/.test(url)) {
      if (MYKEY) headers["x-user-key"] = MYKEY;
      if (advOn()) headers["x-ai-config"] = b64utf8(JSON.stringify(AISET));
      // イベントのあいことば（日本語でも送れるように、ヘッダーでは文字をエスケープする）。あいことばのないイベントは、イベントIDだけ
      if (!MYKEY && !advOn() && eventKeyReady()) {
        headers["x-event"] = EVENT.id;
        if (EVPASS) headers["x-event-pass"] = encodeURIComponent(EVPASS);
      }
    }
    try {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: ctl.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) {
        const err = new Error(data.message || "request failed");
        err.code = data.code || (res.status === 429 ? "rate" : "failed");
        throw err;
      }
      return data;
    } catch (e) {
      if (e.name === "AbortError") {
        const err = new Error("timeout");
        err.code = "timeout";
        throw err;
      }
      // fetch 自体の失敗（電波が切れた・アプリを切り替えて通信が止まった など）
      if (e instanceof TypeError && !e.code) e.code = "network";
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }

  function toResults(patterns) {
    const list = Array.isArray(patterns) ? patterns : [];
    const out = {};
    TONES.forEach((t, i) => {
      const hit = list.find((p) => p && p.tone === t.id) || list[i];
      out[t.id] = { body: String((hit && hit.body) || "").trim(), edited: false };
    });
    // 作るのは1本。空でないトーンが1つだけなら、そのトーンを結果にする
    const filled = TONES.filter((t) => out[t.id].body);
    if (filled.length === 1) {
      const one = {};
      one[filled[0].id] = out[filled[0].id];
      one.single = true;
      return one;
    }
    return null;
  }

  const API = {
    async generate(p) {
      if (p.kind === "headline" || p.kind === "about") {
        if (MODE === "preview") return { kind: p.kind, ...samplePart(p), sample: true };
        const data = await postJSON("api/generate", p, 60000);
        if (data.sample) return { kind: p.kind, ...samplePart(p), sample: true };
        if (p.kind === "headline") {
          const list = Array.isArray(data.headlines) ? data.headlines.map(String).filter(Boolean) : [];
          if (!list.length) throw Object.assign(new Error("empty"), { code: "empty" });
          return { kind: "headline", list, model: data.model || "" };
        }
        if (!data.about) throw Object.assign(new Error("empty"), { code: "empty" });
        return { kind: "about", text: String(data.about), model: data.model || "" };
      }
      if (MODE === "preview") return previewGenerate(p);
      const data = await postJSON("api/generate", withPhotos(p), photoTimeout(60000));
      if (data.sample) return { ...sampleGenerate(p), sample: true };
      const r = toResults(data.patterns);
      if (!r) throw Object.assign(new Error("empty"), { code: "empty" });
      return { ...r, model: data.model || "", photoSkipped: !!data.photoSkipped };
    },
    async refine(p) {
      if (MODE === "preview") return previewRefine(p);
      const data = await postJSON("api/refine", withPhotos(p), photoTimeout(45000));
      if (data.sample) return { body: sampleRefine(p) };
      if (!data.body) throw Object.assign(new Error("empty"), { code: "empty" });
      return { body: data.body };
    },
    submit(p) {
      if (MODE === "preview") return;
      try {
        fetch("api/submit", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(p),
          keepalive: true,
        }).catch(() => {});
      } catch {}
    },
  };

  // プレビュー版（claude.ai 上）では、Claude に文章を書いてもらう。使えなければサンプル文
  let samplerPromise = null;
  function getSampler() {
    if (!samplerPromise) {
      samplerPromise =
        window.claude && typeof window.claude.use === "function"
          ? window.claude.use("sample").catch(() => null)
          : Promise.resolve(null);
    }
    return samplerPromise;
  }
  async function previewGenerate(p) {
    const P = window.PREVIEW_AI;
    const sampler = await getSampler();
    if (sampler && P && !T.samplerOff) {
      try {
        const out = await sampler.json(P.generatePrompt(p), { modelTier: "quick", cache: false });
        const list = (out && out.patterns) || [];
        const cleaned = list.map((x) => ({ tone: x.tone, body: P.cleanBody(String(x.body || ""), p.style.phrase) }));
        const r = toResults(cleaned);
        if (r) return { ...r, via: "claude" };
      } catch (e) {
        if (e && ["not_granted", "sampling_disabled", "not_declared", "capability_disabled", "capability_removed"].includes(e.code)) T.samplerOff = true;
      }
    }
    return { ...sampleGenerate(p), sample: true };
  }
  async function previewRefine(p) {
    const P = window.PREVIEW_AI;
    const sampler = await getSampler();
    if (sampler && P && !T.samplerOff) {
      try {
        const out = await sampler.json(P.refinePrompt(p), { modelTier: "quick", cache: false });
        const body = P.cleanBody(String((out && out.body) || ""), p.style.phrase);
        if (body) return { body };
      } catch (e) {
        if (e && ["not_granted", "sampling_disabled", "not_declared", "capability_disabled", "capability_removed"].includes(e.code)) T.samplerOff = true;
      }
    }
    return { body: sampleRefine(p) };
  }

  // AIが使えないとき用のサンプル文（回答を差し込むだけの簡易版）
  function sampleGenerate(p) {
    const get = (id) => p.answers.find((a) => a.id === id);
    const say = (a) => (a ? a.text || (a.chips || []).join("、") : "");
    const learn = say(get("learn")) || "発信は完璧じゃなくていい";
    const thanks = say(get("thanks"));
    const next = say(get("next"));
    const extra = p.answers.filter((a) => !["learn", "thanks", "next"].includes(a.id)).map(say).filter(Boolean)[0] || "";
    const phrase = p.style.phrase ? `\n\n${p.style.phrase}` : "";
    const para = (arr) => arr.filter(Boolean).join("\n\n");
    return {
      emo: {
        body: para([
          `${C.eventName ? `「${C.eventName}」` : "今日"}で、いちばん心に残ったのは「${learn}」ということ。`,
          extra,
          thanks,
          `明日からは、${next || "今日つながった人の投稿にコメントするところ"}からはじめます。${phrase}`,
          `みなさんが最近はじめた「小さな一歩」は何ですか？`,
        ]),
      },
      humor: {
        body: para([
          `「発信？ ちゃんとした人がやるもんやろ」と思ってた昨日の自分に、ツッコミを入れたい夜でした。`,
          `${C.eventName ? `「${C.eventName}」` : "今日"}気づいたのは「${learn}」。`,
          extra,
          thanks,
          `というわけで、${next || "まずは誰かの投稿にコメント"}。宣言したから、もう逃げられへん。${phrase}`,
        ]),
      },
      straight: {
        body: para([
          `今日の学びは「${learn}」です。`,
          C.eventName ? `「${C.eventName}」に参加して、考えたことを残しておきます。` : "",
          extra,
          thanks,
          `明日からやること：${next || "今日つながった人の投稿にコメントする"}。${phrase}`,
          `みなさんは、発信を続けるためにどんな工夫をしていますか？`,
        ]),
      },
    };
  }
  // 見出し・自己紹介のサンプル（AIが使えないとき。回答をそのまま並べるだけ）
  function samplePart(p) {
    const say = (a) => (a ? a.text || (a.chips || []).join("、") : "");
    const by = (id) => say(p.answers.find((a) => a.id === id));
    const c = p.pcond || {};
    const now = by("pf_now") || c.role || "学生";
    const dirs = (c.dirs || []).join("・");
    const head = (...xs) => xs.filter(Boolean).join("｜");
    if (p.kind === "headline") {
      const list = [head(now, by("pf_skill")), head(now, by("pf_exp")), head(now, dirs && `${dirs}志望`), head(by("pf_skill"), by("pf_future")), head(now, by("pf_future"))].filter(Boolean);
      return { list: list.length ? list : [now] };
    }
    return { text: p.answers.map(say).filter(Boolean).join("\n\n") + "\n\nどうぞよろしくお願いします。" };
  }
  function sampleRefine(p) {
    const body = String(p.body || "");
    if (p.action === "shorter") {
      const paras = body.split(/\n\n+/);
      return paras.length > 3 ? [paras[0], paras[1], paras[paras.length - 1]].join("\n\n") : body;
    }
    return body;
  }

  // キーが無いと作れない。シートを出して、保存したら続きを自動でやる
  function needKey(after) {
    T.keyAfter = after || "";
    if (eventNeedsPass()) {
      openSheet(keyHtml(), "#evPass");
      toast("作るには、イベントのあいことばを入れてな（ブースのスタッフが教えてくれるで）", 4000);
      return;
    }
    openSheet(keyHtml(), "#apiKeyInput");
    toast("作るには、まず文章を作るAIを紐づけるで。シートの手順どおりなら5分ぐらいでできる", 4000);
  }

  // ---------- イベント ----------
  async function loadEvent() {
    if (!EVID || MODE === "preview") return;
    try {
      const res = await fetch(`api/event?e=${encodeURIComponent(EVID)}`, { cache: "no-store" });
      const d = await res.json().catch(() => ({}));
      if (!d.ok || !d.event) {
        // 消された・止められたイベントからは外れる
        if (res.status === 404) {
          EVID = "";
          EVPASS = "";
          saveEvent();
        }
        return;
      }
      EVENT = d.event;
      // 運営ページで決めた「質問セット・色」（プリセット）とちがうときは、そのプリセットで開き直す（最初の1回だけ）
      // 専用ページのあるプリセット（LSCW → /lscw）は、そのページで開き直す。専用ページの中では開き直さない
      const target = (window.APP_PRESETS || []).find((p) => p.id === EVENT.preset);
      if (!PAGE && target && EVENT.preset !== C.presetId && !QS.has("preset")) {
        if (URL_PASS) QS.set("p", URL_PASS);
        if (target.pagePath) {
          QS.set("e", EVENT.id);
          location.replace(`${target.pagePath}?${QS}`);
        } else {
          QS.set("preset", EVENT.preset);
          location.replace(`${location.pathname}?${QS}`);
        }
        return new Promise(() => {}); // 開き直すまで待つ
      }
      applyEvent(EVENT);
      saveEvent();
      if (URL_PASS && !MYKEY && !advOn()) await unlockEvent(URL_PASS, true).catch(() => {});
    } catch {}
  }
  // 運営ページで決めたイベントの中身を、画面の設定に重ねる（空の項目は config.js のまま）
  function applyEvent(ev) {
    if (ev.name) C.eventName = ev.name;
    if (ev.hashtags && ev.hashtags.length) {
      C.hashtags = ev.hashtags;
      C.feedTag = ev.hashtags.find((h) => h.toLowerCase() !== "#linkedin") || ev.hashtags[0];
    }
    if (ev.cheerAlways) C.cheerAlways = true;
    if (Array.isArray(ev.mentions) && ev.mentions.length) {
      C.mentions = ev.mentions;
      C.mentionInText = ev.mentionInText !== false;
    }
    if (ev.followUrl) {
      C.followUrl = ev.followUrl;
      C.followName = ev.followName || "";
      C.followRequired = ev.followRequired === true;
    }
    const info = ev.info || {};
    const hasInfo = Object.keys(info).some((k) => info[k]);
    const hasSchedule = Array.isArray(ev.schedule) && ev.schedule.length;
    if (hasInfo || hasSchedule) {
      const ep = { ...(C.eventPage || {}) };
      for (const k of ["title", "when", "place", "mapUrl", "siteUrl", "siteLabel", "note"]) if (info[k]) ep[k] = info[k];
      if (hasSchedule) ep.schedule = ev.schedule;
      C.eventPage = ep;
    }
    if (ev.theme) applyTheme(ev.theme);
  }
  // あいことばを確かめて、この端末に覚える（ちがうときは、サーバーの説明つきのエラーを投げる）
  async function unlockEvent(pass, silent) {
    const v = String(pass || "").trim().slice(0, 60);
    if (!v) throw Object.assign(new Error("あいことばを入れてな"), { code: "input" });
    await postJSON("api/event/unlock", { e: EVID, pass: v, clientId: S.clientId }, 15000);
    EVPASS = v;
    saveEvent();
    if (!silent) toast("あいことば、OKや！これで作れるで", 2400);
  }
  function eventPassHtml() {
    if (!eventNeedsPass()) return "";
    return `<div class="key-box ev-box">
        <label class="key-label" for="evPass">イベントのあいことば${eventKeyReady() ? '<span class="key-ok">入れずみ</span>' : ""}</label>
        <p class="key-note bx">会場のスタッフが教えてくれるで。<wbr>これを入れたら、じぶんのキーは作らんでOK。</p>
        <input id="evPass" class="name-input" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="60" enterkeyhint="done" placeholder="あいことば" value="${esc(eventKeyReady() ? EVPASS : "")}">
        <button type="button" class="btn btn-primary btn-block" data-act="evUnlock">あいことばで使う</button>
        <p class="key-on" id="evStatus" role="status" hidden></p>
      </div>
      <h3 class="ev-or"><span>じぶんのキーで使う人は、こちら</span></h3>`;
  }
  async function evUnlockFlow() {
    const box = $("#evPass", sheet);
    const st = $("#evStatus", sheet);
    const btn = $("[data-act=evUnlock]", sheet);
    if (btn) btn.disabled = true;
    try {
      await unlockEvent(box && box.value, false);
      if (T.keyAfter === "generate" && S.step) {
        T.keyAfter = "";
        closeSheet();
        generate();
        return;
      }
      T.keyAfter = "";
      closeSheet();
      if (S.step === "pick") keepScroll(render);
    } catch (e) {
      if (st) {
        st.hidden = false;
        st.classList.add("is-ng");
        st.textContent = errorText(e);
      }
      if (btn) btn.disabled = false;
    }
  }

  // 「これで紐づける」：まずキーが使えるか確かめてから、端末に保存する
  async function saveKeyFlow() {
    const box = $("#apiKeyInput", sheet);
    const v = String((box && box.value) || "").trim();
    const st = $("#keyStatus", sheet);
    const btn = $('[data-act=saveKey]', sheet);
    if (!v) {
      toast("キーが空のままや。まず「Google AI Studioをひらく」からやってな", 3200);
      return;
    }
    if (st) {
      st.hidden = false;
      st.classList.remove("is-ng");
      st.textContent = "キーを確認してるで…";
    }
    if (btn) btn.disabled = true;
    try {
      if (MODE !== "preview") await postJSON("api/checkkey", { key: v }, 15000);
    } catch (e) {
      if (st) {
        st.hidden = false;
        st.classList.add("is-ng");
        st.textContent = errorText(e);
      }
      if (btn) btn.disabled = false;
      return;
    }
    saveApiKey(v);
    if (st) {
      st.hidden = false;
      st.textContent = "つながった！この端末に覚えたで";
    }
    if (MYKEY && T.keyAfter === "generate" && S.step) {
      T.keyAfter = "";
      closeSheet();
      generate();
      return;
    }
    T.keyAfter = "";
    openSheet(keyHtml(), "#apiKeyInput");
    toast("AIを紐づけたで。これで投稿文が作れるで", 3000);
  }

  // 入力欄への貼り付け（長押しさせないように、ボタン1つでやれるように）
  async function pasteKeyFlow() {
    const box = $("#apiKeyInput", sheet);
    if (!box) return;
    try {
      const t = await navigator.clipboard.readText();
      if (t && t.trim()) {
        box.value = t.trim();
        box.focus();
        toast("貼り付けたで。「これで紐づける」を押してな", 2400);
      } else toast("コピーしたものが見つからへん。キーをもう一度コピーしてな", 3000);
    } catch {
      toast("ここからは貼り付けられへんかった。入力欄を長押しして「貼り付け」を押してな", 3600);
    }
  }

  // ---------- 生成 ----------
  async function generate(payloadOverride) {
    if (T.busy) return;
    // イベントの読みこみが間に合っていなかったら（電波が弱いとき）、もう一度だけ読んでから確かめる
    if (!aiReady() && MODE !== "preview" && EVID && !EVENT) await loadEvent();
    if (!aiReady() && MODE !== "preview") return needKey("generate");
    T.busy = true;
    T.error = "";
    stopMic();
    T.modeFrom = "";
    if (!sheet.hidden) closeSheet();
    const before = S.step;
    S.step = "loading";
    render();
    window.scrollTo(0, 0);
    startLoadingLines();
    markPending(true);
    try {
      const r = await API.generate(payloadOverride || payload());
      if (r.kind === "headline" || r.kind === "about") {
        S.presults[r.kind] = r.kind === "headline" ? { list: r.list.slice(0, 5), edited: false, sample: !!r.sample } : { text: r.text, edited: false, sample: !!r.sample };
        T.editing = false;
        T.fresh = true;
        S.step = "result";
        histAdd({ at: Date.now(), theme: r.kind === "headline" ? "見出し" : "自己紹介", bodies: r.kind === "headline" ? r.list.map((h, i) => ({ id: `h${i}`, label: `見出し${i + 1}`, body: h })) : [{ id: "about", label: "自己紹介", body: r.text }] });
        save();
        render();
        window.scrollTo(0, 0);
        if (r.sample) toast("いまはサンプルの文やで。AIを紐づけると、本番の文章になるで", 4000);
        setTimeout(() => (T.fresh = false), 800);
        return;
      }
      S.results = r;
      S.resultMode = S.mode || "";
      S.tab = TONES.some((x) => x.id === S.startTone) ? S.startTone : TONES[0].id;
      S.checks = C.checklist.map(() => false);
      T.editing = false;
      T.fresh = true;
      S.step = "result";
      histAdd({
        at: Date.now(),
        theme: String(S.customTheme || "").trim() || (setById(S.setId) || {}).label || "",
        bodies: TONES.map((t) => ({ id: t.id, label: t.label, body: (S.results[t.id] && S.results[t.id].body) || "" })).filter((b) => b.body),
      });
      save();
      render();
      window.scrollTo(0, 0);
      if (r.sample) toast("いまはサンプルの文やで。AIを紐づけると、本番の文章になるで（最初の画面の下のボタンから）", 5000);
      else if (r.photoSkipped) toast("写真はAIが読めへんかったから、文字の回答だけで作ったで", 4000);
      const h = $(".tabs [aria-selected=true]");
      if (h) h.focus({ preventScroll: true });
      setTimeout(() => (T.fresh = false), 800);
    } catch (e) {
      if (e && e.code === "pass") {
        EVPASS = "";
        saveEvent();
      }
      if (!loggedByServer(e)) clientLog("generate", e);
      T.error = errorText(e);
      if (before === "result" && (isProfile() ? S.presults[S.kind] : S.results)) {
        // 作り直しに失敗したときは、前の文に戻す
        S.step = "result";
        render();
        toast(T.error, 3000);
        T.error = "";
      } else if (isProfile()) {
        // 見出し・自己紹介は、じぶん色の画面がないので、最後の質問にもどしてエラーを出す
        S.step = "answer";
        S.cursor = Math.max(0, flowCards().length - 1);
        render();
        toast(T.error, 4000);
        T.error = "";
      } else {
        S.step = "style";
        render();
      }
    } finally {
      markPending(false);
      T.busy = false;
      stopLoadingLines();
    }
  }
  function startLoadingLines() {
    let i = 0;
    stopLoadingLines();
    T.loadTimer = setInterval(() => {
      const el = $("#loadLine");
      if (!el) return;
      i = (i + 1) % C.loadingLines.length;
      el.textContent = C.loadingLines[i];
    }, 2200);
  }
  function stopLoadingLines() {
    if (T.loadTimer) clearInterval(T.loadTimer);
    T.loadTimer = null;
  }
  function errorText(e) {
    const code = e && e.code;
    if (code === "stopped") return "いまは受付を止めてるみたい。運営に声かけてな。";
    if (code === "rate") return "ちょっと連打しすぎかも。5秒おいて、もう一回どうぞ。";
    if (code === "timeout") return "時間がかかりすぎて止まってしもた。入力は残ってるで。もう一回押してみて。";
    if (code === "input") return "回答が空っぽみたい。ひとことだけでも書いてな。";
    if (code === "network") return "通信が切れたみたい。電波のええとこで、もう一回押してみて。入力は残ってるで。";
    if (code === "empty") return "AIの返事が空っぽやった。入力は残ってるで。もう一回押してみて。";
    // サーバーからの詳しい説明（キーの間違い・上限など）があれば、そのとおりに出す（画面側のエラー文は出さない）
    if (code && e.message && e.message !== "request failed") return e.message;
    return "混み合ってて作れへんかった。入力はそのまま残ってるで。もう一回押してみて。";
  }
  // サーバーが自分で記録している失敗（AIの失敗・連打・受付停止）以外は、端末から記録を送る
  const loggedByServer = (e) => ["failed", "rate", "stopped"].includes(e && e.code);

  // 見出し（5案ぜんぶ）・自己紹介の書き直し
  async function refinePart(actionId, request) {
    const kind = S.kind;
    const r = S.presults[kind];
    if (!r) return;
    T.refining = kind;
    render();
    try {
      const cur = kind === "headline" ? r.list.join("\n") : r.text;
      if (MODE !== "preview") {
        const data = await postJSON("api/refine", { ...payload(), body: cur, action: actionId, request: request || "" }, 45000);
        if (!data.sample) {
          if (kind === "headline") {
            const list = Array.isArray(data.headlines) ? data.headlines.map(String).filter(Boolean) : [];
            if (!list.length) throw Object.assign(new Error("empty"), { code: "empty" });
            S.presults.headline = { list: list.slice(0, 5), edited: false };
          } else {
            if (!data.body) throw Object.assign(new Error("empty"), { code: "empty" });
            S.presults.about = { text: String(data.body), edited: false };
          }
        }
      }
      if (actionId === "custom") {
        prefsAdd(request);
        T.ask = "";
      }
      save();
      toast(actionId === "custom" ? "言われたとおり直したで" : "直したで", 1400);
    } catch (e) {
      if (e && e.code === "pass") {
        EVPASS = "";
        saveEvent();
      }
      if (!loggedByServer(e)) clientLog("refine", e);
      toast(errorText(e), 2600);
    } finally {
      T.refining = null;
      render();
    }
  }
  // 見出し・自己紹介をコピーした記録（件数だけ。中身は保存しない）
  function recordProfile(what, text) {
    const key = `profile|${what}|${count(text)}|${text.slice(0, 24)}`;
    if (S.sent.includes(key)) return;
    S.sent.push(key);
    save();
    const r = S.presults[S.kind] || {};
    API.submit({ ...payload(), action: "copy", tone: "", finalText: "", edited: !!r.edited, patterns: {}, consent: false, cardIds: flowCards().map((c) => c.id) });
  }

  async function refine(actionId, request) {
    if (T.refining) return;
    if (!aiReady() && MODE !== "preview") return needKey("");
    if (isProfile()) return refinePart(actionId, request);
    const t = S.tab;
    T.refining = t;
    render();
    try {
      const r = await API.refine({ ...payload(), tone: t, body: S.results[t].body, action: actionId, request: request || "" });
      S.results[t] = { body: r.body, edited: false };
      // 頼んだ直しを「じぶんの好み」として覚える（次回の生成に反映）
      if (actionId === "custom") prefsAdd(request);
      else {
        const a = (C.refineActions || []).find((x) => x.id === actionId);
        if (a) prefsAdd(a.label);
      }
      if (actionId === "custom") T.ask = "";
      save();
      toast(actionId === "custom" ? "言われたとおり直したで" : "直したで", 1400);
    } catch (e) {
      if (e && e.code === "pass") {
        EVPASS = "";
        saveEvent();
      }
      if (!loggedByServer(e)) clientLog("refine", e);
      toast(errorText(e), 2600);
    } finally {
      T.refining = null;
      render();
    }
  }

  function record(action) {
    const t = S.tab;
    const text = finalText(t);
    const key = `${action}|${t}|${count(text)}|${text.slice(0, 24)}`;
    if (S.sent.includes(key)) return;
    S.sent.push(key);
    API.submit({
      ...payload(),
      action,
      tone: t,
      finalText: text,
      edited: !!S.results[t].edited,
      patterns: Object.fromEntries(TONES.map((x) => [x.id, (S.results[x.id] && S.results[x.id].body) || ""])),
      consent: !!S.consent,
      cardIds: flowCards().map((c) => c.id),
    });
  }

  // ---------- 音声入力 ----------
  // 1回タップ＝1文（話し終わると自動で止まる）。
  // 端末によって「前の結果をもう一度送ってくる」「積み上げた文を毎回送ってくる」クセがあるので、
  // 毎回ぜんぶ作り直して重複を消す（Androidで「リンクリンクリンク…」になる対策）
  const MIC_FATAL = ["not-allowed", "service-not-allowed", "audio-capture", "network", "language-not-supported", "bad-grammar"];
  let rec = null;
  let micSession = null;

  function pushDedup(list, t) {
    const last = list[list.length - 1];
    if (last === undefined) list.push(t);
    else if (t === last || last.startsWith(t)) return;
    else if (t.startsWith(last)) list[list.length - 1] = t;
    else list.push(t);
  }
  function mergeLive(fin, interim) {
    if (!interim) return fin;
    if (!fin) return interim;
    if (interim.startsWith(fin)) return interim;
    if (fin.endsWith(interim)) return fin;
    return fin + interim;
  }
  function joinSpoken(base, said) {
    if (!said) return base;
    if (!base) return said;
    return /[\s。、！？!?]$/.test(base) ? base + said : `${base}。${said}`;
  }
  function autoGrow(ta) {
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight + 4, Math.round(window.innerHeight * 0.55))}px`;
  }

  function startMic() {
    const ta = $("#answer");
    const card = currentCard();
    if (!ta || !card || !SR || T.micBlocked) return;
    const session = { base: ta.value, cardId: card.id, started: Date.now(), got: false, errored: false, userStopped: false, timer: null };
    micSession = session;
    try {
      rec = new SR();
      rec.lang = "ja-JP";
      rec.interimResults = true;
      rec.continuous = false;
      rec.maxAlternatives = 1;
      rec.onresult = (e) => {
        if (micSession !== session) return;
        const box = $("#answer");
        const cur = currentCard();
        if (!box || !cur || cur.id !== session.cardId) return;
        const finals = [];
        let interim = "";
        for (let i = 0; i < e.results.length; i++) {
          const r = e.results[i];
          const t = String((r && r[0] && r[0].transcript) || "").trim();
          if (!t) continue;
          if (r.isFinal) pushDedup(finals, t);
          else interim = t;
        }
        const said = mergeLive(finals.join(""), interim);
        if (!said) return;
        session.got = true;
        box.value = joinSpoken(session.base, said).slice(0, 400);
        autoGrow(box);
        onAnswerInput(box.value);
      };
      // 終わりの処理（end が来ないブラウザもあるので、致命的なエラーのときはここで閉じる）
      const endSession = () => {
        if (micSession !== session) return;
        clearTimeout(session.timer);
        micSession = null;
        rec = null;
        // 何も聞き取らずに一瞬で終わった＝このブラウザでは動かない、とみなす
        if (!session.got && !session.errored && !session.userStopped && Date.now() - session.started < 900) {
          T.micBlocked = true;
          T.micReason = "quick-end";
        }
        T.listening = false;
        refreshVoice();
      };
      rec.onerror = (e) => {
        if (micSession !== session) return;
        const err = e && e.error;
        session.errored = true;
        if (MIC_FATAL.includes(err)) {
          T.micBlocked = true;
          T.micReason = err;
          endSession();
        } else if (err === "no-speech") {
          toast("聞き取れへんかった。もう一回タップして、話してな", 2400);
        }
      };
      rec.onend = endSession;
      rec.start();
      T.listening = true;
      session.timer = setTimeout(() => finishMic(), 30000);
    } catch {
      micSession = null;
      rec = null;
      T.micBlocked = true;
      T.micReason = "start-failed";
      T.listening = false;
    }
    refreshVoice();
  }
  // 自分で止めたとき：聞き取った分は残す（終わりの処理は onend で）
  function finishMic() {
    const s = micSession;
    if (!rec || !s) return;
    s.userStopped = true;
    try {
      rec.stop();
    } catch {
      stopMic();
      return;
    }
    // 止めても返事がないブラウザ向け：少し待って打ち切る（聞き取った文は残る）
    setTimeout(() => {
      if (micSession === s) stopMic();
    }, 2500);
  }
  // 画面を移るとき：すぐ打ち切る
  function stopMic() {
    if (micSession) clearTimeout(micSession.timer);
    micSession = null;
    if (rec) {
      try {
        rec.onresult = null;
        rec.onerror = null;
        rec.onend = null;
        rec.abort();
      } catch {}
    }
    rec = null;
    if (T.listening) {
      T.listening = false;
      refreshVoice();
    }
  }
  function refreshVoice() {
    const box = $("#voice");
    if (box) box.innerHTML = voiceHtml();
  }

  // ---------- 入力 ----------
  function currentCard() {
    return flowCards()[S.cursor];
  }
  function onAnswerInput(value) {
    const c = currentCard();
    if (!c) return;
    const a = answerOf(c.id);
    S.answers[c.id] = { chips: a.chips || [], text: value };
    const btn = $("#nextBtn");
    if (btn) btn.setAttribute("aria-disabled", String(c.required && !hasText(c.id)));
    saveSoon();
  }
  let saveTimer = null;
  function saveSoon() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 400);
  }

  function fillDemo() {
    const demoSet = setById("basic3") || recommendedSet(3) || recommendedSet(S.size);
    S.kind = "post"; // 例文は投稿文用
    S.size = demoSet ? demoSet.size : S.size;
    S.setId = demoSet ? demoSet.id : null;
    S.selected = demoSet ? setCards(demoSet.id) : [C.requiredCardId];
    S.answers = {
      learn: { chips: ["パネルの話で"], text: "発信は完璧じゃなくていい。まず出すことが、つながりの入口になると気づいた" },
      thanks: { chips: [], text: "隣の席の方と、プロフ帳の「続けていること」で盛り上がった。ありがとうございました" },
      next: { chips: ["週1で投稿する"], text: "今日つながった人の投稿に、まずコメントしてみる" },
    };
    S.style = { ...defaultStyle(), role: "会社員" };
    S.cursor = 0;
    go("style");
  }

  // ---------- トースト ----------
  let toastTimer = null;
  function toast(msg, ms = 1500) {
    toastEl.innerHTML = `<div class="toast-cloud cloud" data-bump="22" data-seed="${1 + Math.floor(Math.random() * 40)}"><span>${esc(msg)}</span></div>`;
    toastEl.classList.add("is-on");
    paintClouds(toastEl);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("is-on"), ms);
  }

  // ---------- 雲フキダシ（要素の大きさに合わせて描き直す） ----------
  function rng(seed) {
    let a = seed >>> 0 || 1;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function cloudPath(w, h, bump, seed) {
    const rand = rng(seed * 9973 + Math.round(w) * 7 + Math.round(h));
    const m = Math.round(bump * 0.34) + 3;
    const x0 = m, y0 = m, x1 = w - m, y1 = h - m;
    const pts = [];
    const edge = (ax, ay, bx, by) => {
      const L = Math.hypot(bx - ax, by - ay);
      const n = Math.max(1, Math.ceil(L / bump));
      for (let i = 0; i < n; i++) {
        let t = i / n;
        if (i > 0) t += ((rand() - 0.5) * 0.35) / n;
        pts.push([ax + (bx - ax) * t, ay + (by - ay) * t]);
      }
    };
    edge(x0, y0, x1, y0);
    edge(x1, y0, x1, y1);
    edge(x1, y1, x0, y1);
    edge(x0, y1, x0, y0);
    let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < pts.length; i++) {
      const [ax, ay] = pts[i];
      const [bx, by] = pts[(i + 1) % pts.length];
      const c = Math.hypot(bx - ax, by - ay);
      const r = Math.max(c * 0.52, c * 0.6 * (0.94 + rand() * 0.2));
      d += ` A${r.toFixed(1)},${r.toFixed(1)} 0 0 1 ${bx.toFixed(1)},${by.toFixed(1)}`;
    }
    return d + "Z";
  }
  const cloudObserver = "ResizeObserver" in window ? new ResizeObserver((es) => es.forEach((e) => drawCloud(e.target))) : null;
  function drawCloud(el) {
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    if (!w || !h) return;
    let svg = el.querySelector(":scope > svg.cloud-svg");
    if (!svg) {
      svg = document.createElementNS(NS, "svg");
      svg.setAttribute("class", "cloud-svg");
      svg.setAttribute("aria-hidden", "true");
      svg.setAttribute("focusable", "false");
      svg.appendChild(document.createElementNS(NS, "path"));
      el.prepend(svg);
    }
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    svg.firstChild.setAttribute("d", cloudPath(w, h, Number(el.dataset.bump) || 32, Number(el.dataset.seed) || 1));
  }
  function paintClouds(root) {
    $$(".cloud", root).forEach((el) => {
      drawCloud(el);
      if (cloudObserver) cloudObserver.observe(el);
    });
  }

  // ---------- 操作 ----------
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-act]");
    if (!el) return;
    const act = el.dataset.act;
    const disabled = el.getAttribute("aria-disabled") === "true";

    switch (act) {
      case "jump": {
        const i = Number(el.dataset.i);
        const step = ["pick", "answer", "style", !isProfile() && S.done ? "done" : "result"][i];
        if (step === "answer") S.cursor = 0;
        go(step);
        break;
      }
      case "size": {
        const n = Number(el.dataset.n);
        if (!S.free && n === S.size) break;
        S.free = false;
        const theme = (setById(S.setId) || {}).theme;
        const next = setForSize(n, theme);
        S.size = n;
        S.setId = next ? next.id : null;
        S.selected = next ? setCards(next.id) : [C.requiredCardId];
        keepScroll(render);
        save();
        break;
      }
      case "sizeFree":
        if (S.free) break;
        S.free = true;
        S.setId = null;
        S.answers = {};
        S.cursor = 0;
        T.swapOpen = true;
        keepScroll(render);
        save();
        toast("いくつでも選んでな（15まで）。押した分だけ質問になるで", 3000);
        break;
      case "voice":
        openSheet(voiceSheetHtml(), "[data-act=closeSheet]");
        break;
      case "voiceLearn": {
        if (T.voiceBusy) break;
        if (!aiReady() && MODE !== "preview") {
          openSheet(keyHtml(), "#apiKeyInput");
          toast("先に、文章を作るAIを紐づけてな。そのあとにも一回、学習やで", 3200);
          break;
        }
        if (!T.voiceRaw || T.voiceRaw.length < 200) {
          toast("過去の投稿が少なすぎる。もう1〜2件、足してな", 2800);
          break;
        }
        T.voiceBusy = true;
        toast("AIが「くせ」を分析してるで。10秒くらい待ってな", 3600);
        postJSON("api/style", { sample: T.voiceRaw }, 60000)
          .then((data) => {
            VOICE = { text: data.profile, on: true };
            saveVoice();
            T.voiceRaw = "";
            T.voiceCount = 0;
            T.voiceName = "";
            toast("おぼえたで！これからじぶんの書き方で作るで", 3200);
          })
          .catch((e) => toast(e.message || "学べへんかった", 3200))
          .finally(() => {
            T.voiceBusy = false;
            openSheet(voiceSheetHtml(), "[data-act=voiceToggle]");
          });
        break;
      }
      case "voicePasteLearn": {
        const ta = $("#voicePaste", sheet);
        const posts = extractPosts(String((ta && ta.value) || ""));
        if (!posts.length) {
          toast("投稿文が見つからへん。自分の投稿を、そのまま貼り付けてな", 3000);
          break;
        }
        T.voiceRaw = posts.slice(0, 40).join("\n----\n").slice(0, 15000);
        T.voiceCount = posts.length;
        T.voiceName = "貼り付けた投稿";
        openSheet(voiceSheetHtml(), "[data-act=voiceLearn]");
        toast(`${posts.length}件の投稿を見つけたで。下のボタンで学習や`, 2600);
        break;
      }
      case "voiceToggle":
        VOICE.on = !VOICE.on;
        saveVoice();
        openSheet(voiceSheetHtml(), "[data-act=voiceToggle]");
        toast(VOICE.on ? "じぶんの書き方で作るで" : "ふつうの作り方にもどしたで", 2000);
        break;
      case "voiceErase":
        VOICE = { text: "", on: false };
        saveVoice();
        T.voiceRaw = "";
        T.voiceCount = 0;
        T.voiceName = "";
        openSheet(voiceSheetHtml(), "[data-act=closeSheet]");
        toast("消したで。もう一度ファイルかコピペでおぼえ直せるで", 2600);
        break;
      case "hist":
        openSheet(histHtml(), "[data-act=closeSheet]");
        break;
      case "histCopy": {
        const h = histGet().find((x) => x.at === Number(el.dataset.at));
        const b = h && (h.bodies || []).find((x) => x.id === el.dataset.id);
        if (!b) break;
        try {
          navigator.clipboard.writeText(b.body).then(() => toast("コピーしたで", 1600));
        } catch {
          toast("コピーできへんかった。長押しして選んでコピーしてな", 2800);
        }
        break;
      }
      case "histDel":
        histDel(Number(el.dataset.at));
        openSheet(histHtml(), "[data-act=closeSheet]");
        toast("消したで", 1400);
        break;
      case "themeCustom": {
        // 押した時点で「じぶんで決める」を選んだことにする（入力はあとから）
        $$('[role=radio][data-act=theme]').forEach((b) => b.setAttribute("aria-checked", "false"));
        el.setAttribute("aria-checked", "true");
        const box = $("#customTheme");
        if (box) {
          box.scrollIntoView({ block: "center" });
          box.focus({ preventScroll: true });
        }
        break;
      }
      case "photoClear": {
        const pi = Number(el.dataset && el.dataset.i);
        if (Number.isInteger(pi) && T.photos[pi]) T.photos.splice(pi, 1);
        else T.photos = [];
        keepScroll(render);
        break;
      }
      case "theme": {
        const theme = el.dataset.v;
        S.customTheme = ""; // 「じぶんで決める」をやめて、テーマ一覧に切り替えたときは入力を空にする
        if ((setById(S.setId) || {}).theme === theme) break;
        const same = setsOf(S.size).find((s) => s.theme === theme);
        const all = C.sets.find((s) => s.theme === theme);
        const next = same || all; // そのボリュームに無いテーマは、用意してある問数に切り替える
        if (next) {
          S.size = next.size;
          S.setId = next.id;
          S.selected = setCards(next.id);
          S.answers = {};
          S.cursor = 0;
          keepScroll(render);
          save();
          toast(`「${plain(next.label)}」の質問に切り替えたで。${next.size}問、答えてくだけでええで`, 2600);
        }
        break;
      }
      case "set":
        S.setId = el.dataset.id;
        S.selected = setCards(el.dataset.id);
        S.answers = {};
        S.cursor = 0;
        keepScroll(render);
        save();
        toast(`「${plain((setById(S.setId) || {}).label || "")}」の質問に切り替えたで`, 2000);
        break;
      case "card": {
        const id = el.dataset.id;
        if (CARD[id].required) {
          toast(`「${plain(CARD[id].label)}」は必須やで`);
          break;
        }
        if (S.selected.includes(id)) {
          S.selected = S.selected.filter((x) => x !== id);
        } else if (S.free && S.selected.length >= 15) {
          toast("15問までやで", 2000);
          break;
        } else if (!S.free && S.selected.length >= S.size) {
          toast(`${S.size}問までやで。先にどれか外してな`, 2000);
          break;
        } else addCard(id);
        if (S.free) S.size = Math.max(1, S.selected.length);
        S.setId = S.free ? null : matchSet();
        T.swapOpen = true;
        keepScroll(render);
        save();
        break;
      }
      case "demo":
        fillDemo();
        break;
      case "toAnswer": {
        if (needName()) break;
        if (isProfile() && !S.pcond.role) {
          const b = $("[data-k=role]");
          if (b) b.closest(".field").scrollIntoView({ block: "center" });
          toast("まず「あなたの立場」を選んでな", 2200);
          break;
        }
        // 「じぶんで決める」のときは、テーマを書くのが必須
        const customRow = $('[data-act=themeCustom]');
        if (!isProfile() && customRow && customRow.getAttribute("aria-checked") === "true" && !String(S.customTheme || "").trim()) {
          const box = $("#customTheme");
          if (box) {
            box.scrollIntoView({ block: "center" });
            box.focus({ preventScroll: true });
          }
          toast("「じぶんで決める」のときは、テーマを書いてな。何について書きたいかやで", 3200);
          break;
        }
        S.quick = false;
        S.cursor = 0;
        go("answer");
        break;
      }
      case "help":
        openSheet(helpHtml(), "[data-act=closeSheet]");
        break;
      case "schedule":
        openSheet(scheduleHtml(), "[data-act=closeSheet]");
        break;
      case "openKey":
        openSheet(keyHtml(), eventNeedsPass() && !MYKEY ? "#evPass" : "#apiKeyInput");
        break;
      case "cal":
        T.calEvents = [];
        T.calDone = false;
        T.calBusy = false;
        T.calRange = "today";
        openSheet(calSheetHtml(), "#calUrl");
        break;
      case "saveCal": {
        const box = $("#calUrl", sheet);
        saveCalUrl(box ? box.value : "");
        T.calEvents = [];
        T.calDone = false;
        openSheet(calSheetHtml(), "#calUrl");
        toast(CALURL ? "つないだで！予定から投稿が作れるで" : "URLが空のままやで", 2600);
        break;
      }
      case "clearCal":
        saveCalUrl("");
        T.calEvents = [];
        T.calDone = false;
        openSheet(calSheetHtml(), "#calUrl");
        toast("つながりを消したで", 1800);
        break;
      case "calFetch": {
        if (T.calBusy || MODE === "preview") {
          if (MODE === "preview") toast("プレビューでは動かへんで", 2000);
          break;
        }
        T.calBusy = true;
        T.calDone = false;
        T.calEvents = [];
        T.calRange = el.dataset.range === "week" ? "week" : "today";
        openSheet(calSheetHtml(), "[data-act=calFetch]");
        postJSON("api/cal", { url: CALURL, range: T.calRange }, 15000)
          .then((data) => {
            T.calEvents = data.events || [];
            T.calDone = true;
          })
          .catch((e) => {
            toast(e.message || "カレンダーが読めへんかった", 3200);
          })
          .finally(() => {
            T.calBusy = false;
            openSheet(calSheetHtml(), "[data-act=calFetch]");
          });
        break;
      }
      case "calPick": {
        const ev = (T.calEvents || [])[Number(el.dataset.i)];
        if (!ev) break;
        const set = recommendedSet(3) || setsOf(3)[0];
        if (set) {
          S.size = set.size;
          S.setId = set.id;
          S.selected = setCards(set.id);
        }
        S.quick = false;
        S.cursor = 0;
        const first = S.selected[0];
        if (first) S.answers[first] = { text: `今日は「${plain(ev.title)}」をやった。`, chips: [] };
        closeSheet();
        save();
        go("answer");
        break;
      }
      case "calWeekTap":
        break;
      case "calWeekGo": {
        if (needName()) break;
        const list = (T.calEvents || []).map((e) => `・${e.day.replace(/-/g, "/")} ${plain(e.title)}`).join("\n");
        if (!list) {
          toast("予定が見つからへんかった", 2200);
          break;
        }
        const p = payload();
        p.answers = [
          { id: "calweek", label: "この1週間の予定（カレンダーから）", question: "この1週間、どんなことをやった？", chips: [], text: list },
        ];
        closeSheet();
        generate(p);
        break;
      }
      case "evUnlock":
        evUnlockFlow();
        break;
      case "saveKey":
        saveKeyFlow();
        break;
      case "pasteKey":
        pasteKeyFlow();
        break;
      case "clearKey":
        saveApiKey("");
        openSheet(keyHtml(), "#apiKeyInput");
        toast("キーを消したで", 1800);
        break;

      case "bigText": {
        setBig(!isBig());
        const inHelp = !sheet.hidden && $(".help-staff", sheet);
        keepScroll(render);
        if (inHelp) openSheet(helpHtml(), "[data-act=bigText]");
        toast(isBig() ? "文字を大きくしたで" : "元の大きさにもどしたで", 1400);
        break;
      }
      case "chip": {
        const c = currentCard();
        const a = answerOf(c.id);
        const v = el.dataset.v;
        const chips = (a.chips || []).includes(v) ? a.chips.filter((x) => x !== v) : [...(a.chips || []), v];
        S.answers[c.id] = { text: a.text || "", chips };
        el.setAttribute("aria-pressed", String(chips.includes(v)));
        saveSoon();
        break;
      }
      case "mic":
        if (MODE === "preview") {
          toast("プレビューではマイクは動かへんで。本番のURLなら使えるで", 2600);
          break;
        }
        if (T.listening) finishMic();
        else startMic();
        break;
      case "micRetry":
        T.micBlocked = false;
        T.micReason = "";
        startMic();
        break;
      case "next": {
        const c = currentCard();
        if (disabled || (c.required && !hasText(c.id))) {
          toast("ひとことでOK。しゃべってもええで", 1800);
          $("#answer") && $("#answer").focus();
          break;
        }
        const list = flowCards();
        const opensSheet = S.cursor >= list.length - 1 && S.quick;
        if (!opensSheet && (hasText(c.id) || (answerOf(c.id).chips || []).length)) toast(pickOne(C.aizuchi), 900);
        if (S.cursor < list.length - 1) {
          S.cursor += 1;
          go("answer");
        } else if (isProfile()) generate();
        else if (S.quick) openModeSheet("gen");
        else go("style");
        break;
      }
      case "skip": {
        const list = flowCards();
        if (S.cursor < list.length - 1) {
          S.cursor += 1;
          go("answer");
        } else if (isProfile()) generate();
        else if (S.quick) openModeSheet("gen");
        else go("style");
        break;
      }
      case "kind": {
        const k = PARTS.includes(el.dataset.v) && profileOn() ? el.dataset.v : "post";
        if (S.kind === k) break;
        S.kind = k;
        S.cursor = 0;
        save();
        keepScroll(render);
        break;
      }
      // 見出し・自己紹介の条件
      case "cond": {
        const k = el.dataset.k;
        if (!S.pcond || !(k in S.pcond)) break;
        S.pcond[k] = k === "focus" && S.pcond[k] === el.dataset.v ? "" : el.dataset.v;
        T.condMissing = false;
        save();
        keepScroll(render);
        break;
      }
      case "condYear":
        S.pcond.year = S.pcond.year === el.dataset.v ? "" : el.dataset.v;
        save();
        keepScroll(render);
        break;
      case "condDir": {
        const v = el.dataset.v;
        const list = S.pcond.dirs || [];
        const max = ((PF.conds || {}).dirs || {}).max || 3;
        if (list.includes(v)) S.pcond.dirs = list.filter((x) => x !== v);
        else if (list.length >= max) {
          toast(`${max}つまでやで。先にどれか外してな`, 2000);
          break;
        } else S.pcond.dirs = [...list, v];
        save();
        keepScroll(render);
        break;
      }
      case "condEdit":
        go("pick");
        setTimeout(() => {
          const b = $(".cond-block");
          if (b) b.scrollIntoView({ block: "start" });
        }, 50);
        break;
      // 見出し → 自己紹介（または逆）。答えは引き継ぐ。作ってあれば、その結果を見せる
      case "toKind": {
        const k = PARTS.includes(el.dataset.v) ? el.dataset.v : "";
        if (!k || T.refining || T.busy) break;
        S.kind = k;
        T.editing = false;
        T.ask = "";
        if (S.presults[k]) {
          go("result");
          break;
        }
        const list = flowCards();
        const first = list.findIndex((c) => !(answerOf(c.id).text || "").trim() && !(answerOf(c.id).chips || []).length);
        S.cursor = first === -1 ? list.length - 1 : first;
        go("answer");
        toast(first === -1 ? "答えはそろってるで。確かめて、最後の質問で「つくる」を押してな" : "答えは引き継いだで。足りないところだけ答えてな", 2600);
        break;
      }
      case "mode": {
        S.mode = el.dataset.id || "";
        if (el.dataset.tone) S.startTone = el.dataset.tone;
        save();
        const box = !sheet.hidden && $("[data-act=modeGo]", sheet) && $(".sheet", sheet);
        if (box) {
          const y = box.scrollTop;
          box.innerHTML = modeSheetHtml();
          box.scrollTop = y;
          const f = $(`[data-act=mode][data-id="${S.mode}"]`, box);
          if (f) f.focus({ preventScroll: true });
        } else keepScroll(render);
        break;
      }
      case "modeGo":
        if (S.mode === "custom" && !(S.stylePrompt || "").trim()) {
          toast("「じぶんの書き方」は、書き方の指示を書いてな", 2600);
          const box2 = !sheet.hidden && $("#stylePrompt", sheet);
          if (box2) {
            box2.scrollIntoView({ block: "center" });
            box2.focus({ preventScroll: true });
          }
          break;
        }
        generate();
        break;
      case "followOpen":
        // リンクはそのまま別のタブで開かせる（この画面は残る）。おすすめだけのときは、開いたらもう出さない
        if (C.followRequired === false) setFollow("done");
        else if (!FOLLOW) setFollow("opened");
        setTimeout(() => keepScroll(render), 300);
        break;
      case "followCheck":
        if (!FOLLOW) {
          toast("先に「LinkedInページをひらく」を押して、フォローしてな", 2400);
          break;
        }
        setFollow(FOLLOW === "done" ? "opened" : "done");
        if (FOLLOW === "done") {
          T.followMissing = false;
          toast("ありがとう！これで始められるで", 1600);
        }
        keepScroll(render);
        $("[data-act=followCheck]") && $("[data-act=followCheck]").focus({ preventScroll: true });
        break;
      case "modeStyle":
        closeSheet();
        S.quick = false;
        go("style");
        break;
      case "modeOpen":
        if (T.refining || T.busy) break;
        openModeSheet("regen");
        break;
      case "askEx": {
        const box = $("#askText");
        T.ask = el.dataset.v || "";
        if (box) {
          box.value = T.ask;
          box.focus();
          box.setSelectionRange(T.ask.length, T.ask.length);
        }
        break;
      }
      case "prefOpen":
        openSheet(prefHtml());
        break;
      case "prefDel": {
        prefsDel(Number(el.dataset.at));
        const list = prefsGet();
        if (list.length) openSheet(prefHtml());
        else closeSheet();
        keepScroll(render);
        break;
      }
      case "prefClearAll":
        prefsClear();
        closeSheet();
        keepScroll(render);
        toast("好みの履歴を消したで", 1600);
        break;
      case "ask": {
        const v = (($("#askText") && $("#askText").value) || T.ask || "").trim();
        if (!v) {
          toast("どう直してほしいか、書いてな", 1800);
          $("#askText") && $("#askText").focus();
          break;
        }
        T.ask = v;
        refine("custom", v);
        break;
      }
      case "back":
        if (S.step === "answer") {
          if (S.cursor > 0) {
            S.cursor -= 1;
            go("answer");
          } else go("pick");
        } else if (S.step === "style") {
          S.cursor = Math.max(0, flowCards().length - 1);
          go("answer");
        } else if (S.step === "result") {
          if (isProfile()) {
            S.cursor = Math.max(0, flowCards().length - 1);
            go("answer");
          } else go("style");
        }
        break;
      case "style": {
        const k = el.dataset.k;
        const v = el.dataset.v;
        S.style[k] = k === "role" && S.style[k] === v ? "" : v;
        save();
        const y = window.scrollY;
        render();
        window.scrollTo(0, y);
        break;
      }
      case "generate":
        generate();
        break;
      case "tab":
        if (T.refining) break;
        S.tab = el.dataset.id;
        T.editing = false;
        save();
        render();
        $(`#tab-${S.tab}`) && $(`#tab-${S.tab}`).focus({ preventScroll: true });
        break;
      case "more": {
        const b = $("#liBody");
        if (b) b.classList.remove("is-clamped");
        el.hidden = true;
        break;
      }
      case "edit":
        T.editing = true;
        render();
        $("#editBody") && $("#editBody").focus();
        break;
      case "editCancel":
        T.editing = false;
        render();
        break;
      case "editAddAppend": {
        const add = ($("#editAdd") && $("#editAdd").value.trim()) || "";
        const eb = $("#editBody");
        if (!add || !eb) {
          if (!add) toast("足したいことを書いてな", 1800);
          break;
        }
        eb.value = `${eb.value.trim()}\n\n${add}`;
        $("#editAdd").value = "";
        eb.dispatchEvent(new Event("input", { bubbles: true }));
        eb.focus();
        toast("付けたしたで。編集しなおしてもOK", 2000);
        break;
      }
      case "editSave": {
        const v = ($("#editBody") && $("#editBody").value.trim()) || "";
        if (!v) {
          toast("空っぽにはできへんで");
          break;
        }
        if (isProfile()) {
          const pa = S.presults.about;
          if (pa) S.presults.about = { text: v, edited: pa.edited || v !== pa.text };
        } else {
          const prev = S.results[S.tab].body;
          S.results[S.tab] = { body: v, edited: S.results[S.tab].edited || v !== prev };
        }
        T.editing = false;
        save();
        render();
        toast("直したで");
        break;
      }
      case "refine":
        refine(el.dataset.id);
        break;
      case "pCopy": {
        const pr = S.presults[S.kind];
        if (!pr) break;
        const k = el.dataset.k || "";
        const text = k === "about" ? String(pr.text || "").trim() : (pr.list || [])[Number(k.slice(1))] || "";
        if (!text) break;
        if (copyNow(text)) {
          toast(k === "about" ? "自己紹介をコピーしたで。LinkedInの「概要（About）」に貼り付けてな" : "見出しをコピーしたで。LinkedInの「見出し」に貼り付けてな", 3200);
          recordProfile(k === "about" ? "about" : "headline", text);
        } else toast("コピーできへんかった。文字を長押しして、コピーしてな", 3000);
        break;
      }
      case "pOpen":
        // リンクはそのまま別のタブで開かせる（この画面は残る。もどってきて、もう片方をコピーできる）
        break;
      case "pRegen":
        if (T.refining || T.busy) break;
        generate();
        break;
      case "choose":
        if (disabled) break;
        openSheet(checkSheetHtml(), ".check");
        break;
      case "check": {
        const i = Number(el.dataset.i);
        S.checks[i] = !S.checks[i];
        save();
        refreshCheckSheet();
        $(`.check[data-i="${i}"]`, sheet) && $(`.check[data-i="${i}"]`, sheet).focus({ preventScroll: true });
        break;
      }
      case "toGuide":
        if (disabled) {
          toast("チェックを4つ付けてな", 1800);
          break;
        }
        closeSheet();
        go("guide");
        break;
      case "sendJudge":
        S.sendJudge = S.sendJudge === false;
        save();
        el.setAttribute("aria-checked", String(S.sendJudge));
        break;
      case "consent":
        S.consent = !S.consent;
        save();
        el.setAttribute("aria-checked", String(S.consent));
        break;
      case "copyOpen": {
        if (disabled) {
          e.preventDefault();
          toast("チェックを4つ付けてな", 1800);
          break;
        }
        // リンクはそのまま開かせる（止めない）。画面の切り替えは少しあとで
        const text = finalText(S.tab);
        copyNow(text);
        record("copy");
        if (C.report && S.sendJudge !== false && myName()) autoReport(text);
        S.done = { action: "copy", tone: S.tab, text, shared: false };
        save();
        setTimeout(() => {
          closeSheet();
          go("done");
        }, 60);
        break;
      }
      case "later": {
        const text = finalText(S.tab);
        const finish = (shared) => {
          record("later");
          S.done = { action: "later", tone: S.tab, text, shared };
          save();
          closeSheet();
          go("done");
          if (!shared) toast("コピーしたで。メモやLINEに貼っといてな", 2400);
        };
        if (MODE === "live" && navigator.share) {
          navigator
            .share({ text })
            .then(() => finish(true))
            .catch((err) => {
              if (err && err.name === "AbortError") return;
              copyNow(text);
              finish(false);
            });
        } else {
          copyNow(text);
          finish(false);
        }
        break;
      }
      case "advSave": {
        const prov = $("#advProvider", sheet) ? $("#advProvider", sheet).value : "openai";
        const base = $("#advBase", sheet);
        const model = $("#advModel", sheet);
        const key = $("#advKey", sheet);
        const b = ((base && base.value.trim()) || (prov === "anthropic" ? "https://api.anthropic.com" : "https://api.openai.com/v1")).slice(0, 200);
        const m = ((model && model.value.trim()) || "").slice(0, 80);
        const k = ((key && key.value.trim()) || "").slice(0, 200);
        if (!m || !k) {
          toast("モデル名とAPIキーは、両方とも入れてな", 2600);
          break;
        }
        AISET = { on: true, provider: prov, baseUrl: b, model: m, key: k };
        saveAISet();
        openSheet(keyHtml(), "[data-act=closeSheet]");
        toast(`${m} をつないだで。これで投稿文が作れるで`, 3000);
        break;
      }
      case "advOff":
        if (AISET) AISET.on = false;
        saveAISet();
        openSheet(keyHtml(), "[data-act=closeSheet]");
        toast("Geminiのほうにもどしたで", 2000);
        break;
      case "closeSheet":
        closeSheet();
        break;
      case "report":
        openReport("done");
        break;
      case "reportSelf":
        openReport("pick");
        break;
      case "rPaste":
        pasteUrl();
        break;
      case "rScreen":
        if (T.rep) {
          T.rep.screenOk = !T.rep.screenOk;
          el.setAttribute("aria-checked", String(T.rep.screenOk));
        }
        break;
      case "rSend":
        sendReport();
        break;
      case "recopy":
        if (S.done) {
          copyNow(S.done.text);
          toast("コピーしたで！");
        }
        break;
      case "toResult":
        go("result");
        break;
      case "restart":
        openSheet(
          `<h2 class="sheet-title" id="sheetTitle">最初からつくる？</h2>
           <p class="sheet-lead">いまの回答と投稿文は消えるで。</p>
           <div class="stack">
             <button type="button" class="btn btn-primary btn-block" data-act="restartYes">消して最初から</button>
             <button type="button" class="btn-text" data-act="closeSheet">やめとく</button>
           </div>`
        );
        break;
      case "restartYes": {
        const id = S.clientId;
        S = freshState(id);
        T.editing = false;
        closeSheet();
        go("pick");
        break;
      }
      case "resumeYes":
        closeSheet();
        render();
        break;
      case "resumeNo": {
        const id = S.clientId;
        S = freshState(id);
        save();
        closeSheet();
        render();
        break;
      }
    }
  });

  // 「ネタを自分で入れかえる」の開け閉めを覚えておく（描き直しても閉じないように）
  document.addEventListener(
    "toggle",
    (e) => {
      if (e.target.id === "swap") T.swapOpen = e.target.open;
    },
    true
  );

  document.addEventListener("input", (e) => {
    if (e.target.id === "answer") {
      onAnswerInput(e.target.value);
      autoGrow(e.target);
    }
    if (e.target.id === "phrase") {
      S.style.phrase = e.target.value;
      saveSoon();
    }
    if (e.target.id === "myName") {
      saveName(e.target.value);
      if (T.nameMissing && myName()) {
        T.nameMissing = false;
        const box = e.target.closest(".name-box");
        if (box) box.classList.remove("is-missing");
      }
    }
    if (e.target.id === "intro") {
      S.intro = e.target.value.slice(0, 60);
      saveSoon();
    }
    if (e.target.id === "stylePrompt") {
      S.stylePrompt = e.target.value.slice(0, 800);
      saveSoon();
    }
    if (e.target.id === "askText") T.ask = e.target.value;
    if (e.target.id === "customTheme") {
      S.customTheme = e.target.value.slice(0, 60);
      // チェックの付け替え（再描画せずに、その場で見た目だけ更新）
      const on = !!S.customTheme.trim();
      $$('[role=radio][data-act=theme]').forEach((b) => b.setAttribute("aria-checked", "false"));
      const row = $('[data-act=themeCustom]');
      if (row) row.setAttribute("aria-checked", String(on));
      saveSoon();
    }
    if (e.target.id === "condYear") {
      S.pcond.year = e.target.value.slice(0, 20);
      saveSoon();
    }
    if (e.target.id === "condDirOther") {
      S.pcond.dirOther = e.target.value.slice(0, 20);
      saveSoon();
    }
    if (e.target.id === "condKeywords") {
      S.pcond.keywords = e.target.value.slice(0, 80);
      saveSoon();
    }
    if (e.target.id === "photoWhat") T.photoWhat = e.target.value.slice(0, 60);
    if (e.target.id === "photoWant") T.photoWant = e.target.value.slice(0, 60);
    if (["rName", "rUrl", "rBody"].includes(e.target.id)) {
      const err = $("#rError", sheet);
      if (err && err.textContent) err.textContent = "";
    }
  });

  // 写真をえらんだら、その場でプレビュー（写真データ本体は送らない・保存しない）
  document.addEventListener("change", (e) => {
    if (e.target.id === "advProvider") {
      // AIを切り替えたら、Base URLの初期値も合わせる（自分で変えてたときは触らへん）
      const b = $("#advBase");
      if (!b) return;
      const cur = b.value.trim();
      const isAnthropic = e.target.value === "anthropic";
      if (!cur || cur === "https://api.openai.com/v1" || cur === "https://api.anthropic.com") {
        b.value = isAnthropic ? "https://api.anthropic.com" : "https://api.openai.com/v1";
      }
      return;
    }
    if (e.target.id === "voiceFile") {
      readVoiceFile(e.target.files && e.target.files[0]);
      e.target.value = "";
      return;
    }
    if (e.target.id !== "photoInput") return;
    // 形式が空で来る端末もあるので、画像でないとはっきり分かるものだけ外す（読めるかどうかは shrinkPhoto で確かめる）
    const files = Array.from((e.target.files && e.target.files) || []).filter((f) => f && (!f.type || f.type.startsWith("image/")));
    e.target.value = "";
    if (!files.length) return;
    addPhotos(files);
  });

  // じぶんの書き方：ドラッグ＆ドロップ（パソコン）
  document.addEventListener("dragover", (e) => {
    if (e.target.closest && e.target.closest("#voiceDrop")) e.preventDefault();
  });
  document.addEventListener("drop", (e) => {
    const z = e.target.closest && e.target.closest("#voiceDrop");
    if (!z) return;
    e.preventDefault();
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) readVoiceFile(f);
  });

  // キーボードでのタブ切り替え（左右キー）
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !sheet.hidden) closeSheet();
    if (e.key === "Enter" && !e.isComposing && e.target.id === "askText") {
      e.preventDefault();
      const b = $("[data-act=ask]");
      if (b && !b.disabled) b.click();
      return;
    }
    if (e.key === "Enter" && !e.isComposing && e.target.id === "evPass") {
      e.preventDefault();
      evUnlockFlow();
      return;
    }
    if (e.key === "Enter" && !e.isComposing && e.target.id === "myName") {
      e.preventDefault();
      e.target.blur();
      return;
    }
    const tab = e.target.closest && e.target.closest('[role="tab"]');
    if (!tab || (e.key !== "ArrowRight" && e.key !== "ArrowLeft")) return;
    const i = TONES.findIndex((t) => t.id === S.tab);
    const n = (i + (e.key === "ArrowRight" ? 1 : -1) + TONES.length) % TONES.length;
    S.tab = TONES[n].id;
    render();
    $(`#tab-${S.tab}`).focus();
  });

  sheet.addEventListener("click", (e) => {
    if (e.target === sheet) closeSheet();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopMic();
  });
  toastEl.addEventListener("click", () => toastEl.classList.remove("is-on"));

  // ---------- はじまり ----------
  const saved = store.get();
  const params = new URLSearchParams(location.search);
  if (saved) S = restore(saved);
  // 前回、作っている途中で画面が閉じていたら（端末のメモリ不足で落ちた・再読み込みされた など）、記録してひとこと出す
  const wasPending = takePending();
  if (wasPending) {
    clientLog("reload", { code: "closed_while_generating" }, { photos: wasPending.photos || 0, kb: wasPending.kb, message: `作っている途中で画面が閉じた・再読み込みされた（写真${wasPending.photos || 0}枚）` });
    setTimeout(() => toast(wasPending.photos ? "さっきは作ってる途中で画面が閉じてしもたみたい。写真を減らして、もう一回押してみて" : "さっきは作ってる途中で画面が閉じてしもたみたい。もう一回押してみて", 5000), 600);
  }
  // イベント（?e=）は、名前とハッシュタグを読んでから最初の画面を出す（遅いときは2.5秒で先に出して、あとで描き直す）
  // 利用状況（運営ページの「どれくらい使われてるか」）：開いた回数だけ数える。中身は送らない。同じタブでは1回だけ
  function sendHit() {
    if (MODE === "preview") return;
    try {
      const k = `tsukuttaroka.hit${PAGE_NS}`;
      if (sessionStorage.getItem(k)) return;
      sessionStorage.setItem(k, "1");
    } catch {}
    try {
      fetch("api/hit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ clientId: S.clientId, page: PAGE ? PAGE.id : "", preset: C.presetId || "", event: EVID || "" }), keepalive: true }).catch(() => {});
    } catch {}
  }
  async function start() {
    const evLoad = loadEvent();
    if (EVID) await Promise.race([evLoad, new Promise((r) => setTimeout(r, 2500))]);
    let shown = false;
    if (MODE === "live" && params.get("demo") === "1") {
      fillDemo();
    } else if (saved && hasProgress(saved)) {
      render();
      openSheet(
        `<h2 class="sheet-title" id="sheetTitle">前回のつづきがあるで</h2>
         <p class="sheet-lead">つづきから再開する？</p>
         <div class="stack">
           <button type="button" class="btn btn-primary btn-block" data-act="resumeYes">つづきから</button>
           <button type="button" class="btn btn-secondary btn-block" data-act="resumeNo">最初から</button>
         </div>`
      );
    } else {
      // 回答前なら、選んだ問数とセットだけ引き継いで最初の画面から
      if (!saved) S = freshState(S.clientId);
      S.step = "pick";
      render();
    }
    shown = true;
    sendHit();
    evLoad.then(() => {
      if (shown && S.step === "pick") keepScroll(render);
    });
  }
  start();
  document.fonts && document.fonts.ready.then(() => paintClouds(document));
})();
