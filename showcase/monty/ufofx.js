(function () {
  "use strict";
  // Frame-sequence player — DojoBackgrounds' bgcore approach, generalized to drive multiple
  // canvases off one shared worker pool. Workers fetch + createImageBitmap (decode off the
  // main thread); each sequence keeps a sliding WINDOW of decoded frames so memory is bounded.
  //   • UFO  — continuous loop, autostarts.
  //   • Explosion — one-shot, triggered by window.playExplosion(); frees its frames when done.
  // Frames are RGB (the webm's VP9 alpha can't be pulled by ffmpeg); the explosion canvas uses
  // mix-blend-mode:screen so the black background drops out and the blast comps over the scene.
  // file:// fallback (<img>+createImageBitmap) so test.html animates when opened from disk.
  var USE_WORKERS = location.protocol !== "file:";
  var WORKERS = Math.min(3, navigator.hardwareConcurrency || 3);
  var pool = [], rr = 0, routes = {};

  if (USE_WORKERS) {
    var ws = "self.onmessage=async e=>{try{const r=await fetch(e.data.url,{cache:'force-cache'});if(!r.ok)throw 0;const b=await r.blob();const m=await createImageBitmap(b);self.postMessage({id:e.data.id,i:e.data.i,m},[m]);}catch(x){self.postMessage({id:e.data.id,i:e.data.i,err:1});}};";
    var bu = URL.createObjectURL(new Blob([ws], { type: "application/javascript" }));
    for (var k = 0; k < WORKERS; k++) {
      var w = new Worker(bu);
      w.onmessage = function (e) { var d = e.data, s = routes[d.id]; if (!s) { if (d.m) d.m.close(); return; } s.pend.delete(d.i); if (d.m) s.bmps.set(d.i, d.m); };
      pool.push(w);
    }
  }

  function Seq(o) {
    var self = this;
    this.id = o.id; this.folder = o.folder; this.count = o.count; this.pad = o.pad || 4;
    this.fw = o.fw; this.fh = o.fh; this.fms = 1000 / o.fps; this.window = o.window || 120;
    this.loop = !!o.loop; this.onend = o.onend || null;
    this.bmps = new Map(); this.pend = new Set(); this.start = 0; this.playing = this.loop;
    var cv = document.getElementById(o.canvas); cv.width = this.fw; cv.height = this.fh;
    this.cv = cv; this.ctx = cv.getContext("2d", { alpha: true });
    routes[this.id] = this;

    this.url = function (i) { return new URL(self.folder + "frame_" + String(i + 1).padStart(self.pad, "0") + ".webp", location.href).href; };
    this.req = function (i) {
      if (self.bmps.has(i) || self.pend.has(i)) return;
      self.pend.add(i);
      if (USE_WORKERS) { pool[rr++ % pool.length].postMessage({ id: self.id, i: i, url: self.url(i) }); return; }
      var img = new Image(); img.decoding = "async";
      img.onload = function () { createImageBitmap(img).then(function (m) { self.pend.delete(i); self.bmps.set(i, m); }).catch(function () { self.pend.delete(i); }); };
      img.onerror = function () { self.pend.delete(i); };
      img.src = self.url(i);
    };
    this.maintain = function (c) {
      var keep = new Set();
      for (var j = 0; j < self.window; j++) {
        var x = self.loop ? ((c + j) % self.count) : (c + j);
        if (x >= self.count) break;
        keep.add(x); self.req(x);
      }
      self.bmps.forEach(function (v, key) { if (!keep.has(key)) { v.close(); self.bmps.delete(key); } });
    };
    this.prime = function () { for (var p = 0; p < Math.min(self.window, self.count); p++) self.req(p); };
    this.play = function () { self.start = 0; self.playing = true; self.prime(); };
    this.freeAll = function () { self.bmps.forEach(function (v) { v.close(); }); self.bmps.clear(); };
  }
  Seq.prototype.tick = function (now) {
    if (!this.playing) return;
    if (!this.start) this.start = now;
    var raw = Math.floor((now - this.start) / this.fms);
    if (!this.loop && raw >= this.count) {       // one-shot finished
      this.playing = false; this.ctx.clearRect(0, 0, this.fw, this.fh);
      this.freeAll(); if (this.onend) this.onend(); return;
    }
    var idx = this.loop ? (raw % this.count) : raw;
    var m = this.bmps.get(idx);
    if (m) { this.ctx.clearRect(0, 0, this.fw, this.fh); this.ctx.drawImage(m, 0, 0, this.fw, this.fh); }
    this.maintain(idx);
  };

  var seqs = [];
  function frame(now) { for (var i = 0; i < seqs.length; i++) seqs[i].tick(now); requestAnimationFrame(frame); }
  requestAnimationFrame(frame);

  // UFO — continuous spin loop, autostart.
  if (document.getElementById("ufo")) {
    var ufo = new Seq({ id: "ufo", canvas: "ufo", folder: "assets/ufo_frames/", count: 303, fps: 30, fw: 768, fh: 432, window: 120, loop: true });
    ufo.prime(); seqs.push(ufo);
  }
  // (Explosion stays a <video> — Explosion.webm is tiny + carries true alpha + its own audio.)
})();
