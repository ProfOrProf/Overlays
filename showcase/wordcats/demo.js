(function(){
  var LETTERS = 'CATRSPOE';
  var LANES = [['C1','Prof'],['C4','Chat'],['C7','Lurker']];
  var WIN = 1000;
  var T_BET = 9, T_STAGE = 5, T_RUN = 22, T_END = 13;
  var CYCLE = T_BET + T_STAGE + T_RUN + T_END;
  var AUTO = ['CAT','RATS','STOP','PEST','CROPS','TOES','CAPE','SPORE','TACO','POSE','CARTS','ROPE'];
  var t0 = Date.now(), lastCycle = -1, recent = [], found = 0, boost = [0,0,0], autoIdx = 0, lastAuto = 0, used = {};
  var PF = /[?&]capture/.test(location.search) ? null : {shots:[
    {url:'pf/shot1.jpg', atMs:1}, {url:'pf/shot2.jpg', atMs:2}, {url:'pf/final_shot3.jpg', atMs:3}
  ]};

  function reset(){ recent = []; found = 0; boost = [0,0,0]; autoIdx = 0; lastAuto = 0; used = {}; }

  function addWord(word, lane, user){
    word = word.toUpperCase();
    if (used[word]) return false;
    used[word] = true; found++;
    boost[lane] += 45 + word.length * 12;
    recent.push({word: word, user: user, atMs: Date.now()});
    if (recent.length > 12) recent.shift();
    return true;
  }
  window.__wcGuess = function(word){
    word = String(word || '').trim().toUpperCase();
    if (word.length < 3) return 'short';
    var pool = LETTERS.split('');
    for (var i = 0; i < word.length; i++) { var k = pool.indexOf(word[i]); if (k < 0) return 'letters'; pool.splice(k, 1); }
    return addWord(word, 2, 'You') ? 'ok' : 'used';
  };

  function base(t){ return Math.min(WIN, Math.round(t * t * 1.55 + t * 9)); }

  function state(){
    var e = (Date.now() - t0) / 1000, n = Math.floor(e / CYCLE), t = e % CYCLE;
    if (n !== lastCycle) { lastCycle = n; reset(); }
    var lanes = {};
    LANES.forEach(function(l, i){ lanes[String(i + 1)] = {cat_id: l[0], user_display: l[1], total: 0}; });
    var s = {win_value: WIN, bet_seconds: T_BET, food_file: 'Food1.png', food_name: 'tuna', lanes: lanes};
    if (t < T_BET) { s.phase = 'betting'; s.bet_left = Math.ceil(T_BET - t); return s; }
    t -= T_BET;
    if (t < T_STAGE) { s.phase = 'staging'; s.staging_step = Math.min(4, 1 + Math.floor(t / 1.2)); return s; }
    t -= T_STAGE;
    var run = Math.min(t, T_RUN);
    if (t < T_RUN && run - lastAuto > 1.6 && autoIdx < AUTO.length) {
      lastAuto = run; addWord(AUTO[autoIdx], autoIdx % 2, LANES[autoIdx % 2][1]); autoIdx++;
    }
    var pace = [1.0, 0.93, 0.9];
    var totals = [0,1,2].map(function(i){ return Math.min(WIN, Math.round(base(run) * pace[i] * 0.62 + boost[i])); });
    totals[0] = Math.max(totals[0], totals[1] + 1, totals[2] + 1);
    [0,1,2].forEach(function(i){ lanes[String(i + 1)].total = totals[i]; });
    s.pile = {letters: LETTERS, found: found, total: 40, recent: recent.slice()};
    var done = totals[0] >= WIN || t >= T_RUN;
    if (!done) { s.phase = 'running'; return s; }
    lanes['1'].total = WIN;
    s.phase = 'ended';
    s.winner = {user_display: LANES[0][1], cat_id: LANES[0][0]};
    if (PF) s.photoFinish = PF;
    return s;
  }

  var real = window.fetch;
  window.fetch = function(u){
    u = String(u);
    if (u.indexOf('/games/wordcats/state') >= 0) return Promise.resolve(new Response(JSON.stringify({state: state()}), {headers: {'Content-Type': 'application/json'}}));
    if (u.indexOf('/health') === 0) return Promise.resolve(new Response('ok'));
    if (u.indexOf('/games/') >= 0 || u.indexOf('127.0.0.1') >= 0) return Promise.resolve(new Response('{}', {status: 404}));
    return real.apply(window, arguments);
  };
})();
