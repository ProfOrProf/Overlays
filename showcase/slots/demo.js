(function(){
  var sink=null;
  window.EventSource=function(){ sink=this; this.close=function(){}; };
  function send(m){ if(sink&&sink.onmessage) sink.onmessage({data:JSON.stringify(m)}); }
  var busy=false, first=true;
  function r(n){ return Math.floor(Math.random()*n); }
  function num(){ return String(1+r(7)); }
  function shuffle(a){ for(var i=a.length-1;i>0;i--){ var j=r(i+1), t=a[i]; a[i]=a[j]; a[j]=t; } return a; }
  function other(n){ var o; do{ o=num(); }while(o===n); return o; }
  function outcome(){
    var roll=r(100);
    if(roll<3){ var n=num(); return {kind:'jackpot', syms:shuffle(['x10','x100',n+'c']), mult:null}; }
    if(roll<41){ var a=num(), b=other(a), c; do{ c=num(); }while(c===a||c===b); return {kind:'loss', syms:shuffle([a+'a',b+'b',c+'c'])}; }
    if(roll<64){ var n2=num(); return {kind:'ldw', syms:shuffle([n2+'a',n2+'b',other(n2)+'c'])}; }
    if(roll<90){ var n3=num(); return {kind:'win', syms:shuffle([n3+'a',n3+'b',other(n3)+'a']), mult:null, ratio:1.5}; }
    var n4=num(); return {kind:'win', syms:shuffle([n4+'a',n4+'b',n4+'c']), mult:null, ratio:4};
  }
  window.__pull=function(){
    if(busy) return; busy=true;
    var o=outcome(), bet=100;
    send(first?{type:'show',user:'You',bet:bet}:{type:'nextuser',user:'You',bet:bet}); first=false;
    setTimeout(function(){ send({type:'spin',symbols:o.syms,durationMs:3200,staggerMs:450,jackpot:o.kind==='jackpot',multiplier:o.mult||null,multipliers:o.kind==='jackpot'?[10,100]:[]}); }, 700);
    setTimeout(function(){
      if(o.kind==='jackpot') send({type:'jackpot',winnings:bet*1000});
      else if(o.kind==='win') send({type:'win',winnings:bet*o.ratio});
      else send({type:o.kind});
      setTimeout(function(){ busy=false; var b=document.getElementById('pullBtn'); if(b) b.disabled=false; }, 2200);
    }, 700+3200+900+120);
  };
  document.addEventListener('DOMContentLoaded',function(){
    var b=document.createElement('button'); b.id='pullBtn'; b.type='button'; b.textContent='PULL';
    b.addEventListener('click',function(){ b.disabled=true; window.__pull(); });
    document.body.appendChild(b);
    setTimeout(function(){ b.disabled=true; window.__pull(); }, 900);
  });
})();
