(function(){
  var subs=[];
  window.EventSource=function(){ var self=this; subs.push(self); this.close=function(){}; };
  window.__push=function(msg){ subs.forEach(function(s){ if(s.onmessage) s.onmessage({data:JSON.stringify(msg)}); }); };
  var real=window.fetch;
  window.fetch=function(u){ u=String(u); if(u.indexOf('Images/')===0||u.indexOf('/games/')>=0||u.indexOf('127.0.0.1')>=0) return Promise.resolve(new Response('{}',{status:404})); return real.apply(window,arguments); };
})();
