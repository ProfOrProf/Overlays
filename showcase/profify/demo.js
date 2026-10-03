(function(){
  var TRACKS=[
    ['Hysteria','Muse','Prof',['#3a0d5c','#e0486b']],
    ['Feel Good Inc.','Gorillaz','Chat',['#0d3b2e','#7fe3b4']],
    ['Dreams','Fleetwood Mac','You',['#5c3a0d','#f0b13c']],
    ['Mr. Brightside','The Killers','Prof',['#0d1f5c','#6ea7db']],
    ['Kiss from a Rose','Seal','Chat',['#4a0d1c','#ff7a6b']]
  ];
  function cover(c){
    var cv=document.createElement('canvas'); cv.width=cv.height=480; var x=cv.getContext('2d');
    var g=x.createLinearGradient(0,0,480,480); g.addColorStop(0,c[0]); g.addColorStop(1,c[1]); x.fillStyle=g; x.fillRect(0,0,480,480);
    x.globalAlpha=.22; x.fillStyle='#fff';
    for(var i=0;i<6;i++){ x.beginPath(); x.arc(240,240,40+i*36,0,Math.PI*2); x.lineWidth=2; x.strokeStyle='#fff'; x.stroke(); }
    return cv.toDataURL('image/jpeg',.85);
  }
  var covers=null, t0=Date.now(), SLOT=10000;
  function now(){
    if(!covers) covers=TRACKS.map(function(t){ return cover(t[3]); });
    var i=Math.floor((Date.now()-t0)/SLOT)%TRACKS.length, t=TRACKS[i], n=TRACKS[(i+1)%TRACKS.length];
    return {ok:true, now:{title:t[0],artist:t[1],requestedBy:t[2],art:covers[i]}, next:{title:n[0],artist:n[1]}, last:null};
  }
  var real=window.fetch;
  window.fetch=function(u){ u=String(u);
    if(u.indexOf('/games/profify/widget')===0) return Promise.resolve(new Response(JSON.stringify(now()),{headers:{'Content-Type':'application/json'}}));
    return real.apply(window,arguments); };
})();
