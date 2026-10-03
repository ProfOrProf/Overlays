const STATE_URL   = "/games/eldendle/state";
const POLL_MS     = 250;
const MAX_GUESSES = 10;
const ROW_H       = 170;
const HOLD_MS     = 5000;

const COPY = {
  title: "Eldendle",
  subtitle: "Type !guess [ Boss ] to play",
  guessesLabel: "Guesses",
  waiting: "Waiting for the first guess",
  counter: "Guess",
  foundIn: "Found in {n} guesses",
  foundInOne: "Found in one guess",
  nobody: "Nobody found it",
};

const root    = document.getElementById("root");
const panel   = document.getElementById("panel");
const pipRow  = document.getElementById("pip-row");
const reel    = document.getElementById("reel");
const gcount  = document.getElementById("gcount");

function mkAudio(path) {
  const a = new Audio(path);
  a.preload = "auto";
  return a;
}
const audWin   = mkAudio("./Audio/EldendleWin.wav");
const audLoss  = mkAudio("./Audio/EldendleLoss.wav");
const audWrong = mkAudio("./Audio/EldendleWrong.wav");
const audStart = mkAudio("./Audio/EldendleStart.wav");

function safePlay(aud) {
  try { aud.currentTime = 0; aud.play().catch(() => {}); } catch (e) {}
}

function esc(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function applyCopy(overlay) {
  if (!overlay) return;
  Object.keys(COPY).forEach(k => {
    if (typeof overlay[k] === "string" && overlay[k].length) COPY[k] = overlay[k];
  });
  document.getElementById("title").textContent    = COPY.title;
  document.getElementById("subtitle").textContent = COPY.subtitle;
  document.getElementById("pip-label").textContent = COPY.guessesLabel;
}

function bossSlug(name) {
  return String(name || "").toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

const REGION_SHORT = {
  "Mountaintops of the Giants": "Mountaintops",
  "Ancient Ruins of Rauh": "Ancient Ruins",
  "Crumbling Farum Azula": "Farum Azula",
  "Nokron, Eternal City": "Nokron",
  "Liurnia of the Lakes": "Liurnia",
  "Consecrated Snowfield": "Snowfield",
  "Leyndell, Royal Capital": "Leyndell",
  "Miquella's Haligtree": "Haligtree",
  "Academy of Raya Lucaria": "Raya Lucaria",
};

function regionLabel(r) {
  if (!r) return "—";
  return REGION_SHORT[r] || r;
}

function arrowHtml(dir) {
  if (dir === "correct") return `<span class="arrow">✦</span>`;
  if (dir === "higher")  return `<span class="arrow">▲</span>`;
  if (dir === "lower")   return `<span class="arrow">▼</span>`;
  return "";
}

function dirClass(dir) {
  if (dir === "correct") return "ok";
  if (dir === "higher")  return "hi";
  if (dir === "lower")   return "lo";
  return "";
}

function num(v) {
  return v ? Number(v).toLocaleString() : "—";
}

function guessRow(g) {
  const name   = g.matched_name || g.raw || "???";
  const gender = g.gender === "M" ? "MALE" : g.gender === "F" ? "FEMALE" : "—";
  return `<div class="row">
    <div class="cell"><div class="lab">Boss</div><div class="val fit" data-max="110">${esc(name)}</div></div>
    <div class="cell ${g.gender_correct ? "ok" : "no"}"><div class="lab">Gender</div><div class="val fit" data-max="96">${gender}</div></div>
    <div class="cell ${dirClass(g.hp_dir)}"><div class="lab">HP</div><div class="val fit" data-max="96">${num(g.hp)}${arrowHtml(g.hp_dir)}</div></div>
    <div class="cell ${dirClass(g.runes_dir)}"><div class="lab">Souls</div><div class="val fit" data-max="96">${num(g.runes)}${arrowHtml(g.runes_dir)}</div></div>
    <div class="cell ${g.region_correct ? "ok" : "no"}"><div class="lab">Region</div><div class="val fit" data-max="72">${esc(regionLabel(g.region))}</div></div>
  </div>`;
}

function revealRow(state, won) {
  const slug  = bossSlug(state.boss_name);
  const used  = (state.guesses || []).length;
  const stamp = won
    ? (used === 1 ? COPY.foundInOne : COPY.foundIn.replace("{n}", used))
    : COPY.nobody;
  return `<div class="row reveal-row">
    <div class="cell"><img class="face" src="./TMP/${slug}.jpg" alt=""
         onerror="this.outerHTML='&lt;div class=&quot;placeholder&quot;&gt;ᚱ&lt;/div&gt;'"></div>
    <div class="cell"><div class="val fit nameval" data-max="104">${esc(state.boss_name)}</div><div class="stamp">${esc(stamp)}</div></div>
    <div class="cell"><div class="lab">HP</div><div class="val fit" data-max="96">${num(state.boss_hp)}</div></div>
    <div class="cell"><div class="lab">Souls</div><div class="val fit" data-max="96">${num(state.boss_runes)}</div></div>
    <div class="cell"><div class="lab">Region</div><div class="val fit" data-max="72">${esc(regionLabel(state.boss_region))}</div></div>
  </div>`;
}

function waitingRow() {
  return `<div class="row"><div class="waiting" style="grid-column:1/-1">${esc(COPY.waiting)}</div></div>`;
}

function fit(scope) {
  scope.querySelectorAll(".fit").forEach(el => {
    let size = +el.dataset.max;
    el.style.fontSize = size + "px";
    while (size > 28 && el.scrollWidth > el.clientWidth) {
      size -= 2;
      el.style.fontSize = size + "px";
    }
  });
}

let spinning = false;
let pendingSpin = null;

function landNow(html) {
  reel.style.transition = "none";
  reel.style.transform  = "translateY(0)";
  reel.className = "";
  reel.innerHTML = html;
  fit(reel);
}

function spinTo(html, long, pool) {
  if (spinning) { pendingSpin = [html, long, pool]; return; }
  const blanks = long ? 9 : 5;
  const filler = [];
  for (let i = 0; i < blanks; i++) {
    const g = pool && pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
    filler.push(g ? guessRow(g) : waitingRow());
  }
  const current = reel.lastElementChild ? reel.lastElementChild.outerHTML : waitingRow();

  reel.style.transition = "none";
  reel.style.transform  = "translateY(0)";
  reel.innerHTML = current + filler.join("") + html;
  fit(reel);

  spinning = true;
  reel.classList.add("spinning");
  void reel.offsetWidth;

  const ms = long ? 2200 : 1500;
  reel.style.transition = `transform ${ms}ms cubic-bezier(.22,.9,.28,1.08)`;
  reel.style.transform  = `translateY(${-(blanks + 1) * ROW_H}px)`;

  setTimeout(() => reel.classList.remove("spinning"), ms * 0.72);
  setTimeout(() => {
    landNow(html);
    spinning = false;
    if (pendingSpin) { const p = pendingSpin; pendingSpin = null; spinTo(p[0], p[1], p[2]); }
  }, ms + 40);
}

function renderPips(guesses, maxGuesses) {
  pipRow.innerHTML = "";
  for (let i = 0; i < maxGuesses; i++) {
    const pip = document.createElement("div");
    pip.className = "pip";
    const g = guesses[i];
    if (g) pip.classList.add(g.correct ? "correct" : "wrong");
    pipRow.appendChild(pip);
  }
}

function showCounter(index, total) {
  gcount.innerHTML = total && index >= 0
    ? `${esc(COPY.counter)}<b>${index + 1} / ${total}</b>`
    : "";
}

let rollTimer = null;
let viewIndex = -1;
let shownGuesses = [];

function stopRoll() {
  clearTimeout(rollTimer);
  rollTimer = null;
}

function scheduleRoll(ms) {
  stopRoll();
  rollTimer = setTimeout(rollOne, ms);
}

function rollOne() {
  if (!shownGuesses.length) return;
  viewIndex = (viewIndex + 1) % shownGuesses.length;
  showCounter(viewIndex, shownGuesses.length);
  spinTo(guessRow(shownGuesses[viewIndex]), false, shownGuesses);
  scheduleRoll(HOLD_MS);
}

function showNewGuess(guesses) {
  shownGuesses = guesses;
  viewIndex = guesses.length - 1;
  showCounter(viewIndex, guesses.length);
  spinTo(guessRow(guesses[viewIndex]), true, guesses);
  scheduleRoll(HOLD_MS * 2);
}

function resetRound() {
  stopRoll();
  shownGuesses = [];
  viewIndex = -1;
  gcount.innerHTML = "";
  landNow(waitingRow());
}

let hideTimer   = null;
let lastSerial  = -1;
let lastPhase   = null;
let lastCount   = -1;
let audioPlayed = { won: false, lost: false, start: false };

const DEMO = new URLSearchParams(location.search).has("demo");
let demoState = { phase: "idle", serial: 0 };
if (DEMO) {
  addEventListener("message", e => {
    if (e.data && e.data.eldendle) demoState = e.data.eldendle;
  });
}

async function tick() {
  try {
    let j;
    if (DEMO) {
      j = demoState;
    } else {
      const r = await fetch(STATE_URL, { cache: "no-store" });
      if (!r.ok) return;
      const raw = await r.json();
      j = raw.state || raw;
    }

    const phase  = j.phase  || "idle";
    const serial = j.serial || 0;
    applyCopy(j.overlay);

    if (serial !== lastSerial && phase !== "idle") {
      lastSerial  = serial;
      lastCount   = -1;
      audioPlayed = { won: false, lost: false, start: false };
      panel.classList.remove("won", "lost");
      resetRound();
    }

    if (phase !== "idle") {
      clearTimeout(hideTimer);
      root.classList.remove("hidden");
      root.classList.add("visible");
    }

    if (phase !== lastPhase) {
      if (phase === "active") {
        panel.classList.remove("won", "lost");
        if (!audioPlayed.start) { audioPlayed.start = true; safePlay(audStart); }
      }
      if (phase === "idle") {
        stopRoll();
        root.classList.remove("visible");
        clearTimeout(hideTimer);
        hideTimer = setTimeout(() => {
          if (lastPhase === "idle") root.classList.add("hidden");
        }, 900);
      }
      if (phase === "won" || phase === "lost") {
        const won = phase === "won";
        panel.classList.add(won ? "won" : "lost");
        if (won && !audioPlayed.won)   { audioPlayed.won = true;   safePlay(audWin); }
        if (!won && !audioPlayed.lost) { audioPlayed.lost = true;  safePlay(audLoss); }
        stopRoll();
        gcount.innerHTML = "";
        spinTo(revealRow(j, won), true, j.guesses || []);
      }
      lastPhase = phase;
    }

    if (phase === "active") {
      const guesses = j.guesses || [];
      renderPips(guesses, j.max_guesses || MAX_GUESSES);
      if (guesses.length !== lastCount) {
        if (guesses.length > lastCount && guesses.length > 0) {
          const newest = guesses[guesses.length - 1];
          if (!newest.correct) safePlay(audWrong);
          showNewGuess(guesses);
        } else if (guesses.length === 0) {
          resetRound();
        }
        lastCount = guesses.length;
      }
    }
  } catch (e) {}
}

if (window.OverlayMove) {
  const anchor = document.getElementById("anchor");
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem("eldendle.layout") || "null"); } catch (e) {}
  window.PGMove = OverlayMove.init({
    title: "Eldendle",
    accent: "#c9a84c",
    saved: saved,
    elements: [
      { id: "panel", label: "Panel", target: () => anchor }
    ],
    save: async function (values) {
      try { localStorage.setItem("eldendle.layout", JSON.stringify(values)); } catch (e) {}
      return values;
    }
  });
}

landNow(waitingRow());
setInterval(tick, POLL_MS);
tick();
