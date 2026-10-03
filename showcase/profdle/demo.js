(function(){
  var SAFE=['crane','slate','ghost','plant','brave','flame','storm','candy','tiger','spice','glove','bloom','frost','grape','chess','piano','quest','toast','sword','smile','cloud','beach','pearl','crown','magic','ocean','raven','lunar','haunt','blaze','shine','mango','truck','globe','sugar','dream','water','light','heart','stone'];
  var sink=null, dict={}, target='', n=0, done=true, idle=null, tried={};
  window.EventSource=function(){ sink=this; this.close=function(){}; };
  function send(m){ m.gameName='Profdle'; if(sink&&sink.onmessage) sink.onmessage({data:JSON.stringify(m)}); }
  HTMLMediaElement.prototype.play=function(){ return Promise.resolve(); };
  var known={green:{},present:{},absent:{}};
  function learn(w){
    for(var i=0;i<5;i++){ var c=w[i];
      if(target[i]===c) known.green[i]=c;
      else if(target.indexOf(c)>=0) (known.present[c]=known.present[c]||{})[i]=1;
      else known.absent[c]=1; }
  }
  function fits(w){
    for(var i in known.green) if(w[i]!==known.green[i]) return false;
    for(var c in known.absent) if(w.indexOf(c)>=0 && !Object.values(known.green).includes(c)) return false;
    for(var p in known.present){ if(w.indexOf(p)<0) return false; for(var j in known.present[p]) if(w[j]===p) return false; }
    return true;
  }
  function newGame(){
    target=SAFE[Math.floor(Math.random()*SAFE.length)]; n=0; done=false; tried={}; known={green:{},present:{},absent:{}};
    send({type:'new_game',maxGuesses:6,autoReset:true}); arm();
  }
  function arm(){ clearTimeout(idle); idle=setTimeout(autoGuess,4500); }
  function autoGuess(){
    if(done) return;
    var pool=SAFE.filter(function(w){ return !tried[w] && fits(w); });
    if(!pool.length) pool=Object.keys(dict).filter(function(w){ return !tried[w] && fits(w); }).slice(0,60);
    if(n>=4 && fits(target)) pool=[target];
    guess(pool.length?pool[Math.floor(Math.random()*pool.length)]:target);
  }
  function guess(w){
    if(done) return 'wait';
    w=String(w||'').trim().toLowerCase();
    if(w.length!==5) return 'five';
    if(!dict[w]&&SAFE.indexOf(w)<0){ send({type:'invalid_guess'}); return 'word'; }
    if(tried[w]) return 'used';
    tried[w]=1; n++; learn(w);
    var won=w===target, lost=!won&&n>=6;
    send({type:'guess',word:w,targetWord:target,guessNumber:n,won:won,lost:lost});
    if(won||lost){ done=true; clearTimeout(idle); setTimeout(newGame,11500); }
    else arm();
    return won?'won':'ok';
  }
  window.__pdGuess=guess;
  fetch('words/en.txt').then(function(r){return r.text();}).then(function(t){
    t.split(/\r?\n/).forEach(function(w){ w=w.trim().toLowerCase(); if(w.length===5) dict[w]=1; });
    setTimeout(newGame,700);
  });
  document.addEventListener('DOMContentLoaded',function(){
    var f=document.createElement('form'); f.id='guessBox';
    f.innerHTML='<label for="pdIn">!guess</label><input id="pdIn" autocomplete="off" maxlength="5" placeholder="5 letters"><button type="submit">Guess</button><span id="pdMsg"></span>';
    document.body.appendChild(f);
    var i=f.querySelector('input'), m=f.querySelector('#pdMsg');
    var copy={five:'5 letters',word:'Not a word',used:'Already tried',won:'Got it!',wait:'Next word soon'};
    f.addEventListener('submit',function(e){ e.preventDefault(); var r=guess(i.value); m.textContent=copy[r]||''; i.value=''; setTimeout(function(){ m.textContent=''; },1600); });
  });
})();
