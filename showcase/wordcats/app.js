const STATE_URL = "/games/wordcats/state";
const POLL_MS   = 200;

const panel        = document.getElementById("panel");
const logo         = document.getElementById("logo");
const cmd          = document.getElementById("cmd");
const orbitLayer   = document.getElementById("orbitLayer");
const orbitTimer   = document.getElementById("orbitTimer");
const cmdOverlay   = document.getElementById("cmdOverlay");
const catListRow   = document.getElementById("catListRow");
const winLayer     = document.getElementById("winLayer");
const winName      = document.getElementById("winName");
const winPortrait  = document.getElementById("winPortrait");
const audWinner    = document.getElementById("audWinner");
const audGunshot   = document.getElementById("audGunshot");
const audIdle      = document.getElementById("audIdle");
const audLight     = document.getElementById("audLight");

const audTick = document.createElement("audio");
audTick.src = "./Audio/tick.mp3";
audTick.preload = "auto";
document.body.appendChild(audTick);

const audMeow = document.createElement("audio");
audMeow.src = "./Audio/meow.mp3";
audMeow.preload = "auto";
document.body.appendChild(audMeow);

const prePredLayer = document.createElement("div");
prePredLayer.id = "prePredLayer";
prePredLayer.style.cssText = [
  "position:fixed","top:0","left:0","width:100%","height:100%",
  "display:none","flex-direction:column","align-items:center","justify-content:center",
  "pointer-events:none","z-index:800","gap:20px"
].join(";") + ";";

const prePredLabel = document.createElement("div");
prePredLabel.id = "prePredLabel";

const prePredCount = document.createElement("div");
prePredCount.id = "prePredCount";

prePredLayer.appendChild(prePredLabel);
prePredLayer.appendChild(prePredCount);
document.body.appendChild(prePredLayer);

(function injectPrePredStyles(){
  const style = document.createElement("style");
  style.textContent = `
    @keyframes letterBob {
      0%,100% { transform:translateY(0px); }
      50%      { transform:translateY(-6px); }
    }
    #prePredLayer {
      gap: 20px;
    }
    #prePredLabel {
      font-family:"SourGummy","Sour Gummy","Comic Sans MS",sans-serif;
      font-size:130px;
      color:#f5e642;
      text-shadow:0 0 10px #f5e642,0 0 28px #f5e642,0 0 60px #e0c800,0 0 2px #000;
      letter-spacing:2px;
      margin-bottom:0;
      white-space:nowrap;
    }
    #prePredLabel .bob-letter {
      display:inline-block;
      animation:letterBob 1.1s ease-in-out infinite;
    }
    #prePredCount {
      font-family:"SourGummy","Sour Gummy","Comic Sans MS",sans-serif;
      font-size:320px;
      color:#f5e642;
      text-shadow:0 0 16px #f5e642,0 0 40px #f5e642,0 0 90px #e0c800,0 0 3px #000;
      line-height:1;
    }
  `;
  document.head.appendChild(style);
})();

const PRE_PRED_TEXT = "Predictions Start in:";

function buildBobLabel(text) {
  prePredLabel.innerHTML = "";
  let charIdx = 0;
  for (const ch of text) {
    if (ch === " ") {
      prePredLabel.appendChild(document.createTextNode("\u00A0"));
    } else {
      const span = document.createElement("span");
      span.className = "bob-letter";
      span.textContent = ch;
      span.style.animationDelay = (charIdx * 60) + "ms";
      prePredLabel.appendChild(span);
      charIdx++;
    }
  }
}

let prePredRemaining = 60;
let prePredInterval  = null;

function startPrePredCountdown(seconds) {
  prePredRemaining = seconds;
  buildBobLabel(PRE_PRED_TEXT);
  prePredCount.textContent = String(prePredRemaining);
  prePredLayer.style.display = "flex";
  clearInterval(prePredInterval);
  prePredInterval = setInterval(() => {
    prePredRemaining--;
    if (prePredRemaining <= 0) {
      prePredCount.textContent = "0";
      stopPrePredCountdown();
    } else {
      prePredCount.textContent = String(prePredRemaining);
    }
  }, 1000);
}

function stopPrePredCountdown() {
  clearInterval(prePredInterval);
  prePredInterval = null;
  prePredLayer.style.display = "none";
}

// ── Announcer → shared overlay ───────────────────────────────────────────────
// The announcer (cat + speech bubble + meow) now renders in the standalone
// announcer.html source. Detection + timing stay HERE unchanged; we POST a cue
// and keep the local `announcerActive` gate alive for the cue's full duration so
// the rest of the overlay (dead-air fillers, staging) stays suppressed exactly as
// before. If no announcer source is open the POST just no-ops. Absolute asset URLs
// so announcer.html (served from the relay port) resolves our gif/meow correctly.
const ANNOUNCER_SAY = "http://127.0.0.1:8781/say";
const ANN_GIF   = new URL("./Images/catracer-announcer.gif", document.baseURI).href;
const ANN_SOUND = new URL("./Audio/meow.mp3", document.baseURI).href;
// keep the original pink kitty look (the shared overlay defaults to the Chairlene skin)
const ANN_SKIN = {
  bg: "#ffffff", color: "#72206f", border: "3px solid #ffc6fd",
  glow: "0 0 18px rgba(255,150,255,0.7),0 0 40px rgba(220,80,220,0.45),0 0 8px rgba(143,32,139,0.5)",
  font: '"Comic Sans MS","Arial Rounded MT",sans-serif', fontSize: 46, imgWidth: 340, bubbleMaxWidth: 760
};

let announcerActive  = false;
let announcerFired1  = false;
let announcerSeqId   = null;

function postCue(steps) {
  try {
    fetch(ANNOUNCER_SAY, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      keepalive: true,
      // meow leads each line, then the kitty voice types it — the overlay composes the two
      body: JSON.stringify({ gif: ANN_GIF, sound: ANN_SOUND, voice: "kitty", skin: ANN_SKIN, perCharMs: 28, steps })
    }).catch(() => {});
  } catch (e) {}
}

// Fire a cue + hold the on-screen gate for its full duration (sum of holds + fade).
function announce(steps) {
  if (!steps || !steps.length) return;
  postCue(steps);
  clearTimeout(announcerSeqId);
  announcerActive = true;
  const total = steps.reduce((t, s) => t + (s.holdMs || 4000), 0) + 700;
  announcerSeqId = setTimeout(() => { announcerActive = false; }, total);
}

function runAnnouncerSequence(messages) {
  announce((messages || []).map(m => ({ text: m, holdMs: 4000 })));
}

function triggerHalfwayAnnouncer(firstCat, secondCat, thirdCat) {
  if (announcerActive) return;
  runAnnouncerSequence([
    "Halfway through the race...",
    `${firstCat} is in 1st!!!`,
    `${secondCat} is in 2nd!!!`,
    `${thirdCat} is in 3rd!!!`,
  ]);
}

function triggerWinnerAnnouncer(winnerName, lanesObj, winnerCatId) {
  if (announcerActive) return;

  let wStats = null;
  if (lanesObj && winnerCatId) {
    for (const key of ["1","2","3"]) {
      const lane = lanesObj[key];
      if (lane && lane.cat_id === winnerCatId) { wStats = lane.stats; break; }
    }
  }

  const msgs = [`\uD83C\uDFC1Winner... ${winnerName}!\uD83C\uDFC1`];

  if (wStats) {
    const wins   = wStats.wins   || 0;
    const races  = wStats.races  || 0;
    const pct    = wStats.win_pct || 0;
    const streak = wStats.win_streak || 0;

    if (wins > 0)
      msgs.push(`${winnerName} has won ${wins} time${wins===1?"":"s"}!`);

    if (streak >= 3)
      msgs.push(`That's ${streak} in a row!!! PAWS. ON. FIRE.`);
    else if (pct > 0)
      msgs.push(`${winnerName} wins ${pct}% of their races!`);
  }

  msgs.push("Thanks for watching!");
  runAnnouncerSequence(msgs);
}

function resetAnnouncer() {
  clearTimeout(announcerSeqId);
  announcerActive  = false;
  announcerFired1  = false;
}

function triggerBettingOpenAnnouncer(c1, c2, c3) {
  // bespoke holds preserved: "engines" 5s, "racers are" 2s, the reveal 4s
  announce([
    { text: "CatRods, start your engines!!!", holdMs: 5000 },
    { text: "The racers are...",              holdMs: 2000 },
    { text: `...${c1}, ${c2}, and ${c3}!!!`,  holdMs: 4000 },
  ]);
}

function triggerRaceStartAnnouncer() {
  if (announcerActive) return;
  runAnnouncerSequence(["Bets are in and cats are off!!!"]);
}

let deadAirTimers = [];

function clearDeadAirTimers() {
  deadAirTimers.forEach(t => clearTimeout(t));
  deadAirTimers = [];
}

function buildFlavorMessages(laneState, allLanes, activeFoodName) {
  if (!laneState) return null;
  const n       = laneState.user_display || "?";
  const st      = laneState.stats || {};
  const wins    = st.wins    || 0;
  const races   = st.races   || 0;
  const pct     = st.win_pct || 0;
  const streak  = st.win_streak  || 0;
  const best    = st.best_streak || 0;
  const favFood = st.fav_food    || "";
  const favWins = st.fav_food_wins || 0;
  const pts     = st.points_on   || 0;
  const losses  = races - wins;
  const food    = activeFoodName || "a mystery treat";

  const pool = [];

  if (wins > 0) {
    pool.push([`${n} has won ${wins} race${wins===1?"":"s"}!`, "Not too shabby fur a cat!"]);
    pool.push([`${n} wins ${pct}% of the time!`, "The odds are in their paws!"]);
  }
  if (wins === 0 && races > 0)
    pool.push([`${n} has raced ${races} times...`, "Still searching fur that first win!"]);
  if (wins > 0 && losses > 0)
    pool.push([`Out of ${races} races, ${n} has only lost ${losses} time${losses===1?"":"s"}!`, "Virtually un-de-fur-ated!"]);
  if (races > 10)
    pool.push([`${n} has raced ${races} times!`, "That's a lot of Jelly Beans on the line!"]);

  if (streak >= 2) {
    pool.push([`\uD83D\uDD25 ${n} is on a ${streak}-race win streak!`, "They are PAWS ON FIRE!"]);
    pool.push([`Don't look now — ${n} has won ${streak} in a row!`, "The fur is absolutely flying!"]);
  }
  if (best >= 2)
    pool.push([`${n}'s best streak ever was ${best} in a row!`, "Claw-some!"]);
  if (streak === 0 && best < 2 && races > 0)
    pool.push([`${n} has never won back to back!`, "Today could be the day!"]);

  if (favFood && favWins > 0) {
    pool.push([`Rumor has it ${n} only races fur the ${favFood}!`]);
    pool.push([`${n} has won ${favWins} time${favWins===1?"":"s"} when ${favFood} was on the menu!`, "Coinky-dink? We think not!"]);
    pool.push([`${n} and ${favFood}...`, "A love story written in Jelly Beans!"]);
  }
  pool.push([`Today's prize on the menu is ${food}!`, `Will it bring ${n} luck?`]);

  if (pts > 0) {
    pool.push([`Chat has spent ${pts.toLocaleString()} Jelly Beans on ${n} lifetime!`, "That's a lot of cat food!"]);
    pool.push([`${pts.toLocaleString()} Jelly Beans have been thrown at ${n}!`, "They remain unfazed."]);
  }

  if (allLanes) {
    const others = [1,2,3].filter(i => allLanes[String(i)] && allLanes[String(i)].user_display !== n);
    const allWins = [1,2,3].reduce((sum,i)=>sum+(allLanes[String(i)]?.stats?.wins||0),0);
    if (allWins > 0)
      pool.push([`Today's race features ${allWins} combined career wins!`, "Between all three racers!"]);

    const allPcts = [1,2,3].map(i=>allLanes[String(i)]?.stats?.win_pct||0);
    const myLane  = [1,2,3].find(i=>allLanes[String(i)]?.user_display===n);
    if (myLane) {
      const myPct   = allLanes[String(myLane)]?.stats?.win_pct||0;
      const maxPct  = Math.max(...allPcts);
      const minPct  = Math.min(...allPcts);
      const myRaces = allLanes[String(myLane)]?.stats?.races||0;
      if (myPct === maxPct && myPct > 0)
        pool.push([`Of today's racers, ${n} has the best win rate!`, `At ${pct}% — the paw-fessional!`]);
      if (myPct === minPct && myRaces > 2)
        pool.push([`${n} is the undercat today!`, `Lowest win rate in the field at ${pct}%!`]);
    }
  }

  if (pool.length < 4) {
    pool.push([`Win or lose, ${n} looks great doing it!`, "It's the fur."]);
    pool.push([`The crowd goes wild for ${n}!`, "Or at least — their Jelly Beans do!"]);
    pool.push([`Every race is a fresh start for ${n}!`, "Fur-get the past!"]);
  }

  if (pool.length === 0) return [`Cheering fur ${n}!`];
  return pool[Math.floor(Math.random() * pool.length)];
}

function fireFlavor(laneIndex, lanesObj, foodName) {
  if (announcerActive) return;
  const laneKey = String(laneIndex + 1);
  const msg = buildFlavorMessages(lanesObj?.[laneKey], lanesObj, foodName);
  if (msg) runAnnouncerSequence(msg);
}

let _lastFlavorLanes = null;
let _lastFlavorFood  = null;

function scheduleBettingDeadAir(lanesObj, foodName) {
  _lastFlavorLanes = lanesObj;
  _lastFlavorFood  = foodName;
  clearDeadAirTimers();
  const catOrder = [0, 1, 2].sort(() => Math.random() - 0.5);
  const slots = [25000, 60000, 95000];
  slots.forEach((delay, i) => {
    const t = setTimeout(() => {
      if (announcerActive) {
        const retry = setTimeout(() => fireFlavor(catOrder[i], _lastFlavorLanes, _lastFlavorFood), 8000);
        deadAirTimers.push(retry);
      } else {
        fireFlavor(catOrder[i], _lastFlavorLanes, _lastFlavorFood);
      }
    }, delay);
    deadAirTimers.push(t);
  });
}

function scheduleRaceStartDeadAir(lanesObj, foodName) {
  _lastFlavorLanes = lanesObj;
  _lastFlavorFood  = foodName;
  const t = setTimeout(() => {
    if (announcerActive) {
      const retry = setTimeout(() => fireFlavor(Math.floor(Math.random()*3), _lastFlavorLanes, _lastFlavorFood), 8000);
      deadAirTimers.push(retry);
    } else {
      fireFlavor(Math.floor(Math.random()*3), _lastFlavorLanes, _lastFlavorFood);
    }
  }, 10000);
  deadAirTimers.push(t);
}

let halfwayDeadAirScheduled = false;
function scheduleHalfwayDeadAir(lanesObj, foodName) {
  if (halfwayDeadAirScheduled) return;
  halfwayDeadAirScheduled = true;
  _lastFlavorLanes = lanesObj;
  _lastFlavorFood  = foodName;
  const t = setTimeout(() => {
    if (announcerActive) {
      const retry = setTimeout(() => fireFlavor(Math.floor(Math.random()*3), _lastFlavorLanes, _lastFlavorFood), 8000);
      deadAirTimers.push(retry);
    } else {
      fireFlavor(Math.floor(Math.random()*3), _lastFlavorLanes, _lastFlavorFood);
    }
  }, 20000);
  deadAirTimers.push(t);
}

const catItems = [null,
  document.getElementById("catItem1"),
  document.getElementById("catItem2"),
  document.getElementById("catItem3"),
];
const orbitImgs = [
  document.querySelector("#orbitCat1 img"),
  document.querySelector("#orbitCat2 img"),
  document.querySelector("#orbitCat3 img"),
];
const orbitEls = [
  document.getElementById("orbitCat1"),
  document.getElementById("orbitCat2"),
  document.getElementById("orbitCat3"),
];
const nameEl = [null,
  document.getElementById("h1"), document.getElementById("h2"), document.getElementById("h3"),
];
const starEl = [null,
  document.getElementById("s1"), document.getElementById("s2"), document.getElementById("s3"),
];
function renderStars(series){
  if(!series) return;
  const target = series.target || 2;
  const wins   = series.wins || [0,0,0];
  for(let i=1;i<=3;i++){
    if(!starEl[i]) continue;
    const w = wins[i-1] || 0;
    let html = "";
    for(let k=0;k<target;k++)
      html += (k < w) ? "★" : '<span class="dim">★</span>';
    starEl[i].innerHTML = series.active ? html : "";
  }
}
const foodEl = [null,
  document.getElementById("food1"), document.getElementById("food2"), document.getElementById("food3"),
];
const wrapEl = [null,
  document.getElementById("w1"), document.getElementById("w2"), document.getElementById("w3"),
];
const imgEl = [null,
  document.getElementById("img1"), document.getElementById("img2"), document.getElementById("img3"),
];

function assignFoods(foodFile){
  const src = foodFile ? `./Images/${foodFile}` : null;
  if(!src) return;
  for(let i=1;i<=3;i++) if(foodEl[i]) foodEl[i].src=src;
}
function catPngUrl(catId){ return `./Images/catracer-${catId}.png`; }

const ORBIT_CX=960, ORBIT_CY=490, ORBIT_R=300, CAT_HALF=110;
let orbitAngle=0, orbitSpeed=0.00015, orbitRafId=null, orbitLastTs=null, orbitRunning=false;
let lockedCatIds=[null,null,null], catsAssigned=false;
const BASE_SPEED=0.00015, MAX_SPEED=0.009;

function orbitPositions(a){
  return [0,1,2].map(i=>({
    x:ORBIT_CX+ORBIT_R*Math.cos(a+i*2*Math.PI/3)-CAT_HALF,
    y:ORBIT_CY+ORBIT_R*Math.sin(a+i*2*Math.PI/3)-CAT_HALF,
  }));
}
function orbitFrame(ts){
  if(!orbitRunning) return;
  if(orbitLastTs===null) orbitLastTs=ts;
  const dt=Math.min(ts-orbitLastTs,50); orbitLastTs=ts;
  orbitAngle+=orbitSpeed*dt;
  const pos=orbitPositions(orbitAngle);
  for(let i=0;i<3;i++){ orbitEls[i].style.left=pos[i].x+"px"; orbitEls[i].style.top=pos[i].y+"px"; }
  orbitRafId=requestAnimationFrame(orbitFrame);
}
function startOrbit(){
  orbitAngle=0; orbitSpeed=BASE_SPEED; orbitLastTs=null; orbitRunning=true; catsAssigned=false;
  for(let i=0;i<3;i++){ orbitEls[i].style.transition="opacity 500ms ease"; orbitEls[i].style.opacity="0"; }
  orbitLayer.style.display="block";
  orbitRafId=requestAnimationFrame(orbitFrame);
}
function assignOrbitCats(catIds){
  if(catsAssigned) return;
  if(!catIds[0]||!catIds[1]||!catIds[2]) return;
  catsAssigned=true; lockedCatIds=[...catIds];
  for(let i=0;i<3;i++){ orbitImgs[i].src=catPngUrl(lockedCatIds[i]); orbitEls[i].style.opacity="1"; }
}
function flyOffScreen(){
  orbitRunning=false;
  if(orbitRafId) cancelAnimationFrame(orbitRafId);
  orbitRafId=null; orbitLastTs=null;
  const dirs=[{x:-2400,y:-1400},{x:2400,y:-1200},{x:0,y:1600}].sort(()=>Math.random()-0.5);
  for(let i=0;i<3;i++){
    const cx=parseFloat(orbitEls[i].style.left)||0, cy=parseFloat(orbitEls[i].style.top)||0;
    orbitEls[i].style.transition="left 800ms cubic-bezier(.4,0,1,1),top 800ms cubic-bezier(.4,0,1,1),opacity 600ms ease";
    orbitEls[i].style.left=(cx+dirs[i].x)+"px"; orbitEls[i].style.top=(cy+dirs[i].y)+"px";
    orbitEls[i].style.opacity="0";
  }
  orbitTimer.style.transition="opacity 400ms ease"; orbitTimer.style.opacity="0";
  if(cmdOverlay) cmdOverlay.style.display="none";
  if(catListRow) catListRow.style.display="none";
}
function stopOrbit(){
  orbitRunning=false;
  if(orbitRafId) cancelAnimationFrame(orbitRafId);
  orbitRafId=null; orbitLastTs=null;
  orbitLayer.style.display="none"; catsAssigned=false;
  for(let i=0;i<3;i++){ orbitEls[i].style.transition=""; orbitEls[i].style.opacity="0"; }
  if(orbitTimer){ orbitTimer.style.transition=""; orbitTimer.style.opacity="1"; }
}
function updateOrbitSpeed(betLeft,betSeconds){
  const p=1-Math.max(0,betLeft)/betSeconds;
  orbitSpeed=BASE_SPEED+(MAX_SPEED-BASE_SPEED)*Math.pow(p,2.5);
}

function startIdleShake(){
  for(let i=1;i<=3;i++) wrapEl[i]?.classList.add("idling");
}
function stopIdleShake(){
  for(let i=1;i<=3;i++) wrapEl[i]?.classList.remove("idling");
}

let catListShown=false;
function showCatList(names){
  if(!catListRow) return;
  for(let i=1;i<=3;i++) if(catItems[i]) catItems[i].textContent=`${i}. ${names[i-1]||"?"}`;
  catListRow.style.display="flex";
}
function hideCatList(){ if(catListRow) catListRow.style.display="none"; }

let winArmed=false;
function clearWin(){
  winArmed=false; winLayer.classList.add("hidden"); winLayer.classList.remove("winFadeOut");
  winPortrait.classList.remove("winSpinInOut","winRock");
}
function startWinTakeover(winnerDisplay,catId){
  if(winArmed) return; winArmed=true;
  hideLogo(); cmd.classList.add("hidden");
  winLayer.classList.remove("hidden","winFadeOut"); winLayer.style.opacity="1";
  winName.textContent=(winnerDisplay||"—")+"!!!"; winPortrait.src=catPngUrl(catId);
  winPortrait.classList.remove("winSpinInOut","winRock"); void winPortrait.offsetWidth;
  winPortrait.classList.add("winSpinInOut"); safePlay(audWinner);
  setTimeout(()=>{ winPortrait.classList.remove("winSpinInOut"); void winPortrait.offsetWidth; winPortrait.classList.add("winRock"); },2650);
  setTimeout(()=>{ winLayer.classList.add("winFadeOut"); },2650+8000);
  setTimeout(()=>{ clearWin(); },2650+8000+950);
}

function safePlay(aud){ try{ aud.currentTime=0; aud.play().catch(()=>{}); }catch(e){} }
function showLogo(){ logo.classList.remove("logoOut","logoIn"); void logo.offsetWidth; logo.classList.add("logoIn"); }
function hideLogo(){ logo.classList.remove("logoIn","logoOut"); void logo.offsetWidth; logo.classList.add("logoOut"); }

let WIN=1000;
function setLane(i,laneObj){
  if(!laneObj){ nameEl[i].textContent="—"; wrapEl[i].classList.remove("on"); wrapEl[i].style.left="0%"; return; }
  nameEl[i].textContent=laneObj.user_display||"—";
  const pct=Math.max(0,Math.min(WIN,laneObj.total??0))/WIN*100*FINISH_PCT;
  wrapEl[i].style.left=pct.toFixed(2)+"%"; wrapEl[i].classList.add("on");
  if(laneObj.cat_id&&imgEl[i].getAttribute("data-cat")!==laneObj.cat_id){
    imgEl[i].src=catPngUrl(laneObj.cat_id); imgEl[i].setAttribute("data-cat",laneObj.cat_id);
  }
}

let lastPhase=null, betSeconds=120;
let lastStagingStep=0;
let gunshotFired=false, prevTotals=[0,0,0];
let stagingSetup=false;
let bettingReady=false;
let raceVisible=false;
let raceStartDeadAirScheduled=false;


const wcPileEl = document.getElementById("wcPile");
const wcLettersEl = document.getElementById("wcLetters");
const wcCountEl = document.getElementById("wcCount");
const wcFlyEl = document.getElementById("wcFly");
let wcSeenWords = new Set();
let wcLastLetters = "";
let wcAnnounced = false;

function wcAnnounce(){
  if (typeof announce !== "function") return;
  announce([
    { text: "Use !guess to find words in the scramble!", holdMs: 4200 },
    { text: "Every word chat unscrambles makes these cats faster...", holdMs: 4200 },
    { text: "Knowledge is cat power!!!", holdMs: 3600 },
  ]);
}

function wcFly(word, user){
  if(!wcFlyEl) return;
  const el = document.createElement("div");
  el.className = "w";
  el.textContent = word;
  const dir = Math.random() < 0.5 ? -1 : 1;
  const dx = dir * (300 + Math.random() * 420);
  const dy = -(40 + Math.random() * 220);
  const rot = dir * (8 + Math.random() * 22);
  el.style.transform = "translate(-50%,0)";
  wcFlyEl.appendChild(el);
  el.animate([
    { transform: "translate(-50%,0) scale(.7)", opacity: 0 },
    { transform: "translate(-50%,-30px) scale(1.15)", opacity: 1, offset: .14 },
    { transform: `translate(calc(-50% + ${dx*0.55}px), ${dy*0.55}px) rotate(${rot*0.6}deg) scale(1.05)`, opacity: .95, offset: .62 },
    { transform: `translate(calc(-50% + ${dx}px), ${dy}px) rotate(${rot}deg) scale(1)`, opacity: 0 }
  ], { duration: 4200, easing: "cubic-bezier(.16,.7,.25,1)" }).onfinish = () => el.remove();
}

function wcRender(pile){
  if(!wcPileEl) return;
  if(!pile || !pile.letters){
    wcPileEl.style.opacity = "0";
    setTimeout(()=>{ if(wcPileEl.style.opacity==="0") wcPileEl.style.display="none"; }, 900);
    wcLastLetters = "";
    wcAnnounced = false;
    return;
  }
  if(wcPileEl.style.display !== "flex"){
    wcPileEl.style.display = "flex";
    requestAnimationFrame(()=>requestAnimationFrame(()=>{ wcPileEl.style.opacity = "1"; }));
  }

  if(!wcAnnounced){
    wcAnnounced = true;
    setTimeout(wcAnnounce, 1200);
  }

  if(pile.letters !== wcLastLetters){
    wcLastLetters = pile.letters;
    wcSeenWords = new Set();
    wcLettersEl.innerHTML = "";
    for(const ch of pile.letters){
      const s = document.createElement("span");
      s.textContent = ch;
      wcLettersEl.appendChild(s);
    }
  }
  wcCountEl.textContent = `${pile.found} / ${pile.total} found`;

  for(const f of (pile.recent || [])){
    const key = f.word + "|" + f.atMs;
    if(wcSeenWords.has(key)) continue;
    wcSeenWords.add(key);
    wcFly(f.word, f.user);
  }
}


const finishLineEl = document.querySelector(".finishLine");
const FINISH_PCT = 1.0;

function placeFinishLine(){
  if(!finishLineEl) return;
  const tw = document.querySelector("#lane1 .trackWrap");
  const rootEl = document.getElementById("root");
  if(!tw || !rootEl) return;
  const r = tw.getBoundingClientRect();
  const rr = rootEl.getBoundingClientRect();
  if(r.width < 10) return;
  finishLineEl.style.left =
    Math.round((r.left - rr.left) + r.width * FINISH_PCT) + "px";
}
window.addEventListener("resize", placeFinishLine);
const pfLayer = document.getElementById("pfLayer");
const pfStage = document.getElementById("pfStage");
const audShutter = new Audio(new URL("./Audio/shutter.mp3", document.baseURI).href);
audShutter.preload = "auto";
let pfShown = false;
let pfApproachClicks = 0;
let pfLastClick = 0;

function pfApproach(maxTotal){
  if(pfApproachClicks >= 2) return;
  if(maxTotal < WIN * 0.86) return;
  const now = Date.now();
  if(now - pfLastClick < 850) return;
  pfLastClick = now;
  pfApproachClicks++;
  pfShutter();
}

function pfShutter(){
  try { const a = audShutter.cloneNode(); a.volume = 0.9; a.play().catch(()=>{}); } catch(e){}
}

function pfRun(pf){
  if(pfShown || !pf || !pf.shots || !pf.shots.length) return;
  pfShown = true;
  const wanted = pf.shots.slice(-3);
  const loads = wanted.map(sh => new Promise(resolve => {
    const probe = new Image();
    probe.onload = () => resolve(sh);
    probe.onerror = () => resolve(null);
    probe.src = sh.url + "?v=" + sh.atMs;
  }));
  const holdForReveal = new Promise(resolve => setTimeout(resolve, 4200));
  Promise.all([Promise.all(loads), holdForReveal]).then(([loaded]) => {
    const developed = loaded.filter(Boolean);
    if(developed.length) pfShowSequence(Object.assign({}, pf, { shots: developed }));
  });
}

function pfShowSequence(pf){
  pfStage.innerHTML = "";
  pfLayer.classList.add("on");
  setTimeout(()=>pfLayer.classList.add("show-title"), 250);

  const shots = pf.shots.slice(-3);
  const n = shots.length;

  const CARD_W = 507;
  const MAX_SPAN = 1820;
  const scale = Math.min(1, MAX_SPAN / (n * CARD_W));
  const spread = CARD_W * scale;
  const startX = -((n - 1) * spread) / 2;
  const step = 1000;

  shots.forEach((sh, i) => {
    const d = document.createElement("div");
    d.className = "pfShot";
    const img = document.createElement("img");
    img.src = sh.url + "?v=" + sh.atMs;
    d.appendChild(img);
    if(i === n - 1 && sh.url.indexOf("/final_") >= 0){
      const tag = document.createElement("div");
      tag.className = "pfTag";
      tag.textContent = "FINISH";
      d.appendChild(tag);
    }
    pfStage.appendChild(d);

    const rot = (i - (n - 1) / 2) * 14;
    d.style.transition = "none";
    d.style.transform =
      `translate(calc(-50% + ${startX + i * spread}px), -50%) rotate(${rot}deg) scale(${scale})`;

    setTimeout(() => {
      pfShutter();
      d.style.transition = "opacity .95s ease";
      requestAnimationFrame(() => {
        d.style.opacity = "1";
        d.classList.add("developed");
      });
    }, 1250 + i * step);
  });

  const afterFan = 1250 + n * 1000 + 1300;

  setTimeout(() => {
    pfLayer.classList.remove("on","show-title");
    pfStage.innerHTML = "";
  }, afterFan + 4000);
}

async function tick(){
  try{
    const r=await fetch(STATE_URL,{cache:"no-store"});
    const raw=await r.json();
    const j = (raw && raw.state) ? raw.state : raw;
    WIN=j.win_value||1000; betSeconds=j.bet_seconds||120;
    const phase=j.phase||"idle";
    wcRender(j.pile);
    renderStars(j.series);
    if(finishLineEl){
      const showLine = raceVisible;
      finishLineEl.classList.toggle("on", showLine);
      if(showLine) placeFinishLine();
    }
    if(phase === "running"){
      const mt = Math.max(...[1,2,3].map(i => j.lanes?.[String(i)]?.total ?? 0));
      pfApproach(mt);
    }
    if(phase === "betting" || phase === "staging"){ pfApproachClicks = 0; pfLastClick = 0; }
    if(j.photoFinish) pfRun(j.photoFinish);
    if(phase === "betting" || phase === "staging") pfShown = false;
    const foodFile = j.food_file || "Food1.png";
    const foodName = j.food_name || "food";

    if(lastPhase!==phase){
      if(phase==="betting"){
        clearWin(); gunshotFired=false; prevTotals=[0,0,0];
        catListShown=false; stagingSetup=false; lastStagingStep=0;
        bettingReady=false; raceStartDeadAirScheduled=false;
        halfwayDeadAirScheduled=false;
        resetAnnouncer(); clearDeadAirTimers();
        for(let i=1;i<=3;i++){ wrapEl[i].style.left="0%"; wrapEl[i].classList.remove("on"); imgEl[i].removeAttribute("data-cat"); }
        panel.style.display="none"; raceVisible=false; cmd.classList.add("hidden");
        if(cmdOverlay) cmdOverlay.style.display="none";
        hideLogo(); stopOrbit(); stopIdleShake();
        showLogo();
        startPrePredCountdown(30);
      }

      if(phase==="staging"){
        stopPrePredCountdown(); clearDeadAirTimers();
        if(cmdOverlay) cmdOverlay.style.display="none";
        flyOffScreen();
        setTimeout(()=>{
          orbitLayer.style.display="none";
          orbitTimer.style.opacity="1";
          catsAssigned=false;
          for(let i=0;i<3;i++){ orbitEls[i].style.transition=""; orbitEls[i].style.opacity="0"; }
          for(let i=1;i<=3;i++){
            const lane=j.lanes?.[String(i)];
            if(lane?.cat_id){ imgEl[i].src=catPngUrl(lane.cat_id); imgEl[i].setAttribute("data-cat",lane.cat_id); }
            wrapEl[i].style.transition=""; wrapEl[i].style.left="0%"; wrapEl[i].classList.add("on");
          }
          panel.style.display="block";
          raceVisible=true;
          showLogo();
          placeFinishLine();
          safePlay(audIdle);
          startIdleShake();
        }, 900);
      }

      if(phase==="running"){
        stopPrePredCountdown();
        if(cmdOverlay) cmdOverlay.style.display="none";
        stopIdleShake();
        triggerRaceStartAnnouncer();
        if(!raceStartDeadAirScheduled){
          raceStartDeadAirScheduled=true;
          scheduleRaceStartDeadAir(j.lanes, foodName);
        }
      }

      if(phase==="ended"){
        stopPrePredCountdown(); clearDeadAirTimers();
        if(cmdOverlay) cmdOverlay.style.display="none";
        cmd.classList.add("hidden"); hideCatList(); stopIdleShake();
        if(j.winner&&!winArmed) startWinTakeover(j.winner.user_display,j.winner.cat_id);
        if(j.winner) triggerWinnerAnnouncer(j.winner.user_display, j.lanes, j.winner.cat_id);
      }

      if(phase==="idle"){
        stopPrePredCountdown(); clearDeadAirTimers();
        panel.style.display="none"; raceVisible=false; cmd.classList.add("hidden");
        if(cmdOverlay) cmdOverlay.style.display="none";
        clearWin(); hideLogo(); stopOrbit(); hideCatList(); stopIdleShake();
        gunshotFired=false; prevTotals=[0,0,0]; stagingSetup=false;
        bettingReady=false; raceStartDeadAirScheduled=false;
        halfwayDeadAirScheduled=false;
        resetAnnouncer();
      }

      lastPhase=phase;
    }

    if(phase==="betting"){
      const betLeft=j.bet_left??0;
      if(!bettingReady && betLeft>0){
        bettingReady=true;
        stopPrePredCountdown();
        safePlay(audTick);
        assignFoods(foodFile);
        if(cmdOverlay) cmdOverlay.style.display="block";
        showLogo(); startOrbit();
        const _c1=j.lanes?.["1"]?.user_display||"?";
        const _c2=j.lanes?.["2"]?.user_display||"?";
        const _c3=j.lanes?.["3"]?.user_display||"?";
        triggerBettingOpenAnnouncer(_c1, _c2, _c3);
        scheduleBettingDeadAir(j.lanes, foodName);
      }
      if(bettingReady){
        orbitTimer.textContent=String(betLeft);
        updateOrbitSpeed(betLeft,betSeconds);
        const catIds=[1,2,3].map(i=>j.lanes?.[String(i)]?.cat_id||null);
        assignOrbitCats(catIds);
        if(!catListShown){
          const names=[1,2,3].map(i=>j.lanes?.[String(i)]?.user_display||null);
          if(names[0]&&names[1]&&names[2]){ catListShown=true; showCatList(names); }
        }
        _lastFlavorLanes = j.lanes;
        _lastFlavorFood  = foodName;
      }
    }

    if(phase==="staging"){
      const step=j.staging_step||0;
      if(step>=1 && lastStagingStep<1){ safePlay(audIdle); }
      if(step>=2 && lastStagingStep<2){ safePlay(audLight); }
      if(step>=3 && lastStagingStep<3){ safePlay(audLight); }
      if(step>=4 && lastStagingStep<4 && !gunshotFired){ gunshotFired=true; safePlay(audGunshot); }
      lastStagingStep=Math.max(lastStagingStep,step);
      for(let i=1;i<=3;i++){
        const lane=j.lanes?.[String(i)];
        if(lane?.cat_id&&imgEl[i].getAttribute("data-cat")!==lane.cat_id){
          imgEl[i].src=catPngUrl(lane.cat_id); imgEl[i].setAttribute("data-cat",lane.cat_id);
        }
        if(lane?.user_display&&nameEl[i]) nameEl[i].textContent=lane.user_display;
      }
    }

    if(phase==="running"){
      setLane(1,j.lanes?.["1"]); setLane(2,j.lanes?.["2"]); setLane(3,j.lanes?.["3"]);
      if(!gunshotFired){
        const totals=[1,2,3].map(i=>j.lanes?.[String(i)]?.total??0);
        if(totals.some((t,i)=>t!==prevTotals[i])){ gunshotFired=true; safePlay(audGunshot); }
        prevTotals=totals;
      }

      const totals=[1,2,3].map(i=>j.lanes?.[String(i)]?.total??0);
      const maxTotal=Math.max(...totals);
      const ranked=[0,1,2].sort((a,b)=>totals[b]-totals[a]);
      const names=[1,2,3].map(i=>j.lanes?.[String(i)]?.user_display||"?");
      const first=names[ranked[0]], second=names[ranked[1]], third=names[ranked[2]];

      if(!announcerFired1 && maxTotal>=WIN/2){
        announcerFired1=true;
        triggerHalfwayAnnouncer(first,second,third);
        scheduleHalfwayDeadAir(j.lanes, foodName);
      }
      _lastFlavorLanes = j.lanes;
      _lastFlavorFood  = foodName;
    }
  }catch(e){}
}

setInterval(tick,POLL_MS);
tick();
let engineSession = null;
async function healthWatch(){
  try{
    const r = await fetch("/health", {cache:"no-store"});
    const h = await r.json();
    if(!h || !h.sessionId) return;
    if(engineSession === null){ engineSession = h.sessionId; return; }
    if(engineSession !== h.sessionId) location.reload();
  }catch(e){}
}
healthWatch();
setInterval(healthWatch, 5000);
