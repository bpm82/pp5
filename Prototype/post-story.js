// Later story scenes share the opening's phone and face-to-face presentation.
// Progress is saved per conversation; replaying a letter never advances a call.
let activePostSequence = null;
let activePostIncoming = null;
let postSignalTimer = null;
// Fill in the completed Cluster world's verified share URL when it is ready.
const CLUSTER_WORLD_URL = "";
let modalReturnFocus = null;
let modalPreviousOverflow = "";
const POST_IDS = ["map-intro", "map-report", "map-recheck", "letters-report", "recovery-brief", "report-b", "report-g", "final", "ending"];

function setPostMode(mode) {
  document.body.classList.remove("is-opening", "is-novel", "is-terminal", "is-post-menu", "is-resolution");
  document.body.classList.add(mode === "call" ? "is-terminal" : mode === "face" ? "is-novel" : "is-post-menu");
  if (mode === "resolution") document.body.classList.add("is-resolution");
}

function renderCallDialogue(speaker, line, controls, contact = "探偵", later = false) {
  terminalFrame(`<div class="first-call-stage${speaker === "あなた" ? " is-player" : ""}${contact === "怪盗" ? " is-thief-call" : ""}"><div class="first-call-status"><i aria-hidden="true"></i><span>${contact === "怪盗" ? "怪盗からの割り込み通信" : "探偵と通話中"}</span></div>${later ? `<nav class="post-call-tools" aria-label="通話メニュー">${button("通信履歴", "show-first-history", "post-tool")}${button("バッグ", "show-bag", "post-tool")}</nav>` : ""}<div class="first-call-band"></div><img class="first-call-detective" src="${portrait[contact]}" alt="通信中の${contact}"><div class="first-call-frost" aria-hidden="true"></div><div class="first-call-dialogue"><span class="speaker">${safe(speaker)}</span><p class="dialogue">${safe(line)}</p><div class="first-call-controls">${controls}</div></div></div>`, `${contact}との通話`);
}

function readPostHistory() {
  try { const value = JSON.parse(get(K + "post-history") || "[]"); return Array.isArray(value) ? value.filter(row => row && typeof row.id === "string" && typeof row.line === "string" && typeof row.speaker === "string") : []; } catch { return []; }
}

function recordPostLine(id, speaker, line) {
  const history = readPostHistory();
  if (!history.some(row => row.id === id)) { history.push({ id, speaker, line }); put(K + "post-history", JSON.stringify(history)); }
}

function postSequence(id, lines, finish, lastLabel = "通話を終える", heading = "") {
  const saved = Number(get(K + `post-${id}`) || 0);
  const index = Math.min(Math.max(Number.isFinite(saved) ? saved : 0, 0), lines.length - 1);
  const [speaker, line, mode = "call", label] = lines[index];
  activePostSequence = { id, index, lines, finish };
  setPostMode(mode);
  const nextLabel = label || (index === lines.length - 1 ? lastLabel : "次へ");
  if (mode === "call") {
    const updated = ["report-b", "report-g", "final"].includes(id);
    recordPostLine(`${updated ? "v2-" : ""}${id}-${index}`, speaker, line);
    renderCallDialogue(speaker, line, button(nextLabel, "post-next"), speaker === "怪盗" ? "怪盗" : "探偵", true);
    if (heading) scene.querySelector(".first-call-status span").textContent = heading;
    if (id === "final" && speaker !== "怪盗") scene.querySelector(".first-call-status span").textContent = "探偵との通話に戻る · 合流の連絡";
    if (speaker === "怪盗") {
      const image = scene.querySelector(".first-call-detective");
      image.src = "../Assets/characters/phantom-thief-silhouette-left-3x4.png";
      image.alt = "通信中の怪盗のシルエット";
      image.classList.add("post-thief-silhouette");
    }
  } else if (mode === "restoration" || mode === "published") {
    renderPostResolution(mode, line, button(nextLabel, "post-next"));
  } else {
    // Reuse the opening's face-to-face scene, with the current speaker's art.
    renderDialogue([speaker === "ナレーション" ? "あなた" : speaker, line], "post-next", nextLabel, speaker !== "ナレーション");
    scene.querySelector(".story-eyebrow").textContent = id === "ending" ? "CASE CLOSED / 事件解決" : "D館の看板の前 / 最後の勝負";
    scene.querySelector(".speaker").textContent = speaker === "ナレーション" ? "" : speaker;
    const image = scene.querySelector(".story-portrait img");
    if (image && speaker === "怪盗") { image.src = portrait["怪盗"]; image.alt = "怪盗"; }
  }
}

function postMenu(title, subtitle, content) {
  setPostMode("menu"); activePostSequence = null;
  scene.innerHTML = `<section class="post-menu"><p class="eyebrow">INVESTIGATION TERMINAL</p><h1>${title}</h1><p class="lead">${subtitle}</p>${content}<nav class="post-menu-nav" aria-label="通信端末のメニュー">${button("通信履歴", "show-first-history", "secondary")}${button("調査バッグ", "show-bag", "secondary")}<a class="secondary" href="./d-building-map.html">D館の記録を見る</a></nav></section>`;
}

function renderPostStory() {
  cancelPostSignal();
  migratePostStory();
  activePostSequence = null;
  activePostIncoming = null;
  if (yes("d-final-sorting-success")) {
    if (!yes(K + "post-ending-done")) return postSequence("ending", endingStoryLines(), () => mark(K + "post-ending-done"), "クリア画面へ");
    return renderRestoredHome();
  }
  if (!yes("d-building-investigation-complete")) return postSequence("map-intro", [
    ["探偵", "バーチャルD館の記録と、実際のD館を見比べてくれ。"],
    ["探偵", "五つ全部を確認して、盗まれているかどうかを報告してほしい。"]
  ], () => { location.href = "./d-building-map.html"; }, "通話を終えてD館を調べる");
  if (!yes(K + "map-reported")) {
    if (get(K + "post-rechecking") === "true") return postSequence("map-recheck", [["探偵", "分かった。もう一度、D館の記録を確認してくれ。"]], () => { put(K + "post-rechecking", "false"); location.href = "./d-building-map.html"; }, "通話を終えて記録へ戻る");
    setPostMode("call");
    recordPostLine("map-report-0", "探偵", "D館の五つは、全部確認できたか？");
    return renderCallDialogue("探偵", "D館の五つは、全部確認できたか？", button("はい、全部確認しました", "report-map") + button("まだ確認する", "post-recheck", "secondary"), "探偵", true);
  }
  if (!yes(K + "post-letters-report-done") && !yes(K + "post-letters-continue") && !yes("b-center-ar-success") && !yes("g-object-ar-success")) return postSequence("letters-report", [
    ["あなた", "盗まれていたのは二つです。それと、怪盗の手紙が二通残されていました。"],
    ["探偵", "そうか。まずは手紙の内容を確認しよう。"]
  ], () => mark(K + "post-letters-report-done"), "通話を終えて手紙を読む");
  if (!(yes(K + "read-w") && yes(K + "read-g")) || (!yes(K + "post-letters-continue") && !yes("b-center-ar-success") && !yes("g-object-ar-success"))) {
    const letters = [["w", "W 至円"], ["g", "響在-高見観音"]].map(([id, name]) => `<button class="letter-envelope" type="button" data-action="letter-${id}"><span class="envelope-art" aria-hidden="true">◆</span><span><strong>${name}</strong><small>怪盗からの手紙</small></span><span class="letter-read-state">${yes(K + `read-${id}`) ? "既読" : "未読"}</span></button>`).join("");
    return postMenu("二通の手紙", "一通ずつ開いて、怪盗の残した言葉を確かめよう。", `<div class="letter-list">${letters}</div>${yes(K + "read-w") && yes(K + "read-g") ? `<div class="actions">${button("探偵に連絡する", "show-recover")}</div>` : ""}`);
  }
  const report = nextReport();
  if (report) {
    const first = !(yes(K + "reported-b") || yes(K + "reported-g"));
    if (!yes(K + `post-report-${report}-answered`)) return renderRecoveryIncoming(report, first);
    return postSequence(`report-${report}`, recoveryReportLines(report, first), () => mark(K + `reported-${report}`), first ? "通話を終えて次の場所へ" : "次へ", first ? "探偵と通話中 · 一件目（2/4）" : "探偵と通話中 · 二件目（4/4）");
  }
  if (yes("b-center-ar-success") && yes("g-object-ar-success")) {
    if (!yes(K + "post-final-interruption-shown")) return renderPostInterruption();
    return postSequence("final", finalStoryLines(), () => { location.href = "./d-final-sorting/index.html"; }, "最後の勝負『盗品を見抜け』へ");
  }
  if (!yes(K + "post-recovery-brief-done") && !yes("b-center-ar-success") && !yes("g-object-ar-success")) return postSequence("recovery-brief", [["探偵", "二通の手紙が示す場所へ向かってくれ。どちらからでも構わない。"]], () => mark(K + "post-recovery-brief-done"), "通話を終えて行き先を選ぶ");
  const recovered = Number(yes("b-center-ar-success")) + Number(yes("g-object-ar-success"));
  const missions = [["b", "w", "W 至円", "B館の看板 / 流れる文字", "w-ring"], ["g", "g", "響在-高見観音", "G館近くの彫刻 / 隠れた文字", "stone-art"]].map(([id, letter, name, hint, icon]) => {
    const done = yes(id === "b" ? "b-center-ar-success" : "g-object-ar-success");
    return `<div class="card mission"><img src="../Assets/icons/${icon}-icon.png" alt=""><div><h3>${name}</h3><p>${hint}</p>${done ? '<span class="badge">回収済み</span>' : ""}</div><div class="actions">${done ? button("手紙を読み返す", `letter-${letter}`, "secondary") : button(`${id.toUpperCase()}館のゲームへ`, `go-${id}`)}</div></div>`;
  }).join("");
  postMenu(recovered ? "残りの手紙を追え" : "二つの手がかりを追え", `あなたの回収 ${recovered}/2 · 全体 ${recovered * 2}/4`, `<div class="grid two">${missions}</div><p class="small post-help">現地で読み取れない場合は、各ゲームの「読み取りをスキップ」から進めます。</p>`);
}

function handlePostAction(action) {
  if ((action === "post-answer-call" || action === "post-decline-call") && activePostIncoming) {
    mark(K + `post-report-${activePostIncoming}-${action === "post-answer-call" ? "answered" : "missed"}`);
    render(); return true;
  }
  if (action === "post-restart") { document.getElementById("resetButton").click(); return true; }
  if (action === "post-next" && activePostSequence) {
    const { id, index, lines, finish } = activePostSequence;
    if (index + 1 < lines.length) put(K + `post-${id}`, String(index + 1)); else finish();
    render(); return true;
  }
  if (action === "post-recheck") { mark(K + "post-rechecking"); render(); return true; }
  if (action === "show-recover") { mark(K + "post-letters-continue"); render(); return true; }
  if (action === "letter-back-bag") { showBag(); return true; }
  return false;
}

function openStoryModal(view, label) {
  cancelPostSignal();
  if (modal.hidden) { modalReturnFocus = document.activeElement; modalPreviousOverflow = document.body.style.overflow; }
  modal.dataset.view = view; modal.setAttribute("aria-label", label); modal.hidden = false;
  document.querySelector(".shell").inert = true; document.body.style.overflow = "hidden";
  modalPanel.scrollTop = 0; modalPanel.querySelector("button")?.focus();
}

function closeStoryModal() {
  modal.hidden = true; delete modal.dataset.view; document.querySelector(".shell").inert = false;
  document.body.style.overflow = modalPreviousOverflow;
  const action = modalReturnFocus?.dataset.action;
  render();
  const returnButton = [...scene.querySelectorAll("button"), bagButton].find(item => item.dataset.action === action && item.getClientRects().length);
  (returnButton || scene.querySelector("button"))?.focus();
}

document.addEventListener("keydown", event => {
  const dialog = document.getElementById("modal");
  if (!dialog || dialog.hidden) return;
  if (event.key === "Escape") { event.preventDefault(); closeStoryModal(); }
  if (event.key === "Tab") {
    const buttons = [...dialog.querySelectorAll("button,a")].filter(item => item.getClientRects().length);
    const first = buttons[0], last = buttons.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
});

function resetPostStory() {
  cancelPostSignal();
  document.body.classList.remove("is-post-menu", "is-resolution");
  const suffixes = [...POST_IDS.map(id => `post-${id}`), "post-history", "post-rechecking", "post-letters-report-done", "post-letters-continue", "post-recovery-brief-done", "post-ending-done", "post-final-interruption-shown", "post-story-version", ...["b", "g"].flatMap(report => [`post-report-${report}-answered`, `post-report-${report}-missed`])];
  suffixes.forEach(suffix => { try { localStorage.removeItem(K + suffix); } catch {} });
}
function recoveryReportLines(report, first) {
  const other = report === "b" ? "J館" : "E館";
  const name = report === "b" ? "W 至円" : "響在-高見観音";
  return first ? [
    ["探偵", "俺の方は、" + other + "に隠されていたデータを一つ取り戻せた。"],
    ["探偵", "そっちはどうだ？"],
    ["あなた", "" + name + "の復元コードを見つけました。"],
    ["探偵", "よし。俺が一つ、君が一つ。これで四つのうち二つを取り戻せた。"],
    ["あなた", "残りは、お互い一つずつですね。"],
    ["探偵", "ああ。君はもう一通の手紙が示す場所へ向かってくれ。"],
    ["探偵", "俺も残りの一つを探す。取り戻せたら、また連絡しよう。"]
  ] : [
    ["探偵", "俺の方は、" + other + "に隠されていたデータも取り戻せた。これで俺の担当は二つともそろった。"],
    ["探偵", "そっちの残り一つは、どうだ？"],
    ["あなた", "" + name + "の復元コードも見つけました。"],
    ["あなた", "これで、こちらも二つともそろいました。"],
    ["探偵", "よし。君が二つ、俺が二つ。盗まれた四つのデータが全部そろったな。"],
    ["あなた", "全部取り戻せたんですね。"],
    ["探偵", "ああ。助かったよ。"]
  ];
}

function finalStoryLines() {
  return [
    ["怪盗", "四つとも取り戻したか。……やるじゃないか。"],
    ["怪盗", "でも、これで終わりだと思わないことだね。"],
    ["怪盗", "D館の看板の前で待っている。最後の勝負だ。", "call", "探偵との通話に戻る"],
    ["探偵", "……聞こえたか？"],
    ["あなた", "今のが怪盗ですか？"],
    ["探偵", "ああ。今度は自分から姿を見せる気らしい。"],
    ["あなた", "データは全部取り戻したのに、まだ勝負をするんですか？"],
    ["探偵", "取り戻しただけで、あいつを逃がすわけにはいかない。また盗まれたら同じだ。"],
    ["探偵", "警察にも場所を知らせておく。D館の看板の前で合流しよう。", "call", "通話を終えてD館へ"],
    ["ナレーション", "D館の看板の前へ向かおう。探偵が合流を待っている。", "face", "D館の看板の前に到着した"],
    ["探偵", "来たな。一緒に行こう。", "face"],
    ["怪盗", "来たか、探偵。隣にいるのは、君の助手かな？", "face"],
    ["怪盗", "今回のゲームは、さすがの君も一人じゃ難しかったみたいだね。", "face"],
    ["探偵", "手分けして、盗まれたデータを取り戻しただけだ。", "face"],
    ["探偵", "お前の相手は俺だ。今度はお前を逃がさない。", "face"],
    ["怪盗", "じゃあ、僕と勝負しよう。今度こそ、君には解けないゲームを用意した。", "face"],
    ["探偵", "前もそう言っていたな。", "face"],
    ["怪盗", "今度は違う。必ず君に勝ってみせる。", "face"],
    ["探偵", "いいだろう。俺が相手をする。", "face"],
    ["怪盗", "そうこなくちゃ。わざわざデータを盗んだ甲斐があったよ。", "face"],
    ["探偵", "……俺を勝負に引き込むために、バーチャルD館のデータを盗んだのか。", "face"],
    ["怪盗", "何も懸かっていなければ、君は僕の勝負に付き合ってくれないだろう？", "face"],
    ["探偵", "俺との勝負に、学園祭の展示を巻き込むな。", "face"],
    ["怪盗", "その文句は、僕に勝ってから聞こうか。", "face"],
    ["探偵", "なら、最後の勝負の内容を言え。", "face"],
    ["怪盗", "D館の五つのオブジェを、次々に出そう。盗まれていたものと無事だったものを、見分けてもらう。", "face"],
    ["怪盗", "ちゃんと調べてきたなら、簡単だろう？", "face"],
    ["探偵", "……D館の五つか。", "face"],
    ["あなた", "あの五つなら、見分けられます。どれが盗まれていたかも、覚えています。", "face"],
    ["探偵", "俺が相手をするつもりだったが……D館を調べたのは君だ。", "face"],
    ["探偵", "何が盗まれていたかは聞いた。だが、形を見てすぐに分かるのは、実際に調べた君の方だ。", "face"],
    ["あなた", "任せてください。", "face"],
    ["探偵", "……分かった。この勝負は君に任せる。俺は逃げ道を押さえる。", "face"],
    ["怪盗", "ちょっと待って。僕が勝ちたいのは、君なんだけど？", "face"],
    ["探偵", "俺の助手にも勝てないなら、俺に勝ったとは言えないな。", "face"],
    ["怪盗", "……言ったね。なら、二人まとめて負かしてあげるよ。", "face"],
    ["探偵", "頼む。ここで終わらせよう。", "face"],
    ["あなた", "はい。", "face"],
    ["怪盗", "さあ、ゲームスタートだ。", "face"]
  ];
}

function endingStoryLines() {
  return [
    ["怪盗", "……僕の負けだ。今回は君たちの勝ちだ。", "face"],
    ["ナレーション", "探偵が知らせていた場所へ警察が到着し、怪盗を確保した。", "face"],
    ["怪盗", "いつかは必ず逃げて、もっと難しいゲームでまた挑戦してやる。", "face"],
    ["ナレーション", "怪盗が連れていかれた。", "face"],
    ["探偵", "君がいてくれて助かったよ。", "face"],
    ["システム", "盗まれた四つのデータが、元の場所に戻っています。", "restoration", "探偵と確認する"],
    ["探偵", "四つとも、元の場所に戻っている。これでバーチャルD館を公開できる。", "face", "公開を再開する"],
    ["システム", "エラーは解消されました。四つのデータがそろったバーチャルD館を、再び公開できます。", "published", "探偵との会話を続ける"],
    ["探偵", "君が取り戻してくれたD館だ。よかったら、今度は中を歩いてみてくれ。", "face"],
    ["探偵", "捜査はこれで終わりだ。あとは学園祭を楽しんでくれ。", "face"],
    ["探偵", "METのブースでは、VR射的とVR金魚すくいもやっている。よかったら、そっちにも寄っていってくれ。", "face"],
    ["探偵", "今日はありがとう。", "face"]
  ];
}

function cancelPostSignal() {
  if (postSignalTimer !== null) clearTimeout(postSignalTimer);
  postSignalTimer = null;
}

function migratePostStory() {
  if (get(K + "post-story-version") === "2") return;
  // Keep completed games and reports. Resume an older in-progress scene at its new equivalent.
  for (const report of ["b", "g"]) {
    if (get(K + `post-report-${report}`) !== null) {
      mark(K + `post-report-${report}-answered`);
      put(K + `post-report-${report}`, "0");
    }
  }
  for (const [id, positions] of [
    ["final", [0, 3, 9, 10, 11, 38]],
    ["ending", [0, 1, 2, 4, 5]]
  ]) {
    const previous = get(K + `post-${id}`);
    if (previous === null) continue;
    const value = Number(previous);
    const index = Math.min(Math.max(Number.isFinite(value) ? Math.trunc(value) : 0, 0), positions.length - 1);
    put(K + `post-${id}`, String(positions[index]));
    if (id === "final" && index > 0) mark(K + "post-final-interruption-shown");
  }
  put(K + "post-story-version", "2");
}

function renderRecoveryIncoming(report, first) {
  setPostMode("call");
  activePostIncoming = report;
  renderFirstIncoming(yes(K + `post-report-${report}-missed`));
  scene.querySelector(".first-device-label").textContent = (first ? "一件目" : "二件目") + "の回収後 / 通信端末";
  const decline = scene.querySelector(".first-call-button.decline");
  if (decline) decline.dataset.action = "post-decline-call";
  scene.querySelector(".first-call-button.accept").dataset.action = "post-answer-call";
}

function renderPostInterruption() {
  setPostMode("call");
  renderCallDialogue("探偵", "ああ。助かったよ。", '<button class="primary" type="button" disabled>通信を切り替えています…</button>', "探偵", true);
  scene.querySelector(".first-call-status span").textContent = "探偵と通話中 · 二件目（4/4）";
  const effect = document.createElement("div");
  effect.className = "post-interruption";
  effect.innerHTML = "<p>通信に割り込みがありました</p>";
  scene.querySelector(".first-terminal").append(effect);
  const delay = matchMedia("(prefers-reduced-motion: reduce)").matches ? 120 : 850;
  postSignalTimer = setTimeout(() => {
    postSignalTimer = null;
    if (!modal.hidden) return;
    mark(K + "post-final-interruption-shown");
    render();
  }, delay);
}

function renderPostResolution(mode, line, controls) {
  setPostMode("resolution");
  const published = mode === "published";
  scene.innerHTML = `<section class="post-resolution"><p class="eyebrow">${published ? "RESTORED / バーチャルD館" : "復元の確認 / バーチャルD館"}</p><h1>${published ? "バーチャルD館<br>公開再開" : "復元確認 4/4"}</h1><p class="lead">${safe(line)}</p><div class="post-resolution-progress"><span>あなたの回収 2/2</span><span>${published ? "公開再開" : "全体 4/4"}</span></div><div class="actions">${controls}</div></section>`;
}

function renderRestoredHome() {
  setPostMode("resolution");
  activePostSequence = null;
  const worldLink = CLUSTER_WORLD_URL
    ? `<a class="primary" href="${safe(CLUSTER_WORLD_URL)}" target="_blank" rel="noopener">あなたが復元したD館を見る</a>`
    : '<button class="primary" type="button" disabled>あなたが復元したD館を見る</button><p class="small post-world-pending">Clusterの共有リンクは準備中です。</p>';
  scene.innerHTML = `<section class="post-resolution"><p class="eyebrow">CASE CLOSED / 公開再開</p><h1>バーチャルD館を<br>取り戻した！</h1><p class="lead">四つのデータが戻り、バーチャルD館を再び公開できました。</p><div class="post-resolution-progress"><span>あなたの回収 2/2</span><span>全体 4/4</span></div><div class="post-exhibition"><strong>METの体験ブースへ</strong><p>VR射的・VR金魚すくいも楽しめます。</p></div><div class="actions">${worldLink}</div><nav class="post-resolution-nav" aria-label="事件解決後のメニュー">${button("通信履歴", "show-first-history", "secondary")}${button("調査バッグ", "show-bag", "secondary")}<a class="secondary" href="./d-building-map.html">復元したD館のデータを見る</a>${button("最初からやり直す", "post-restart", "secondary")}</nav></section>`;
}

window.addEventListener("pagehide", cancelPostSignal);
