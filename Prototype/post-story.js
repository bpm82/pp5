// Later story scenes share the opening's phone and face-to-face presentation.
// Progress is saved per conversation; replaying a letter never advances a call.
let activePostSequence = null;
let modalReturnFocus = null;
let modalPreviousOverflow = "";
const POST_IDS = ["map-intro", "map-report", "map-recheck", "letters-report", "recovery-brief", "report-b", "report-g", "final", "ending"];

function setPostMode(mode) {
  document.body.classList.remove("is-opening", "is-novel", "is-terminal", "is-post-menu");
  document.body.classList.add(mode === "call" ? "is-terminal" : mode === "face" ? "is-novel" : "is-post-menu");
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

function postSequence(id, lines, finish, lastLabel = "通話を終える") {
  const saved = Number(get(K + `post-${id}`) || 0);
  const index = Math.min(Math.max(Number.isFinite(saved) ? saved : 0, 0), lines.length - 1);
  const [speaker, line, mode = "call", label] = lines[index];
  activePostSequence = { id, index, lines, finish };
  setPostMode(mode);
  const nextLabel = label || (index === lines.length - 1 ? lastLabel : "次へ");
  if (mode === "call") {
    recordPostLine(`${id}-${index}`, speaker, line);
    renderCallDialogue(speaker, line, button(nextLabel, "post-next"), speaker === "怪盗" ? "怪盗" : "探偵", true);
  } else {
    // Reuse the opening's face-to-face scene, with the current speaker's art.
    renderDialogue([speaker === "ナレーション" ? "あなた" : speaker, line], "post-next", nextLabel, speaker !== "ナレーション");
    scene.querySelector(".story-eyebrow").textContent = id === "ending" ? "CASE CLOSED / 事件解決" : "FINAL CASE / D館で合流";
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
  activePostSequence = null;
  if (yes("d-final-sorting-success")) {
    if (!yes(K + "post-ending-done")) return postSequence("ending", [
      ["怪盗", "今回は君たちの勝ちだ。", "face"],
      ["ナレーション", "探偵から通報を受けた警察が到着し、怪盗を確保した。", "face"],
      ["怪盗", "いつかは必ず逃げて、もっと難しいゲームでまた挑戦してやる。", "face"],
      ["探偵", "君がいてくれて助かった。これでD館を元に戻せる。", "face"],
      ["探偵", "それと、METのブースではVR射的とVR金魚すくいもやっている。よかったら寄っていってくれ。", "face"]
    ], () => mark(K + "post-ending-done"), "復元したD館へ");
    return postMenu("バーチャルD館を<br>取り戻した！", "CASE CLOSED / 復元完了", `<div class="card"><h2>あなたが復元したD館</h2><p>完成版のCluster D館は、共有リンクの準備ができ次第ここから開けます。</p><p class="small">Clusterリンク：準備中</p></div><div class="card"><h2>METの体験ブースへ</h2><p>VR射的・VR金魚すくいも楽しめます。</p></div>`);
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
    const other = report === "b" ? "J館" : "E館";
    const lines = [["あなた", "こちらも一つ取り戻しました。"], ["探偵", `俺は${other}で盗品を見つけたぜ。`], ["探偵", first ? "君の担当は、あと一つだ。もう一通の手紙が示す場所へ向かってくれ。" : "これで全部だな。"]];
    return postSequence(`report-${report}`, lines, () => mark(K + `reported-${report}`), first ? "通話を終えて次の場所へ" : "次の通信を聞く");
  }
  if (yes("b-center-ar-success") && yes("g-object-ar-success")) return postSequence("final", [
    ["怪盗", "四つとも取り戻したのか。やるじゃないか。D館の看板で待っている。最後の勝負だ。"],
    ["探偵", "盗品は取り戻した。だが、あいつをこのまま逃がすわけにはいかない。D館の看板で合流しよう。", "call", "通話を終える"],
    ["ナレーション", "D館の看板へ向かおう。探偵が合流を待っている。", "face", "D館の看板に到着した"],
    ["探偵", "来たな。逃げ道は俺が押さえる。", "face"],
    ["怪盗", "今度は助手連れか。探偵とその助手、二人まとめて相手をしてやる。", "face"],
    ["怪盗", "さあ、ゲームスタートだ。", "face"]
  ], () => { location.href = "./d-final-sorting/index.html"; }, "最後の勝負『盗品を見抜け』へ");
  if (!yes(K + "post-recovery-brief-done") && !yes("b-center-ar-success") && !yes("g-object-ar-success")) return postSequence("recovery-brief", [["探偵", "二通の手紙が示す場所へ向かってくれ。どちらからでも構わない。"]], () => mark(K + "post-recovery-brief-done"), "通話を終えて行き先を選ぶ");
  const recovered = Number(yes("b-center-ar-success")) + Number(yes("g-object-ar-success"));
  const missions = [["b", "w", "W 至円", "B館の看板 / 流れる文字", "w-ring"], ["g", "g", "響在-高見観音", "G館近くの彫刻 / 隠れた文字", "stone-art"]].map(([id, letter, name, hint, icon]) => {
    const done = yes(id === "b" ? "b-center-ar-success" : "g-object-ar-success");
    return `<div class="card mission"><img src="../Assets/icons/${icon}-icon.png" alt=""><div><h3>${name}</h3><p>${hint}</p>${done ? '<span class="badge">回収済み</span>' : ""}</div><div class="actions">${done ? button("手紙を読み返す", `letter-${letter}`, "secondary") : button(`${id.toUpperCase()}館のゲームへ`, `go-${id}`)}</div></div>`;
  }).join("");
  postMenu(recovered ? "残りの手紙を追え" : "二つの手がかりを追え", `あなたの回収 ${recovered}/2 · 全体 ${recovered * 2}/4`, `<div class="grid two">${missions}</div><p class="small post-help">現地で読み取れない場合は、各ゲームの「読み取りをスキップ」から進めます。</p>`);
}

function handlePostAction(action) {
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
  const suffixes = [...POST_IDS.map(id => `post-${id}`), "post-history", "post-rechecking", "post-letters-report-done", "post-letters-continue", "post-recovery-brief-done", "post-ending-done"];
  suffixes.forEach(suffix => { try { localStorage.removeItem(K + suffix); } catch {} });
}
