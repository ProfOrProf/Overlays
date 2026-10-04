(function(){
  var ROSTER=[[25,'Pikachu'],[1,'Bulbasaur'],[4,'Charmander'],[7,'Squirtle'],[133,'Eevee'],[39,'Jigglypuff'],[94,'Gengar'],[52,'Meowth'],[143,'Snorlax'],[54,'Psyduck'],[150,'Mewtwo'],[151,'Mew']];
  var SIL=9000, REV=5500, GAP=1200, CYCLE=SIL+REV+GAP, t0=Date.now()+600;
  function state(){
    var e=Date.now()-t0; if(e<0) return {phase:'idle'};
    var n=Math.floor(e/CYCLE), t=e%CYCLE, p=ROSTER[n%ROSTER.length];
    var base={roundId:n+1,pokemonId:p[0],name:p[1],sprite:location.pathname.replace(/[^/]*$/,'')+'sprites/'+p[0]+'.svg',cry:location.pathname.replace(/[^/]*$/,'')+'cries/'+p[0]+'.ogg',introWav:location.pathname.replace(/[^/]*$/,'')+'assets/WhosThatPokemon.mp3',introDelayMs:3000,roundStartedMs:t0+n*CYCLE,durationMs:SIL};
    if(t<SIL){ base.phase='silhouette'; return base; }
    if(t<SIL+REV){ base.phase='revealed'; return base; }
    return {phase:'idle'};
  }
  var real=window.fetch;
  window.fetch=function(u){ u=String(u);
    if(u.indexOf('/games/whosthatpokemon/state')>=0){ var s=state(); window.__wtp=s; return Promise.resolve(new Response(JSON.stringify({state:s}),{headers:{'Content-Type':'application/json'}})); }
    if(u.indexOf('/health')===0) return Promise.resolve(new Response('{}'));
    return real.apply(window,arguments); };
  document.addEventListener('DOMContentLoaded',function(){
    var n=document.createElement('div'); n.id='wtpName'; document.body.appendChild(n);
    setInterval(function(){ var s=window.__wtp||{}; if(s.phase==='revealed'){ if(n.textContent!==s.name) n.textContent=s.name; n.classList.add('on'); } else n.classList.remove('on'); },100);
  });
})();
