(function(){
  var ResetP1={x:-1250,y:360,r:-18}, ResetP2={x:1250,y:360,r:18}, Base={x:0,y:0,r:0};
  var WinP1={x:680,y:0,r:0}, WinP2={x:-680,y:0,r:0};
  var FoldInMs=2200, ApproachMs=1600, PullbackMs=300, SlingMs=550, BackToStartMs=900, BetweenPauseMs=3500;
  var PreFightDelayMs=2000, PostFightBannerMs=2000, HpAnimMs=800, HpAnimPadMs=300;
  var FinishAnnounceMs=1200, KillLungeMs=550, KillLungeX=560, DeathMeltMs=5000, BET=8;
  var nonce=1; function id(){ return ++nonce; }
  function along(a,b,f){ return {x:a.x+(b.x-a.x)*f, y:a.y+(b.y-a.y)*f, r:a.r}; }
  function burst(start,count,dur,gap,peak){ var l=[]; for(var i=0;i<count;i++) l.push({delayMs:start+i*(dur+gap),durMs:dur,peak:peak}); return l; }
  var S;
  function fresh(){
    S={phase:'idle',visible:false,blackground:false,bg:'1.png',timer:0,hp:{p1:100,p2:100},hpAnimMs:HpAnimMs,
       p1:{name:'Katy',src:'Images/KatyLeftNEW.png',x:ResetP1.x,y:ResetP1.y,rot:ResetP1.r,moveMs:0,scale:1,floating:false},
       p2:{name:'Dolly',src:'Images/DollyPartonRightNEW.png',x:ResetP2.x,y:ResetP2.y,rot:ResetP2.r,moveMs:0,scale:1,floating:false},
       front:null,round:0,finishWebm:null,banner:null,bannerMs:1200,bannerNonce:0,roundText:null,roundTextMs:1800,roundTextNonce:0,
       sfx:null,sfxNonce:0,stop:null,stopNonce:0,flash:null,flashNonce:0,hitflash:false,hitflashNonce:0,disintegrate:null,vol:0};
  }
  fresh();
  var wins={p1:0,p2:0};
  function pos(side,p,ms){ S[side].x=p.x; S[side].y=p.y; S[side].rot=p.r; S[side].moveMs=ms; }
  function hp(){ var need=2; S.hp={p1:Math.round(100*Math.max(0,need-wins.p2)/need), p2:Math.round(100*Math.max(0,need-wins.p1)/need)}; }
  function wait(ms){ return new Promise(function(r){ setTimeout(r,ms); }); }
  function pickRounds(){ var o=Math.random()<.5?'P1':'P2', x=o==='P1'?'P2':'P1';
    if(Math.random()<.5) return [o,o,o]; return [[o,x,o],[x,o,o],[o,o,x]][Math.floor(Math.random()*3)]; }
  function over(){ return wins.p1>=2||wins.p2>=2; }

  async function round(n,code){
    S.phase='preround'; S.round=n; S.p1.floating=S.p2.floating=true; S.sfx='round'+n; S.sfxNonce=id();
    await wait(PreFightDelayMs);
    S.banner='fight'; S.bannerMs=1200; S.bannerNonce=id();
    await wait(PostFightBannerMs);
    var p1Win={x:Base.x+WinP1.x,y:0,r:0}, p2Win={x:Base.x+WinP2.x,y:0,r:0};
    S.phase='fight'; S.p1.floating=S.p2.floating=false; pos('p1',Base,0); pos('p2',Base,0);
    await wait(50);
    pos('p1',along(Base,p1Win,.8),ApproachMs); pos('p2',along(Base,p2Win,.8),ApproachMs);
    await wait(ApproachMs);
    pos('p1',along(Base,p1Win,.7),PullbackMs); pos('p2',along(Base,p2Win,.7),PullbackMs);
    await wait(PullbackMs);
    var p1w=code==='P1';
    pos('p1',p1w?p1Win:along(Base,p1Win,.65),SlingMs); pos('p2',p1w?along(Base,p2Win,.65):p2Win,SlingMs);
    S.front=p1w?'p1':'p2';
    S.flash=burst(Math.max(0,SlingMs-90),5,90,70,1); S.flashNonce=id();
    S.hitflash=true; S.hitflashNonce=id();
    var loser=p1w?'p2':'p1';
    (async function(){ await wait(Math.max(0,SlingMs-90)); for(var i=0;i<3;i++){ S[loser].scale=1.08; await wait(110); S[loser].scale=1; await wait(110); } })();
    await wait(SlingMs);
    if(p1w) wins.p1++; else wins.p2++; hp();
    await wait(2000);
    S.roundText='Round '+n+' — '+(p1w?S.p1.name:S.p2.name)+'!'; S.roundTextMs=2200; S.roundTextNonce=id();
    if(over()) await wait(HpAnimMs+HpAnimPadMs);
    S.phase='between'; S.p1.floating=S.p2.floating=true;
    await wait(BetweenPauseMs);
    S.p1.floating=S.p2.floating=false; S.front=null; pos('p1',Base,BackToStartMs); pos('p2',Base,BackToStartMs);
    await wait(BackToStartMs);
    S.p1.floating=S.p2.floating=true;
  }

  async function finish(){
    var p1c=wins.p1>wins.p2, champ=p1c?S.p1.name:S.p2.name, flawless=(wins.p1===2&&wins.p2===0)||(wins.p2===2&&wins.p1===0);
    S.banner=null; S.bannerNonce=id(); S.phase='finishher'; S.front=p1c?'p1':'p2';
    S.finishWebm={which:'finishher',nonce:id()};
    await wait(FinishAnnounceMs);
    S.flash=burst(0,5,100,70,1); S.flashNonce=id();
    var side=p1c?'p1':'p2'; S[side].x=p1c?KillLungeX:-KillLungeX; S[side].y=0; S.p1.moveMs=S.p2.moveMs=KillLungeMs;
    await wait(KillLungeMs);
    S.phase='fatality'; S.disintegrate={side:p1c?'p2':'p1',ms:DeathMeltMs,nonce:id()};
    await wait(DeathMeltMs);
    S.roundText=flawless?champ.toUpperCase()+' — FLAWLESS!':champ.toUpperCase()+' WINS!'; S.roundTextMs=4000; S.roundTextNonce=id();
    await wait(PostFightBannerMs);
    S.blackground=true; await wait(2000);
    S.visible=false; await wait(2000);
    S.blackground=false;
  }

  async function match(){
    fresh(); wins={p1:0,p2:0};
    S.visible=true; S.phase='intro';
    await wait(80);
    pos('p1',Base,FoldInMs); pos('p2',Base,FoldInMs);
    await wait(FoldInMs);
    S.p1.floating=S.p2.floating=true;
    S.phase='countdown'; S.timer=BET; var started=Date.now();
    var tick=setInterval(function(){ S.timer=Math.max(0,BET-Math.floor((Date.now()-started)/1000)); },200);
    await wait(BET*1000); clearInterval(tick); S.timer=0;
    var r=pickRounds();
    await round(1,r[0]); if(!over()){ await round(2,r[1]); if(!over()) await round(3,r[2]); }
    await finish();
    S.phase='idle'; S.disintegrate=null; S.roundText=null; S.finishWebm=null;
    await wait(2500);
    match();
  }

  var real=window.fetch;
  window.fetch=function(u){ u=String(u);
    if(u.indexOf('/games/fightgame/state')>=0) return Promise.resolve(new Response(JSON.stringify({state:S}),{headers:{'Content-Type':'application/json'}}));
    if(u.indexOf('/health')===0) return Promise.resolve(new Response('{}'));
    return real.apply(window,arguments); };
  HTMLMediaElement.prototype.play=function(){ return Promise.resolve(); };
  setTimeout(match,700);
})();
