(function(){
  var words=[], S={phase:'idle'}, phrase='', guessed=[], wrong=0, MAX=6, idleT=null, solver='';
  var ORDER='ETAOINSRHLDCUMFPGWYBVKXJQZ'.split('');
  function masked(){ return phrase.split('').map(function(c){ return c===' '?' ':(guessed.indexOf(c)>=0?c:'_'); }).join(''); }
  function sync(){ S={phase:S.phase,wrongCount:wrong,maxWrong:MAX,masked:masked(),guessedLetters:guessed.slice(),phrase:S.phase==='active'?'':phrase.replace(/ /g,'_'),solver:solver,phraseGuess:S.phraseGuess||false}; }
  function solved(){ return phrase.split('').every(function(c){ return c===' '||guessed.indexOf(c)>=0; }); }
  function start(){
    phrase=words[Math.floor(Math.random()*words.length)].toUpperCase(); guessed=[]; wrong=0; solver='';
    S.phase='active'; S.phraseGuess=false; sync(); arm();
  }
  function end(ph){ S.phase=ph; sync(); clearTimeout(idleT); setTimeout(function(){ S.phase='idle'; sync(); setTimeout(start,1500); },7000); }
  function arm(){ clearTimeout(idleT); idleT=setTimeout(function(){ autoGuess(); },1800); }
  function autoGuess(){
    if(S.phase!=='active') return;
    for(var i=0;i<ORDER.length;i++){ if(guessed.indexOf(ORDER[i])<0){ guess(ORDER[i],'Chat'); return; } }
  }
  function guess(g,who){
    if(S.phase!=='active') return 'wait';
    g=String(g||'').trim().toUpperCase().replace(/[^A-Z ]/g,'');
    if(!g) return 'empty';
    if(g.length>1){
      if(g===phrase){ phrase.split('').forEach(function(c){ if(c!==' '&&guessed.indexOf(c)<0) guessed.push(c); }); solver=who; S.phraseGuess=true; end('won'); return 'solved'; }
      wrong++; sync(); if(wrong>=MAX) end('lost'); else arm(); return 'nope';
    }
    if(guessed.indexOf(g)>=0) return 'used';
    guessed.push(g);
    if(phrase.indexOf(g)<0) wrong++;
    sync();
    if(solved()){ solver=who; end('won'); return 'solved'; }
    if(wrong>=MAX){ end('lost'); return 'lost'; }
    arm(); return phrase.indexOf(g)>=0?'hit':'miss';
  }
  window.__hmGuess=function(g){ return guess(g,'You'); };
  var real=window.fetch;
  window.fetch=function(u){ u=String(u);
    if(u==='state'||u.split('?')[0].slice(-6)==='/state') return Promise.resolve(new Response(JSON.stringify({state:S}),{headers:{'Content-Type':'application/json'}}));
    return real.apply(window,arguments); };
  window.Audio=function(){ return {play:function(){return Promise.resolve();},preload:''}; };
  real('phrases.txt').then(function(r){return r.text();}).then(function(t){
    words=t.split(/\r?\n/).map(function(s){return s.trim();}).filter(function(s){return /^[A-Za-z ]{4,}$/.test(s);});
    setTimeout(start,800);
  });
})();
