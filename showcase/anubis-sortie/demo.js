(function(){
  var CALLS=[['RAVEN',500,'yes'],['STEEL HAZE',300,'yes'],['RUSTY',250,'no'],['MICHIGAN',800,'yes'],['CHATTY',150,'no'],['IGUAZU',400,'yes'],['V.IV',600,'yes']];
  var BOSS='BALTEUS';
  var T_IDLE=5, T_DEP=14, T_SORTIE=10, T_DONE=8, CYCLE=T_IDLE+T_DEP+T_SORTIE+T_DONE;
  var t0=Date.now();
  function state(){
    var e=(Date.now()-t0)/1000, n=Math.floor(e/CYCLE), t=e%CYCLE;
    if(t<T_IDLE) return {phase:'idle'};
    t-=T_IDLE;
    var base={eventId:n+1,boss:BOSS};
    function roster(k){ var d=CALLS.slice(0,k).map(function(c){return {display:c[0],bet:c[1],vote:c[2]};}); return d; }
    function pool(d){ return d.reduce(function(a,b){return a+b.bet;},0); }
    if(t<T_DEP){ var k=Math.min(CALLS.length,Math.floor(t/1.6)); var d=roster(k);
      return Object.assign(base,{phase:'deploying',deployLeft:Math.ceil(T_DEP-t),deployers:d,deployCount:d.length,pool:pool(d)}); }
    t-=T_DEP; var all=roster(CALLS.length);
    if(t<T_SORTIE) return Object.assign(base,{phase:'sortie',deployers:all,deployCount:all.length,pool:pool(all)});
    return Object.assign(base,{phase:'complete',resultWin:true,deployers:all,deployCount:all.length,pool:pool(all)});
  }
  var real=window.fetch;
  window.fetch=function(u){ u=String(u);
    if(u.indexOf('/games/sortie/state')>=0) return Promise.resolve(new Response(JSON.stringify({state:state()}),{headers:{'Content-Type':'application/json'}}));
    return real.apply(window,arguments); };
  window.Audio=function(){ return {play:function(){return Promise.resolve();}}; };
})();
