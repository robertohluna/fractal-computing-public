/* Site-wide browser behavior, loaded by partials/_head.ejs on every page.
   Theme: the site is dark unless the reader picks light with the toggle; the choice is
   kept in localStorage (applied before first paint by an inline script in _head.ejs).
   Menu: on narrow screens the navigation links move into a drawer opened by the menu
   button. Videos marked data-play-visible play (muted) only while on screen and pause
   when scrolled away; a reader who pauses one keeps it paused. Timelines marked
   data-animate draw their line down to each milestone in turn the first time they come
   into view (see .timeline[data-animate] in style_site.css).
   Page furniture added here, all of it only an enhancement of content that is already in
   the page: blocks fade in as they scroll into view, stat figures count up, cards light up
   under the pointer, the migration path draws a beam through its stages, the comparison
   table draws bars for its exact figures, the home page's risk section plays one bad
   write against source systems and against the twin, and its results become an industry
   explorer. Readers who ask for reduced motion get every one of these in its final state. */
(function(){
  var root = document.documentElement;

  /* FractalScene: small cubes in 3D on a canvas, shared by the home hero and the How It Works
     architecture. A scene is a set of pieces and named formations (where each piece is, how big,
     how turned, how opaque); render(from, to, u, t) draws the change from one formation to
     another at progress u (from === to holds a formation; t keeps holds alive). Plain 3D maths:
     rotate, project with a little perspective, light from the upper left, paint far to near,
     a lit edge on each piece's top, and optionally a faint reflection on a floor. cfg:
     {pieces, formations, colorOf(f, v, n, lit), order(from, to, v) -> delay, cam {name: [yaw,
     pitch, fit, centre x]}, reflect, floor(from, to, ku, hold), extras(ctx, info), labels(info)}. */
  function hex (c) { c = c.replace('#', ''); return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)] }
  function mix (a, b, k) { return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k] }
  function ramp (stops, k) { k = clamp01(k) * (stops.length - 1); var i = Math.min(stops.length - 2, Math.floor(k)); return mix(stops[i], stops[i + 1], k - i) }
  function rnd (i, k) { var x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x) }
  function ease (k) { return k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2 }
  var PAL = {
    TOP: ['#2447ff', '#3a7dff', '#38b8f4', '#44f0c0'].map(hex), FRONT: ['#c2009c', '#ee22c4', '#ff55d4', '#ff9fdf'].map(hex),
    SIDE: ['#5a1dbf', '#8329e0', '#a446ff'].map(hex), MINT: ['#44f0c0', '#4cf59a', '#7dfa82', '#b5ff8f'].map(hex),
    AMBER: ['#ffb27a', '#ffcb8f', '#ffe2b8'].map(hex), FALL: ['#f03ccc', '#c46cff', '#aeb0ff', '#6cc4ff'].map(hex),
    SPEC: ['#ff4fd8', '#a35cff', '#3d6bff', '#38c6f4', '#44f5b8'].map(hex)
  };
  function logoFace (q, n) {                                              // the logo's colours on a 3 x 3 x 3 cube (q: -1..1 per axis)
    if (n[1] > 0) return ramp(PAL.TOP, (q[0] + 1) / 2 * .6 + (1 - (q[2] + 1) / 2) * .4);
    if (n[2] > 0) return ramp(PAL.FRONT, (q[1] + 1) / 2 * .55 + (q[0] + 1) / 2 * .45);
    if (n[0] > 0) return ramp(PAL.SIDE, (q[1] + 1) / 2 * .8 + (1 - (q[2] + 1) / 2) * .2);
    return ramp(PAL.SIDE, .1);
  }
  function logoTrails () {                                                // the logo's three trails: mint off the top, amber up the left, magenta to sky below
    var out = [];
    function along (n, s0, f, step) { var r = [], x = 0, s = s0; for (var k = 0; k < n; k++) { r.push({d: x, s: s}); x += (s + s * f) / 2 * step; s *= f } return r }
    [[-1, 6], [0, 5], [1, 3]].forEach(function(r){ along(r[1], .78, .76, 1.4).forEach(function(q, k){ out.push({p: [2.2 + q.d, 1.3 + .5 - .5 * q.s, r[0] * 1.3 - .12 * k], s: q.s, col: ramp(PAL.MINT, (k + 1) / r[1])}) }) });
    [[-2.45, 5, .1], [-3.2, 4, 1.4]].forEach(function(r){ along(r[1], .55, .78, 1.55).forEach(function(q, k){ out.push({p: [r[0] - .1 * k, r[2] + q.d, 1.3 + .5 - .5 * q.s], s: q.s, col: ramp(PAL.AMBER, k / r[1])}) }) });
    [-1, 0, 1].forEach(function(c){ along(5, .76, .74, 1.45).forEach(function(q, k){ out.push({p: [c * 1.3 - .38 * (k + 1), -1.3 - .95 - q.d, 1.3 + .5 - .5 * q.s], s: q.s, col: ramp(PAL.FALL, k / 4)}) }) });
    return out;
  }
  function FractalScene (cv, cfg) {
    var ctx = cv.getContext('2d'), w = 0, h = 0, px = 0, py = 0, tx = 0, ty = 0, resized = [];
    var FACES = [[0, 1, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]], LIGHT = [-.42, .72, .55], BG, LM;
    function theme () { BG = hex(getComputedStyle(root).getPropertyValue('--bg').trim() || '#0a0c10'); LM = root.getAttribute('data-theme') === 'light' }
    theme(); document.addEventListener('themechange', theme);
    function size () {
      w = cv.clientWidth; h = cv.clientHeight;
      var dpr = Math.min(window.devicePixelRatio || 1, 1.5, Math.sqrt(1.6e6 / Math.max(1, w * h)));   // sharp enough, and never more than ~1.6M pixels a frame
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.lineJoin = 'round';
    }
    size();
    if (window.ResizeObserver) new ResizeObserver(function(){ size(); resized.forEach(function(f){ f() }) }).observe(cv);
    function own (q, o) {
      var cx = Math.cos(o[0]), sx = Math.sin(o[0]), y1 = q[1] * cx - q[2] * sx, z1 = q[1] * sx + q[2] * cx, cY = Math.cos(o[1]), sY = Math.sin(o[1]);
      return [q[0] * cY + z1 * sY, y1, -q[0] * sY + z1 * cY];
    }
    function render (from, to, u, t, opt) {
      opt = opt || {};
      ctx.clearRect(0, 0, w, h);
      px += (tx - px) * .05; py += (ty - py) * .05;
      var hold = from === to, ku = hold ? 0 : ease(u), A0 = cfg.cam[from], B0 = cfg.cam[to];
      var yaw = A0[0] + (B0[0] - A0[0]) * ku + .05 * Math.sin(t / 6000) + px * .16 + (opt.yaw || 0), pitch = A0[1] + (B0[1] - A0[1]) * ku - py * .08 + (opt.pitch || 0);
      var cxw = (A0[3] || 0) + ((B0[3] || 0) - (A0[3] || 0)) * ku;
      var cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      var box = cfg.box || [1, 1], fit = A0[2] + (B0[2] - A0[2]) * ku, sc = Math.min(w / box[0], h / box[1]) / (2 * fit) * .96, ox = w * (cfg.origin || .5), oy = h * .5, FOV = 40;
      function rot (p) { var x = p[0] - cxw, X = x * cy + p[2] * sy, Z = -x * sy + p[2] * cy; return [X, p[1] * cp - Z * sp, p[1] * sp + Z * cp] }
      var lift = (opt.lift || 0) * sc;
      function proj (r) { var k = FOV / (FOV - r[2]); return [ox + r[0] * sc * k, oy - r[1] * sc * k - lift] }
      var ru = hold ? u : null, F = cfg.formations;
      var items = cfg.pieces.map(function(v){
        var A = F[from](v, t, ru), B = F[to](v, t, ru), k = 0;
        if (!hold) { var dl = cfg.order ? cfg.order(from, to, v) : 0; k = ease(clamp01((u - dl) / .6)) }
        var arc = A.arc || B.arc ? Math.sin(Math.PI * k) * (B.arc || A.arc) : 0;
        var p = [0, 1, 2].map(function(j){ return A.p[j] + (B.p[j] - A.p[j]) * k + (j === 1 ? arc : 0) });
        var oA = A.o || [0, 0], oB = B.o || [0, 0], aA = A.a == null ? 1 : A.a, aB = B.a == null ? 1 : B.a;
        return {v: v, c: p, s: A.s + (B.s - A.s) * k, o: [oA[0] + (oB[0] - oA[0]) * k, oA[1] + (oB[1] - oA[1]) * k], r: rot(p), k: k,
                a: aA + (aB - aA) * clamp01(k * 1.6), lit: B.lit != null ? B.lit : A.lit, glow: (A.glow || 0) + ((B.glow || 0) - (A.glow || 0)) * k};
      });
      if (opt.push) {                                                       // pieces near the pointer move outward, easing back when it leaves
        var R = Math.min(w, h) * .14, P = opt.pointer;
        items.forEach(function(it){
          var target = 0;
          if (P) { var q = proj(it.r), d = Math.hypot(q[0] - P[0], q[1] - P[1]); target = d < R ? Math.pow(1 - d / R, 2) : 0 }
          var v = it.v; v._pu = (v._pu || 0) + (target - (v._pu || 0)) * .14;
          if (v._pu > .002) {
            var c = it.c, l = Math.hypot(c[0] - cxw, c[1], c[2]) || 1, m = v._pu * 1.3;
            it.c = [c[0] + (c[0] - cxw) / l * m, c[1] + c[1] / l * m, c[2] + c[2] / l * m]; it.r = rot(it.c);
          }
        });
      }
      items.sort(function(a, b){ return a.r[2] - b.r[2] });
      var floor = cfg.floor ? cfg.floor(from, to, ku, hold) : -3;
      var info = {from: from, to: to, u: u, ku: ku, hold: hold, t: t, items: items, rot: rot, proj: proj, sc: sc, w: w, h: h, light: LM};
      function paint (it, mirror) {
        if (it.a <= .01) return;
        var half = .5 * it.s, inset = .84;
        FACES.forEach(function(n){
          var on = own(n, it.o);
          var nn = (function(){ var X = on[0] * cy + on[2] * sy, Z = -on[0] * sy + on[2] * cy, Y = mirror ? -on[1] : on[1]; return [X, Y * cp - Z * sp, Y * sp + Z * cp] })();   // the face's normal, turned by the camera
          if (nn[2] <= .02) return;
          var a = n[0] ? [0, 1, 0] : [1, 0, 0], b = n[2] ? [0, 1, 0] : [0, 0, 1];
          if (n[1]) { a = [1, 0, 0]; b = [0, 0, 1] }
          var pts = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(function(q){
            var l = own([(n[0] + (a[0] * q[0] + b[0] * q[1]) * inset) * half, (n[1] + (a[1] * q[0] + b[1] * q[1]) * inset) * half, (n[2] + (a[2] * q[0] + b[2] * q[1]) * inset) * half], it.o);
            var wp = [it.c[0] + l[0], it.c[1] + l[1], it.c[2] + l[2]];
            if (mirror) wp[1] = 2 * floor - wp[1];
            return proj(rot(wp));
          });
          var col = mix(cfg.colorOf(from, it.v, n, it.lit), cfg.colorOf(to, it.v, n, it.lit), it.k), dl = nn[0] * LIGHT[0] + nn[1] * LIGHT[1] + nn[2] * LIGHT[2];
          var lit = .58 + .42 * Math.max(0, dl), fog = LM ? 0 : clamp01((3 - it.r[2]) / 11) * .32;
          col = mix(col.map(function(c){ return Math.min(255, c * (lit + .1)) }), BG, fog);
          if (it.glow) col = mix(col, [255, 255, 255], it.glow);
          ctx.fillStyle = ctx.strokeStyle = 'rgb(' + (col[0] | 0) + ',' + (col[1] | 0) + ',' + (col[2] | 0) + ')';
          ctx.globalAlpha = it.a * (mirror ? (LM ? .035 : .08) * clamp01(1 - (it.c[1] - floor) / 5) : 1);
          ctx.lineWidth = Math.max(1, sc * it.s * .07);
          ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
          for (var i = 1; i < 4; i++) ctx.lineTo(pts[i][0], pts[i][1]);
          ctx.closePath(); ctx.fill(); ctx.stroke();
          if (!mirror && nn[2] > .3) {
            var top = pts[0][1] + pts[1][1] < pts[2][1] + pts[3][1] ? [pts[0], pts[1]] : [pts[2], pts[3]];
            ctx.globalAlpha = (.16 + .26 * Math.max(0, dl)) * (1 - fog) * it.a;
            ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(1, sc * it.s * .03);
            ctx.beginPath(); ctx.moveTo(top[0][0], top[0][1]); ctx.lineTo(top[1][0], top[1][1]); ctx.stroke();
          }
        });
      }
      if (cfg.reflect && LM) {                                             // on a light page: a soft contact shadow on the floor grounds the pieces
        var gp = proj(rot([cxw, floor, 0])), sx = sc * fit * .9, sh = ctx.createRadialGradient(gp[0], gp[1], 0, gp[0], gp[1], sx);
        sh.addColorStop(0, 'rgba(20,24,40,.22)'); sh.addColorStop(.55, 'rgba(20,24,40,.08)'); sh.addColorStop(1, 'rgba(20,24,40,0)');
        ctx.save(); ctx.translate(gp[0], gp[1]); ctx.scale(1, .26); ctx.translate(-gp[0], -gp[1]);
        ctx.globalAlpha = 1; ctx.fillStyle = sh; ctx.beginPath(); ctx.arc(gp[0], gp[1], sx, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      } else if (cfg.reflect) {
        items.forEach(function(it){ paint(it, true) });
        var fy = proj(rot([cxw, floor, 0]))[1], g = ctx.createLinearGradient(0, fy, 0, fy + sc * 4);
        g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,1)');
        ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.fillRect(0, fy, w, h - fy); ctx.restore();
      }
      if (cfg.under) cfg.under(ctx, info);
      if (cfg.extras) cfg.extras(ctx, info);
      items.forEach(function(it){ paint(it, false) });
      if (cfg.labels) cfg.labels(ctx, info);
      ctx.globalAlpha = 1;
    }
    return {render: render, tilt: function(x, y){ tx = x; ty = y }, onResize: function(f){ resized.push(f) }, size: function(){ return [w, h] }};
  }
  FractalScene.util = {hex: hex, mix: mix, ramp: ramp, rnd: rnd, ease: ease, palette: PAL, logoFace: logoFace, logoTrails: logoTrails};
  window.FractalScene = FractalScene;
  function clamp01 (v) { return v < 0 ? 0 : v > 1 ? 1 : v }
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasIO = 'IntersectionObserver' in window;
  function isDark () { return root.getAttribute('data-theme') !== 'light' }
  function css (name) { return getComputedStyle(root).getPropertyValue(name).trim() }
  function onView (el, cb, opts) {                                     // cb(true/false) as el enters/leaves the viewport
    if (!hasIO) return cb(true);
    new IntersectionObserver(function(es){ es.forEach(function(e){ cb(e.isIntersecting, e) }) }, opts || {}).observe(el);
  }

  document.addEventListener('DOMContentLoaded', function(){
    var themeBtn = document.getElementById('themeBtn');
    if (themeBtn) themeBtn.addEventListener('click', function(){
      var t = isDark() ? 'light' : 'dark';
      root.setAttribute('data-theme', t);
      try { localStorage.setItem('theme', t) } catch (e) {}
      document.dispatchEvent(new CustomEvent('themechange'));
    });

    var nav = document.querySelector('.site-nav');                     // clear over the top of the page, frosted once scrolled
    if (nav) {
      var navState = function(){ nav.classList.toggle('scrolled', window.scrollY > 8) };
      window.addEventListener('scroll', navState, {passive: true}); navState();
    }
    document.querySelectorAll('.nav-menu > button').forEach(function(b){  // Company menu: hover or focus on a desktop, a tap on touch
      var m = b.parentNode;
      b.addEventListener('click', function(){ var o = !m.classList.contains('open'); m.classList.toggle('open', o); b.setAttribute('aria-expanded', o ? 'true' : 'false') });
      document.addEventListener('click', function(e){ if (!m.contains(e.target)) { m.classList.remove('open'); b.setAttribute('aria-expanded', 'false') } });
      document.addEventListener('keydown', function(e){ if (e.key === 'Escape') { m.classList.remove('open'); b.setAttribute('aria-expanded', 'false') } });
    });

    var menuBtn = document.getElementById('menuBtn'), drawer = document.getElementById('navDrawer');
    function setMenu (open) {
      drawer.classList.toggle('open', open);
      menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    if (menuBtn && drawer) {
      menuBtn.addEventListener('click', function(){ setMenu(!drawer.classList.contains('open')) });
      drawer.addEventListener('click', function(e){ if (e.target.closest('a')) setMenu(false) });
      window.addEventListener('resize', function(){ if (window.innerWidth > 940) setMenu(false) });
      document.addEventListener('keydown', function(e){ if (e.key === 'Escape') setMenu(false) });
    }

    document.querySelectorAll('.video video').forEach(function(v){         // an industry video this copy can't load (the live site serves them) hides itself and its link
      function gone () {
        var box = v.closest('.video'); box.hidden = true;
        document.querySelectorAll('.sol-toc a[href="#' + box.id + '"]').forEach(function(a){ a.hidden = true });
      }
      if (v.error) gone(); else v.addEventListener('error', gone);
    });

    var vids = document.querySelectorAll('video[data-play-visible]');
    if (vids.length && hasIO) {
      var io = new IntersectionObserver(function(entries){
        entries.forEach(function(en){
          var v = en.target;
          if (en.isIntersecting) { if (!v._userPaused && v.paused) { var p = v.play(); if (p) p.catch(function(){}) } }
          else if (!v.paused) { v._autoPause = true; v.pause() }
        });
      }, {threshold: 0.25});                                            // "visible" = at least a quarter of the video on screen
      vids.forEach(function(v){
        v.addEventListener('pause', function(){ if (v._autoPause) v._autoPause = false; else v._userPaused = true });   // a pause we didn't make is the reader's
        v.addEventListener('play',  function(){ v._userPaused = false });
        io.observe(v);
      });
    }

    document.querySelectorAll('.timeline[data-animate]').forEach(function(tl){
      var lis = Array.prototype.slice.call(tl.children), done = false;
      function stops () { return lis.map(function(li){ return li.offsetTop + 12 }) }          // each dot's center, from the top of the track
      function finish () { var s = stops(); done = true; tl.style.setProperty('--tl-p', s[s.length - 1] + 'px'); lis.forEach(function(li){ li.classList.add('on') }) }
      function run () {
        var s = stops(), end = s[s.length - 1], D = 750 * lis.length, t0 = null;
        function step (now) {
          if (t0 === null) t0 = now;
          var k = Math.min(1, (now - t0) / D), h = end * (1 - Math.pow(1 - k, 2));            // ease out
          tl.style.setProperty('--tl-p', h + 'px');
          lis.forEach(function(li, i){ if (h >= s[i] - 1) li.classList.add('on') });
          if (k < 1) requestAnimationFrame(step); else done = true;
        }
        requestAnimationFrame(step);
      }
      window.addEventListener('resize', function(){ if (done) finish() });                      // text rewraps, so the dots move
      if (reduce || !hasIO) return finish();
      var tio = new IntersectionObserver(function(entries){
        if (!entries.some(function(en){ return en.isIntersecting })) return;
        tio.disconnect(); run();
      }, {threshold: 0.35});
      tio.observe(tl);
    });

    catalog(); arrows(); revealWords(); changes(); faceoff(); race(); solSheets(); localNav(); reveal(); counters(); spotlight(); pathBeam(); magnitude(); ripples(); tableLabels(); heroGrid(); explorer(); footField(); voxelHero(); voxelSystem();
  });

  /* The arrow that ends many link and button labels ("Schedule a call →") goes into its
     own span, so it can slide on hover. The label text itself is unchanged. */
  function arrows () {
    document.querySelectorAll('a.btn, a.more, .xref a, a .go, .foot-col a, .ask a').forEach(function(a){
      var n = a.lastChild;
      while (n && n.nodeType === 3 && !n.nodeValue.trim()) n = n.previousSibling;
      if (!n || n.nodeType !== 3) return;
      var m = n.nodeValue.match(/^([\s\S]*?)(\s*)→(\s*)$/);
      if (!m) return;
      var span = document.createElement('span'); span.className = 'arr'; span.setAttribute('aria-hidden', 'true'); span.textContent = '→';
      n.nodeValue = m[1] + m[2];
      n.parentNode.insertBefore(span, n.nextSibling);
    });
  }

  /* Markets: the catalog's industry list (on phones, the picker beside the search) filters the
     cards, and the search narrows them by name, summary, problem and impact; groups with nothing
     left hide. After a change the list's start is brought back into view if the reader is past it. */
  function catalog () {
    var c = document.querySelector('[data-catalog]');
    if (!c) return;
    var links = Array.prototype.slice.call(c.querySelectorAll('.cat-list a')), groups = Array.prototype.slice.call(c.querySelectorAll('.cat-group'));
    var input = c.querySelector('.cat-search input'), pick = c.querySelector('.cat-pick select'), none = c.querySelector('.cat-none'), sector = 'all';
    var tools = c.querySelector('.cat-tools'), main = c.querySelector('.cat-main');
    function toStart (smooth) {
      var st = getComputedStyle(tools), off = st.position === 'sticky' ? parseFloat(st.top) + tools.offsetHeight : 96;   // phones: under the bar that stays
      var top = main.getBoundingClientRect().top + window.scrollY - off;
      if (window.scrollY > top + 1) window.scrollTo({top: top, behavior: smooth && !reduce ? 'smooth' : 'auto'});
    }
    function choose (v) {
      sector = v;
      links.forEach(function(l){ if (l.getAttribute('data-filter') === v) l.setAttribute('aria-current', 'true'); else l.removeAttribute('aria-current') });
      if (pick) pick.value = v;
      apply(); toStart(true);
    }
    function apply () {
      var q = (input.value || '').trim().toLowerCase(), any = false;
      groups.forEach(function(g){
        var on = sector === 'all' || g.getAttribute('data-sector') === sector, shown = 0;
        g.querySelectorAll('.cat-card').forEach(function(card){
          var hit = on && (!q || card.getAttribute('data-text').indexOf(q) >= 0);
          card.hidden = !hit; if (hit) shown++;
        });
        var empty = !g.querySelector('.cat-card');                       // an industry with no solution sheets (its page has a video)
        g.hidden = !on || (q ? shown === 0 : (shown === 0 && !empty));
        if (!g.hidden) any = true;
      });
      none.hidden = any;
    }
    links.forEach(function(a){
      a.addEventListener('click', function(e){ e.preventDefault(); choose(a.getAttribute('data-filter')) });
    });
    if (pick) { pick.value = 'all'; pick.addEventListener('change', function(){ choose(pick.value) }) }   // a reload can restore an old choice
    input.addEventListener('input', function(){ apply(); toStart(false) });
  }

  /* What changes: the switch shows every dimension under one architecture or the other; the
     tiles with exact figures carry a bar to scale. It flips from "before" to "after" once, the
     first time it comes into view. */
  function changes () {
    document.querySelectorAll('[data-changes]').forEach(function(c){
      var btns = c.querySelectorAll('.chg-switch button');
      c.querySelectorAll('.chg[data-mb]').forEach(function(t){
        var bar = document.createElement('span'), i = document.createElement('i');
        bar.className = 'chg-bar'; bar.setAttribute('aria-hidden', 'true'); bar.appendChild(i); t.appendChild(bar); t._bar = i;
      });
      function set (side) {
        c.setAttribute('data-side', side);
        btns.forEach(function(b){ b.setAttribute('aria-pressed', b.getAttribute('data-side') === side ? 'true' : 'false') });
        c.querySelectorAll('.chg[data-mb]').forEach(function(t){
          var m = parseFloat(t.getAttribute(side === 'before' ? 'data-mb' : 'data-ma'));
          t._bar.style.width = Math.max(1.5, m * 100) + '%';
        });
      }
      c.classList.add('ready');
      btns.forEach(function(b){ b.addEventListener('click', function(){ set(b.getAttribute('data-side')) }) });
      if (reduce || !hasIO) return set('after');
      set('before');
      var once = false;
      onView(c, function(on){ if (on && !once) { once = true; setTimeout(function(){ set('after') }, 900) } }, {threshold: .45});
    });
  }

  /* The billing run race: once in view, a clock runs to 90 hours in a few seconds. The data center's bar
     grows with it to the end; Fractal's stops at 9 minutes, 1/600 of the way, almost as soon as it starts. */
  function race () {
    document.querySelectorAll('[data-race]').forEach(function(fig){
      var rows = fig.querySelectorAll('.race-row'), slow = rows[0], fast = rows[1];
      if (!slow || !fast || reduce || !hasIO) return;
      var sb = slow.querySelector('.race-bar i'), fb = fast.querySelector('.race-bar i'), sv = slow.querySelector('.race-v'), end = sv.textContent;
      sb.style.setProperty('--w', '0%'); fb.style.setProperty('--w', '0%'); sv.textContent = '0 hours';
      var once = false;
      onView(fig, function(on){
        if (!on || once) return;
        once = true;
        var t0 = performance.now();
        (function step (t) {
          var p = Math.min(1, (t - t0) / 3600);
          sb.style.setProperty('--w', (p * 100).toFixed(2) + '%');
          fb.style.setProperty('--w', (Math.min(p, 1 / 600) * 100).toFixed(3) + '%');
          sv.textContent = p < 1 ? Math.floor(90 * p) + ' hours' : end;
          if (p < 1) requestAnimationFrame(step);
        })(t0);
      }, {threshold: .6});
    });
  }

  /* The decision on phones: the two columns do not fit side by side, so a switch shows one approach at a
     time (the usual approach first, turning to Fractal's once it is in view, like the switch further down). */
  function faceoff () {
    document.querySelectorAll('.faceoff').forEach(function(f){
      var heads = f.querySelectorAll('.fo-head .fo-k'), sw = document.createElement('div');
      sw.className = 'chg-switch fo-switch'; sw.setAttribute('role', 'group'); sw.setAttribute('aria-label', 'Compare');
      var btns = [['usual', 'The usual approach'], ['fractal', 'With Fractal']].map(function(o){
        var b = document.createElement('button'); b.type = 'button'; b.setAttribute('data-side', o[0]); b.textContent = o[1];
        b.addEventListener('click', function(){ took = true; set(o[0]) });
        sw.appendChild(b); return b;
      });
      var took = false;
      function set (side) { f.setAttribute('data-side', side); btns.forEach(function(b){ b.setAttribute('aria-pressed', b.getAttribute('data-side') === side ? 'true' : 'false') }) }
      f.parentNode.insertBefore(sw, f); set('usual');
      if (reduce || !hasIO) return;
      var once = false;
      onView(f, function(on){ if (on && !once) { once = true; setTimeout(function(){ if (!took) set('fractal') }, 2600) } }, {threshold: .6});
    });
  }

  /* A statement's words light up one after another as the reader scrolls through it
     (after Magic UI's Text Reveal). Readers who ask for reduced motion see it lit. */
  function revealWords () {
    document.querySelectorAll('[data-reveal-words]').forEach(function(el){
      var words = el.textContent.trim().split(/\s+/);
      el.setAttribute('aria-label', el.textContent.trim());
      el.textContent = '';
      var spans = words.map(function(wd, i){
        var sp = document.createElement('span'); sp.className = 'w'; sp.setAttribute('aria-hidden', 'true'); sp.textContent = wd;
        el.appendChild(sp); if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
        return sp;
      });
      function update () {
        var r = el.getBoundingClientRect(), vh = window.innerHeight;
        var p = reduce ? 1 : clamp01((vh * .88 - r.top) / (r.height + vh * .3)), n = Math.round(p * spans.length);
        spans.forEach(function(sp, i){ sp.classList.toggle('on', i < n) });
      }
      var ticking = false;
      window.addEventListener('scroll', function(){ if (!ticking) { ticking = true; requestAnimationFrame(function(){ ticking = false; update() }) } }, {passive: true});
      update();
    });
  }

  /* The page's contents bar marks the section the reader is in (below 1000px, as the pill from localPill). */
  function localNav () {
    var nav = document.querySelector('nav.toc.local');
    if (!nav) return;
    var links = Array.prototype.slice.call(nav.querySelectorAll('a[href^="#"]'));
    var secs = links.map(function(a){ return document.getElementById(a.getAttribute('href').slice(1)) });
    var pill = localPill(nav, links);
    function update () {
      var y = 64 + 48 + 40, cur = -1;
      secs.forEach(function(s, i){ if (s && s.getBoundingClientRect().top <= y) cur = i });
      links.forEach(function(a, i){ if (i === cur) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current') });
      pill(cur);
      if (cur >= 0 && nav.scrollWidth > nav.clientWidth) {                // keep the current one visible when the row is wider than the screen
        var a = links[cur], l = a.offsetLeft - nav.offsetLeft;
        if (l < nav.scrollLeft || l + a.offsetWidth > nav.scrollLeft + nav.clientWidth) nav.scrollLeft = l - 18;
      }
    }
    var ticking = false;
    window.addEventListener('scroll', function(){ if (!ticking) { ticking = true; requestAnimationFrame(function(){ ticking = false; update() }) } }, {passive: true});
    update();
  }

  /* Below 1000px the contents bar holds one pill instead of its row of links (style_site.css
     picks by width): the section in view, its place in the page and a chevron. The pill opens
     the page's sections as a list; choosing one goes there and closes it, as do Escape and a tap
     elsewhere, and the arrow keys move through it. Built from the bar's own links, so the page
     markup stays as it is. Returns the function localNav calls with the current section (-1: none yet). */
  function localPill (nav, links) {
    var box = document.createElement('div'), btn = document.createElement('button'), sheet = document.createElement('div'), list = document.createElement('ol');
    var sr = document.createElement('span'), now = document.createElement('span'), count = document.createElement('span'), cur = null;
    box.className = 'toc-pill'; sr.className = 'toc-sr'; now.className = 'toc-now'; count.className = 'toc-count';
    btn.type = 'button'; btn.className = 'toc-btn';
    btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-controls', 'tocSheet');
    btn.append(sr, now, ' ', count);
    btn.insertAdjacentHTML('beforeend', '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 4.5l3 3 3-3"/></svg>');
    sheet.className = 'toc-sheet'; sheet.id = 'tocSheet';
    sheet.innerHTML = '<p class="toc-lab" aria-hidden="true">On this page</p>';
    function copy (a) { var b = document.createElement('a'); b.href = a.getAttribute('href'); b.textContent = a.textContent.trim(); return b }
    var items = links.map(function(a){ var li = document.createElement('li'), b = copy(a); li.appendChild(b); list.appendChild(li); return b });
    sheet.appendChild(list);
    nav.querySelectorAll('a:not([href^="#"])').forEach(function(a){ var b = copy(a); b.className = 'toc-out'; sheet.appendChild(b) });   // eg. a companion page, after the sections
    box.append(btn, sheet);
    nav.appendChild(box);

    function isOpen () { return box.classList.contains('open') }
    function setOpen (on, focus) {
      box.classList.toggle('open', on);
      btn.setAttribute('aria-expanded', on ? 'true' : 'false');
      if (!on) return;
      var over = box.getBoundingClientRect().bottom + sheet.offsetHeight + 24 - window.innerHeight;   // opened low on the screen: bring the whole list up
      if (over > 0) window.scrollBy({top: over, behavior: reduce ? 'auto' : 'smooth'});
      if (focus) (items[cur] || items[0]).focus({preventScroll: true});
    }
    btn.addEventListener('click', function(e){ setOpen(!isOpen(), e.detail === 0) });                    // opened from the keyboard: into the list
    sheet.addEventListener('click', function(e){
      var a = e.target.closest('a'), t = a && a.hash && document.getElementById(a.hash.slice(1));
      if (!a) return;
      setOpen(false);
      if (t && e.detail === 0) { t.setAttribute('tabindex', '-1'); t.focus({preventScroll: true}) }     // the keyboard carries on from the section
    });
    document.addEventListener('click', function(e){ if (isOpen() && !box.contains(e.target)) setOpen(false) });
    box.addEventListener('focusout', function(e){ if (e.relatedTarget && !box.contains(e.relatedTarget)) setOpen(false) });
    document.addEventListener('keydown', function(e){
      var inside = box.contains(document.activeElement);
      if (e.key === 'Escape' && isOpen()) { setOpen(false); if (inside) btn.focus() }
      else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && inside) {
        e.preventDefault();
        if (!isOpen()) return setOpen(true, true);
        var all = Array.prototype.slice.call(sheet.querySelectorAll('a')), n = all.length, i = all.indexOf(document.activeElement);
        all[i < 0 ? (e.key === 'ArrowDown' ? 0 : n - 1) : (i + (e.key === 'ArrowDown' ? 1 : n - 1)) % n].focus();
      }
    });
    window.addEventListener('resize', function(){ if (window.innerWidth >= 1000 && isOpen()) setOpen(false) });

    return function (i) {
      if (i === cur) return;
      cur = i;
      box.classList.toggle('at', i >= 0);
      sr.textContent = i >= 0 ? 'On this page: ' : '';
      now.textContent = i >= 0 ? items[i].textContent : 'On this page';
      count.textContent = i >= 0 ? (i + 1) + ' of ' + items.length : '';
      items.forEach(function(b, k){ if (k === i) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current') });
    };
  }

  /* Blocks fade up from a slight blur as they enter the viewport, siblings staggered
     (after Magic UI's Blur Fade). Only blocks below the first screen wait; anything
     already visible arrives at once, in order. */
  function reveal () {
    if (reduce || !hasIO) return;
    var sel = ['header.hero .hero-copy > *', '.proof > *', 'header.hero > h1', 'header.hero > .lede', 'header.hero > p', '.media-frame', 'header.hero > nav.toc',
               'main section > .sec-idx', 'main section > h2', 'main section > .intro', 'main section > .bluf', 'main section > .stats', 'main section > .fine',
               'main section > .xref', 'main section > .why', 'main section > .tbl-wrap', 'main section > .diagram', 'main section > .steps', 'main section > .cols',
               'main section > .risks', 'main section > .vs > *', 'main section > .ask', 'main section > .explorer', 'main section > .links',
               '.decision > .bluf', '.approaches > *', '.ripple > *', '.risk-zero', '.pillars > *', '.path > li', '.sectors > *', '.sol', '.cta'].join(',');
    var els = Array.prototype.slice.call(document.querySelectorAll(sel));
    var groups = new Map();
    els.forEach(function(el){
      var p = el.parentNode, n = groups.get(p) || 0;
      groups.set(p, n + 1);
      el.style.setProperty('--i', Math.min(n, 6));
      el.classList.add('rv');
    });
    var rio = new IntersectionObserver(function(es){
      es.forEach(function(e){ if (e.isIntersecting) { e.target.classList.add('in'); rio.unobserve(e.target) } });
    }, {rootMargin: '0px 0px -8% 0px', threshold: 0.05});
    els.forEach(function(el){ rio.observe(el) });
    window.addEventListener('hashchange', function(){ els.forEach(function(el){ el.classList.add('in') }) });   // jumping to an anchor shows everything at once
  }

  /* Stat figures count up from zero the first time they are seen (after Arc UI's
     animated number). Only the first number in a figure moves; figures with a fraction
     or nothing to count stay as written. Screen readers get the final text. */
  function counters () {
    document.querySelectorAll('.stat .v, .pillar .num, .vs .big').forEach(function(el){
      var text = el.textContent, m = text.match(/\d[\d,.]*/);
      if (!m || /\//.test(text) || reduce || !hasIO) return;
      var target = parseFloat(m[0].replace(/,/g, '')), dec = (m[0].split('.')[1] || '').length;
      if (!target) return;
      var pre = text.slice(0, m.index), post = text.slice(m.index + m[0].length), comma = m[0].indexOf(',') >= 0;
      function fmt (v) { var s = v.toFixed(dec); return comma ? Number(s).toLocaleString('en-US', {minimumFractionDigits: dec}) : s }
      el.setAttribute('aria-label', text);
      el.textContent = pre + fmt(0) + post;
      var done = false;
      onView(el, function(on){
        if (!on || done) return; done = true;
        var t0 = null, D = 1300;
        (function step (now) {
          if (t0 === null) t0 = now;
          var k = Math.min(1, (now - t0) / D), e = 1 - Math.pow(1 - k, 4);
          el.textContent = pre + fmt(target * e) + post;
          if (k < 1) requestAnimationFrame(step); else el.textContent = text;
        })(performance.now());
      }, {threshold: 0.6});
    });
  }

  /* Cards light up under the pointer (after Magic UI's Magic Card). */
  function spotlight () {
    document.addEventListener('pointermove', function(e){
      var c = e.target.closest && e.target.closest('.pillar, .sector');
      if (!c) return;
      var r = c.getBoundingClientRect();
      c.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      c.style.setProperty('--my', (e.clientY - r.top) + 'px');
    }, {passive: true});
  }

  /* Migration path: a beam runs through the stages as the reader scrolls past them
     (after Aceternity's Tracing Beam), and each stage lights when the beam reaches it. */
  function pathBeam () {
    document.querySelectorAll('ol.path').forEach(function(ol){
      var lis = Array.prototype.slice.call(ol.children);
      if (lis.length < 2) return;
      ol.classList.add('has-beam');
      function update () {
        var r = ol.getBoundingClientRect(), vh = window.innerHeight;
        var p = reduce ? 1 : clamp01((vh * .82 - r.top) / (r.height + vh * .25));
        var across = lis[1].offsetTop === lis[0].offsetTop;              // stages side by side, or stacked on a phone
        ol.style.setProperty('--p', p.toFixed(4));
        lis.forEach(function(li){
          var at = across ? (li.offsetLeft + 26) / ol.clientWidth : (li.offsetTop + 28) / ol.clientHeight;
          li.classList.toggle('lit', p >= at - .001);
        });
      }
      var ticking = false;
      function req () { if (!ticking) { ticking = true; requestAnimationFrame(function(){ ticking = false; update() }) } }
      window.addEventListener('scroll', req, {passive: true});
      window.addEventListener('resize', req);
      update();
    });
  }

  /* Comparison table: rows whose two figures are exact (data-m: each side's share of the
     larger one) get a bar per cell, drawn when the table comes into view. */
  function magnitude () {
    var cells = document.querySelectorAll('td[data-m]');
    if (!cells.length) return;
    var bars = [];
    cells.forEach(function(td){
      var s = document.createElement('span'), i = document.createElement('i');
      s.className = 'mag'; s.setAttribute('aria-hidden', 'true'); s.appendChild(i); td.appendChild(s);
      bars.push({i: i, w: Math.max(0, Math.min(1, parseFloat(td.getAttribute('data-m')))) * 100 + '%'});
    });
    function draw () { bars.forEach(function(b){ b.i.style.width = b.w }) }
    if (reduce) return draw();
    var once = false;
    onView(cells[0].closest('table'), function(on){ if (on && !once) { once = true; setTimeout(draw, 250) } }, {threshold: .35});
  }

  /* Home page, hidden risk: the same bad write, twice. Left, it lands on a source system
     and spreads through the records. Right, it lands on the twin; the systems of record
     below it are never touched and keep feeding the twin one way. Canvas, drawn only
     while on screen; reduced motion shows one still frame. */
  function ripples () {
    var cs = document.querySelectorAll('canvas[data-ripple]');
    if (!cs.length) return;
    var T = 6400, CELL = 6, GAP = 3, STEP = CELL + GAP, col = {};
    function colors () { col = {ink3: css('--ink-3'), bad: css('--bad'), good: css('--good'), mid: css('--mid'), acc: css('--accent'), rule: css('--rule-2'), ink2: css('--ink-2')} }
    colors(); document.addEventListener('themechange', function(){ colors(); cs.forEach(function(c){ c._draw && c._draw(c._t || 0) }) });
    function hash (i) { var x = Math.sin(i * 127.1) * 43758.5453; return x - Math.floor(x) }

    cs.forEach(function(cv){
      var ctx = cv.getContext('2d'), kind = cv.getAttribute('data-ripple'), w = 0, h = 0, cols = 0, rows = 0, dpr = 1;
      function size () {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        w = cv.clientWidth; h = cv.clientHeight;
        cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        cols = Math.floor((w + GAP) / STEP); rows = Math.floor((h + GAP) / STEP);
      }
      function cell (x, y, c, a) { ctx.globalAlpha = a; ctx.fillStyle = c; ctx.fillRect(x * STEP, y * STEP, CELL, CELL) }
      function label (s, y) { ctx.globalAlpha = .9; ctx.fillStyle = col.ink2; ctx.font = '500 9px "Geist Mono", monospace'; ctx.fillText(s, 0, y) }

      function draw (t) {
        ctx.clearRect(0, 0, w, h);
        var hitAt = 1150, fall = t >= 450 && t < hitAt;
        var twin = kind === 'twin';
        var split = twin ? Math.floor(rows * .5) : 0;                  // twin: top half is the twin, bottom half the systems of record
        var tx = Math.floor(cols * .32), ty = twin ? Math.floor(split * .45) : Math.floor(rows * .4);
        var speed = (twin ? .010 : .022), rad = t >= hitAt ? (t - hitAt) * speed : -1;
        var fade = t > 5300 ? clamp01((t - 5300) / 900) : 0;
        for (var y = 0; y < rows; y++) for (var x = 0; x < cols; x++) {
          var n = hash(x * 131 + y * 17), inTwin = twin && y < split - 1, gapRow = twin && y === split - 1;
          if (gapRow) continue;
          var d = Math.hypot(x - tx, (y - ty) * 1.2) + n * 2.2;
          var base = twin && !inTwin ? col.good : col.ink3, a = twin && !inTwin ? .32 + n * .2 : .22 + n * .18;
          if (!twin || inTwin) {
            var limit = twin ? 9 : 1e9;                                  // on the twin the damage stays inside the twin
            if (rad >= 0 && d <= rad && d <= limit) {
              var hot = 1 - fade, edge = clamp01((rad - d) / 3);
              cell(x, y, twin ? col.mid : col.bad, (.35 + .6 * edge) * hot + a * (1 - hot));
              continue;
            }
          }
          cell(x, y, base, a);
        }
        if (twin) {                                                     // one-way sync: dots rising from the systems of record into the twin
          var gy = (split - 1) * STEP + CELL / 2;
          ctx.globalAlpha = .5; ctx.fillStyle = col.rule; ctx.fillRect(0, gy, w, 1);
          for (var k = 0; k < 7; k++) {
            var sx = ((k + .5) / 7) * w, ph = ((t / 1400) + hash(k + 3)) % 1;
            ctx.globalAlpha = .9 * Math.sin(ph * Math.PI); ctx.fillStyle = col.good;
            ctx.fillRect(sx - 1, gy + 14 - ph * 28, 2, 4);
          }
          ctx.globalAlpha = 1;
          ctx.save(); ctx.textBaseline = 'top';
          ctx.fillStyle = cvBg(); ctx.globalAlpha = .85; ctx.fillRect(0, 0, 96, 13); ctx.fillRect(0, split * STEP, 132, 13);
          label('DIGITAL TWIN', 2); label('SYSTEMS OF RECORD', split * STEP + 2); ctx.restore();
        }
        if (fall) {                                                     // the write, falling onto its target
          var k2 = (t - 450) / (hitAt - 450), e = k2 * k2;
          var px = tx * STEP + CELL / 2, py = -8 + (ty * STEP + CELL / 2 + 8) * e;
          ctx.globalAlpha = 1; ctx.fillStyle = col.acc;
          ctx.fillRect(px - 3, py - 3, 6, 6);
          ctx.globalAlpha = .35; ctx.fillRect(px - 1, py - 22, 2, 18);
        } else if (t >= hitAt && t < hitAt + 500) {                     // impact ring
          var r = (t - hitAt) / 500;
          ctx.globalAlpha = 1 - r; ctx.strokeStyle = twin ? col.mid : col.bad; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(tx * STEP + CELL / 2, ty * STEP + CELL / 2, 4 + r * 26, 0, 7); ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
      function cvBg () { return css('--surface') }
      cv._draw = draw;
      size();
      if (window.ResizeObserver) new ResizeObserver(function(){ size(); draw(cv._t || 0) }).observe(cv);
      if (reduce) { cv._t = 3200; return draw(3200) }
      var vis = false, t = 0, last = null;
      onView(cv, function(on){ vis = on });
      (function frame (now) {
        if (vis) { if (last !== null) t = (t + (now - last)) % T; last = now; cv._t = t; draw(t) } else last = null;
        requestAnimationFrame(frame);
      })(performance.now());
    });
  }

  /* Home: the logo cube in the hero and the Fractal system on the How it works screen, both drawn by the
     shared scene engine (FractalScene above) from one set of 64 pieces and their formations:
       logo     the logo: a solid 3 x 3 x 3 cube and its three trails.
       src      Systems of record: a grey block, the systems the business runs on.
       twin     One-way sync -> digital twin: a coloured copy builds beside it, one way only.
       mesh     The twin splits into a floor of instances, which spreads into a far larger field (the
                scale it runs at); the systems of record step back, untouched.
       run      The App runs on every instance at once: lines run from the App to every instance and
                waves of work cross the whole field.
       results  The data stays on the instances; each sends one small result up into the answer above.
     The canvas reaches past its box; box and origin are measured from the page, so the pieces are
     framed in the box and never cut at the canvas edge. */
  function fractalCube (cv, holder, cam, opts) {
    opts = opts || {};
    var U = FractalScene.util, hex = U.hex, mix = U.mix, ramp = U.ramp, rnd = U.rnd, P = U.palette;
    var SLATE = {top: hex('#7c8698'), front: hex('#566070'), side: hex('#444d5b')}, IDLE = hex('#243146'), APP = hex('#e6edff');

    // 64 pieces: S, the systems of record (27); T, the twin (27); X, the App and nine more instances (10)
    var V = [];
    for (var i = 0; i < 64; i++) V.push({i: i, g: i < 27 ? 'S' : i < 54 ? 'T' : 'X'});
    function g3 (k) { return [k % 3 - 1, Math.floor(k / 3) % 3 - 1, Math.floor(k / 9) - 1] }
    var SRC = [-2.7, 0, -.4], TWIN = [2.5, 0, .5], MESH = [.6, -.9, .4], OLD = [-5.2, -.5, -3.4], MERGE = [.6, 2.5, .4];
    V.forEach(function(v){
      var k = v.g === 'S' ? v.i : v.g === 'T' ? v.i - 27 : -1;
      if (k >= 0) v.c3 = g3(k);
      var m = v.g === 'T' ? v.i - 27 : v.g === 'X' && v.i > 54 ? 27 + (v.i - 55) : -1;
      if (m >= 0) { v.mx = m % 6 - 2.5; v.mz = Math.floor(m / 6) - 2.5; v.md = Math.hypot(v.mx, v.mz) / 3.6 }
      v.app = v.i === 54;                                                   // the App; in the results it is the answer the results rise into
    });
    var TRAIL = U.logoTrails(), tr = 0;
    V.forEach(function(v){ if (v.g !== 'T') v.trail = TRAIL[tr++] });

    function hidden (at) { return {p: at.slice(), s: .15, o: [0, 0], a: 0} }
    function ease (k) { return U.ease(k) }
    var F = {
      src:  function(v){ return v.g === 'S' ? {p: [SRC[0] + v.c3[0] * 1.06, SRC[1] + v.c3[1] * 1.06, SRC[2] + v.c3[2] * 1.06], s: .96} : hidden(SRC) },
      twin: function(v){
        if (v.g === 'S') return F.src(v);
        if (v.g === 'T') return {p: [TWIN[0] + v.c3[0] * 1.12, TWIN[1] + v.c3[1] * 1.12, TWIN[2] + v.c3[2] * 1.12], s: .96};
        return hidden(TWIN);
      },
      mesh: function(v, t, u){
        if (v.g === 'S') return {p: [OLD[0] + v.c3[0] * .8, OLD[1] + v.c3[1] * .8, OLD[2] + v.c3[2] * .8], s: .72, a: .5};
        if (v.app) { var dk = ease(clamp01((u || 0) * 4)); return {p: [MESH[0], 3.4 - 2.3 * dk, MESH[2]], s: .7, o: [t / 900, t / 700]} }
        var lit = u == null ? 0 : clamp01(((u || 0) - .18 - v.md * .5) * 4), rise = Math.sin(Math.PI * lit) * .35;
        return {p: [MESH[0] + v.mx * 1.12, MESH[1] + rise, MESH[2] + v.mz * 1.12], s: .8, lit: lit};
      },
      results: function(v, t){                                              // the data stays on the instances; only their results rise to the model
        if (v.g === 'S') return F.mesh(v, 0, 1);
        if (v.app) return {p: MERGE.slice(), s: 1.05, o: [t / 1600, t / 1300]};
        var m = F.mesh(v, t, 0); m.lit = .5; return m;
      },
      logo: function(v){
        if (v.g === 'T') return {p: [v.c3[0] * 1.3, v.c3[1] * 1.3, v.c3[2] * 1.3], s: 1};
        return {p: v.trail.p, s: v.trail.s};
      }
    };
    F.run = function(v, t, u){ return F.mesh(v, t, u == null ? 1 : u) };
    F.burst = function(v){                                                  // the logo blown apart, every piece tumbling (a click on the cube)
      var b = F.logo(v), p = b.p, l = Math.hypot(p[0], p[1], p[2]) || 1, r = 1.4 + rnd(v.i, 21) * 1.6;
      return {p: [p[0] + p[0] / l * r, p[1] + p[1] / l * r + (rnd(v.i, 22) - .5), p[2] + p[2] / l * r], s: b.s * .85, o: [(rnd(v.i, 23) - .5) * 4, (rnd(v.i, 24) - .5) * 4]};
    };
    function colorOf (f, v, n, lit) {
      if (f === 'burst') f = 'logo';
      if (v.app && f !== 'logo') return APP;
      if (v.g === 'S' && f !== 'logo') return n[1] > 0 ? SLATE.top : n[2] !== 0 ? SLATE.front : SLATE.side;
      if (f === 'results') { var r = ramp(P.SPEC, (v.mx + 2.5) / 5 * .6 + (2.5 - v.mz) / 5 * .4); return mix(mix(IDLE, r, .22), r, .45) }
      if (f === 'logo' && v.g !== 'T') return v.trail.col;
      if (f === 'mesh' || f === 'run') {
        var c = ramp(P.SPEC, (v.mx + 2.5) / 5 * .6 + (2.5 - v.mz) / 5 * .4);
        return mix(mix(IDLE, c, .22), c, f === 'run' ? (lit == null ? 1 : lit) : 0);
      }
      return U.logoFace(v.c3 || [0, 0, 0], n);
    }
    function order (from, to, v) {
      if (to === 'twin') return v.g === 'T' ? (v.i - 27) / 27 * .7 : 0;
      if (to === 'mesh') return v.g === 'S' ? 0 : v.app ? .5 : (v.md || 0) * .45;
      if (to === 'results') return v.g === 'S' ? 0 : (v.md || 0) * .4;
      if (to === 'logo') return v.g === 'T' ? .05 + rnd(v.i, 3) * .12 : .22 + rnd(v.i, 4) * .35;
      return 0;
    }
    var FIELD = [];
    for (var gx = -8; gx <= 13; gx++) for (var gz = -7; gz <= 12; gz++) {
      if (gx >= 0 && gx <= 5 && gz >= 0 && gz <= 5) continue;
      var fx = gx - 2.5, fz = gz - 2.5, d = Math.hypot(fx, fz);
      if (d < 10.5) FIELD.push({x: MESH[0] + fx * 1.12, z: MESH[2] + fz * 1.12, d: d, col: ramp(P.SPEC, clamp01((fx + 8) / 16 * .6 + (8 - fz) / 16 * .4))});
    }
    function meshK (x) {                                                    // how much of the field shows: in with the mesh, out with the results
      var a = x.from === 'mesh' || x.from === 'run', b = x.to === 'mesh' || x.to === 'run';
      return x.hold ? (a ? 1 : 0) : a && b ? 1 : b ? x.ku : a ? 1 - x.ku : 0;
    }
    function stage (ctx, x) {                                               // a floor of square cells under the pieces, part of the scene: it turns and tilts with them
      var y = cfg.floor(x.from, x.to, x.ku, x.hold) - .02, G = 1.3, N = 8, R = N * G, ew = x.w * .12, eh = x.h * .12;
      var ink = x.light ? '11,14,18' : '235,238,242', base = x.light ? .22 : .17;
      function seg (a, b) {
        var m = [(a[0] + b[0]) / 2, (a[2] + b[2]) / 2], r = Math.hypot(m[0], m[1]) / R, f = Math.max(0, 1 - r); f = Math.pow(f, 1.4);
        if (f < .02) return;
        var p = x.proj(x.rot([a[0], y, a[2]])), q = x.proj(x.rot([b[0], y, b[2]])), cx = (p[0] + q[0]) / 2, cy = (p[1] + q[1]) / 2;
        f *= Math.max(0, Math.min(1, Math.min(cx, x.w - cx) / ew)) * Math.max(0, Math.min(1, Math.min(cy, x.h - cy) / eh));
        if (f < .02) return;
        ctx.strokeStyle = 'rgba(' + ink + ',' + (base * f).toFixed(3) + ')';
        ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
      }
      ctx.lineWidth = 1; ctx.globalAlpha = 1;                              // the reflection, painted just before, leaves the alpha low
      for (var i = -N; i <= N; i++) for (var j = -N; j < N; j++) {
        seg([(i - .5) * G, y, (j - .5) * G], [(i - .5) * G, y, (j + .5) * G]);
        seg([(j - .5) * G, y, (i - .5) * G], [(j + .5) * G, y, (i - .5) * G]);
      }
      ctx.globalAlpha = 1;
    }
    var cfg = {
      pieces: V, formations: F, colorOf: colorOf, order: order, reflect: true, box: [1, 1], origin: .5, cam: cam,
      floor: function(from, to, ku, hold){ return (from === 'logo' && hold) ? -4.4 : -2.4 - (to === 'logo' ? 2 * ku : from === 'logo' ? 2 * (1 - ku) : 0) },
      under: function(ctx, x){
        if (opts.stage) stage(ctx, x);
        var k = meshK(x);
        if (k <= .01) return;
        var running = x.hold && x.from === 'run', wave = (x.t % 2600) / 2600 * 12, y = MESH[1] + .4, h = .4, ew = x.w * .14, eh = x.h * .14;
        FIELD.forEach(function(c){
          var a = k * Math.max(0, 1 - c.d / 10.5) * clamp01(k * 12 - c.d * .9);   // the field grows outward from the mesh
          if (a <= .01) return;
          var m = x.proj(x.rot([c.x, y, c.z]));
          a *= clamp01(Math.min(m[0], x.w - m[0]) / ew) * clamp01(Math.min(m[1], x.h - m[1]) / eh);   // and fades out well before the canvas edge
          if (a <= .01) return;
          var on = running ? Math.max(0, 1 - Math.abs(c.d - wave) / 1.6) : 0, col = mix(mix(IDLE, c.col, .22), c.col, on);
          var q = [[-h, -h], [h, -h], [h, h], [-h, h]].map(function(o){ return x.proj(x.rot([c.x + o[0], y, c.z + o[1]])) });
          ctx.globalAlpha = a * (x.light ? .5 : .7);
          ctx.fillStyle = 'rgb(' + (col[0] | 0) + ',' + (col[1] | 0) + ',' + (col[2] | 0) + ')';
          ctx.beginPath(); ctx.moveTo(q[0][0], q[0][1]); ctx.lineTo(q[1][0], q[1][1]); ctx.lineTo(q[2][0], q[2][1]); ctx.lineTo(q[3][0], q[3][1]); ctx.closePath(); ctx.fill();
        });
        ctx.globalAlpha = 1;
      },
      extras: function(ctx, x){
        var kr = x.hold ? (x.from === 'results' ? 1 : 0) : x.to === 'results' ? clamp01(x.ku * 2 - 1) : x.from === 'results' ? 1 - clamp01(x.ku * 3) : 0;
        if (kr > .01) {                                                     // results: a small result rises from every instance into the answer above them
          var top = x.items.filter(function(it){ return it.v.app })[0], tp = x.proj(top.r);
          x.items.forEach(function(it){
            if (it.v.app || it.v.g === 'S' || it.v.mx == null) return;
            var ph = (x.t / 1700 + rnd(it.v.i, 9)) % 1, e = ease(ph), ip = x.proj(x.rot([it.c[0], it.c[1] + .45 * it.s, it.c[2]]));
            var px = ip[0] + (tp[0] - ip[0]) * e, py = ip[1] + (tp[1] - ip[1]) * e, r = Math.max(2, x.sc * .12 * (1 - .4 * e));
            var col = ramp(P.SPEC, (it.v.mx + 2.5) / 5 * .6 + (2.5 - it.v.mz) / 5 * .4);
            ctx.globalAlpha = kr * .14; ctx.strokeStyle = 'rgb(' + (col[0] | 0) + ',' + (col[1] | 0) + ',' + (col[2] | 0) + ')'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(ip[0], ip[1]); ctx.lineTo(tp[0], tp[1]); ctx.stroke();
            ctx.globalAlpha = kr * Math.sin(Math.PI * ph); ctx.fillStyle = 'rgb(' + (col[0] | 0) + ',' + (col[1] | 0) + ',' + (col[2] | 0) + ')';
            ctx.fillRect(px - r, py - r, 2 * r, 2 * r);
          });
          ctx.globalAlpha = 1;
        }
        if (x.from !== 'run' || !x.hold) return;                            // the App going out to every instance
        var app = x.items.filter(function(it){ return it.v.app })[0], ap = x.proj(app.r);
        x.items.forEach(function(it){
          if (it.lit == null || it.v.app || it.v.g === 'S') return;
          var f = it.lit > 0 && it.lit < 1 ? 1 - Math.abs(it.lit * 2 - 1) : 0;
          if (f <= 0) return;
          var ip = x.proj(x.rot([it.c[0], it.c[1] + .45 * it.s, it.c[2]]));
          ctx.globalAlpha = .55 * f; ctx.strokeStyle = 'rgb(' + ramp(P.SPEC, (it.v.mx + 2.5) / 5).map(function(c){ return c | 0 }).join(',') + ')'; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.moveTo(ap[0], ap[1]); ctx.lineTo(ip[0], ip[1]); ctx.stroke();
        });
      }
    };
    var scene = FractalScene(cv, cfg);
    function frame () {                                                     // the holder's box, as a share of the canvas
      var c = cv.getBoundingClientRect(), b = holder.getBoundingClientRect();
      if (!b.width || !c.width) return;
      cfg.box = [c.width / b.width, c.height / b.height]; cfg.origin = (b.left - c.left + b.width / 2) / c.width;
    }
    frame(); scene.onResize(frame);
    return scene;
  }

  /* The hero: how Fractal works, told once (systems of record, the twin, the mesh, the App running on every
     instance, the results going back), then resting on the logo. A caption names each step, quoting the How
     It Works diagram, and a thin line under it shows the steps; any one replays the story from there.
     At rest the logo is the reader's: drag to spin it (with momentum, settling back), hover and pieces move
     away, click and it bursts and re-forms. It waits while off screen and leans toward the pointer on a
     desktop; readers who ask for reduced motion see the logo, still. */
  function voxelHero () {
    var cv = document.querySelector('canvas.voxel-hero');
    if (!cv) return;
    var holder = cv.parentNode, cap = holder.querySelector('.hero-caption'), capN = cap && cap.querySelector('.hc-n'), capT = cap && cap.querySelector('.hc-t'), capKey = null;
    var scene = fractalCube(cv, holder, {src: [-.36, .3, 4.9], twin: [-.36, .3, 5.6], mesh: [-.62, .74, 7.2], run: [-.62, .74, 7.2], results: [-.6, .62, 6.6], logo: [-.52, .56, 5.3], burst: [-.52, .56, 7.4]}, {stage: true});
    var SEQ = [['src', 'src', 1200], ['src', 'twin', 2600], ['twin', 'twin', 400], ['twin', 'mesh', 2000], ['run', 'run', 2800],
               ['run', 'results', 1500], ['results', 'results', 1800], ['results', 'logo', 1700]];
    var CAPS = {src: ['01', 'Systems of record'], twin: ['02', 'One-way sync → digital twin'], mesh: ['03', 'Fractal Computing mesh'],
                run: ['04', 'The App runs on every instance, in parallel'], results: ['05', 'The compact results, not the data, go back'], logo: ['06', 'Fractal']};
    var TOTAL = SEQ.reduce(function(a, q){ return a + q[2] }, 0), KEYS = ['src', 'twin', 'mesh', 'run', 'results', 'logo'];
    var START = KEYS.map(function(k){ var t = 0; for (var i = 0; SEQ[i][1] !== k; i++) t += SEQ[i][2]; return t });   // when each step's caption begins
    var story = 0, done = false, peek = false, last = null, now0 = 0, vis = true;
    var beats = holder.querySelector('.hero-beats'), bars = [];
    if (beats) KEYS.forEach(function(k, i){
      var b = document.createElement('button'), bar = document.createElement('i');
      b.type = 'button'; b.setAttribute('aria-label', 'Play from step ' + (i + 1) + ': ' + CAPS[k][1]); b.appendChild(bar);
      b.addEventListener('click', function(){ play(START[i]) });
      b.addEventListener('pointerenter', function(){ preview(k) });
      b.addEventListener('pointerleave', function(){ preview(null) });
      beats.appendChild(b); bars.push(bar);
    });
    function fill () { bars.forEach(function(bar, i){ var a = START[i], z = i + 1 < START.length ? START[i + 1] : TOTAL; bar.style.setProperty('--t', clamp01((story - a) / (z - a)).toFixed(3)) }) }
    function preview (k) {
      if (!cap) return;
      peek = !!k;
      if (k) { capN.textContent = CAPS[k][0]; capT.textContent = CAPS[k][1]; cap.classList.add('on') }
      else { capKey = done ? 'rest' : null; if (done) cap.classList.remove('on') }
    }
    function caption (key) {
      if (!cap || peek || key === capKey) return;
      capKey = key; cap.classList.remove('on');
      setTimeout(function(){ capN.textContent = CAPS[key][0]; capT.textContent = CAPS[key][1]; cap.classList.add('on') }, 180);
    }
    function play (t) {
      story = t; done = false; capKey = null; burstAt = null; dragYaw = dragPitch = vel = 0; peek = false;
      cv.classList.remove('grab'); if (beats) beats.classList.remove('done');
    }
    var dragYaw = 0, dragPitch = 0, vel = 0, dragging = false, moved = 0, lastX = 0, lastY = 0, pointer = null, burstAt = null;
    function local (e) { var r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top] }
    cv.addEventListener('pointerdown', function(e){ if (!done) return; dragging = true; moved = 0; lastX = e.clientX; lastY = e.clientY; vel = 0; cv.setPointerCapture(e.pointerId); cv.classList.add('grabbing') });
    cv.addEventListener('pointermove', function(e){
      if (!done) return;
      if (!dragging) { pointer = local(e); return }
      var dx = e.clientX - lastX, dy = e.clientY - lastY; lastX = e.clientX; lastY = e.clientY; moved += Math.abs(dx) + Math.abs(dy);
      dragYaw = Math.max(-1.1, Math.min(1.1, dragYaw + dx * .008)); vel = dx * .008; dragPitch = Math.max(-.45, Math.min(.5, dragPitch + dy * .004));
    });
    function up () { if (!dragging) return; dragging = false; cv.classList.remove('grabbing'); if (moved < 6 && burstAt === null) { burstAt = now0; vel = 0 } }
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('pointerleave', function(){ pointer = null });
    function rest (t) {
      var k = Math.min(1.5, window.scrollY / Math.max(1, window.innerHeight));
      if (!dragging) { dragYaw += vel; vel *= .94; if (Math.abs(vel) < .002) { dragYaw *= .985; dragPitch *= .985 } }   // after a spin it settles back to the logo's pose
      var o = {yaw: .24 * Math.sin(t / 7000) + k * 1.2 + dragYaw, pitch: dragPitch, push: !reduce, pointer: dragging ? null : pointer};
      if (burstAt !== null) {
        var b = t - burstAt;
        if (b < 850) return scene.render('logo', 'burst', b / 850, t, o);
        if (b < 2050) return scene.render('burst', 'logo', (b - 850) / 1200, t, o);
        burstAt = null;
      }
      scene.render('logo', 'logo', 0, t, o);
    }
    function draw (t) {
      if (story >= TOTAL) {
        rest(t);
        if (!done) { done = true; if (cap && !peek) cap.classList.remove('on'); capKey = 'rest'; cv.classList.add('grab'); if (beats) { fill(); beats.classList.add('done') } }
        return;
      }
      var acc = 0, seg = 0;
      while (story >= acc + SEQ[seg][2]) { acc += SEQ[seg][2]; seg++ }
      var S = SEQ[seg], u = (story - acc) / S[2];
      caption(S[0] === S[1] || u > .55 ? S[1] : S[0]);
      scene.render(S[0], S[1], u, t, {yaw: Math.min(1.5, window.scrollY / Math.max(1, window.innerHeight)) * 1.2});
      fill();
    }
    scene.onResize(function(){ draw(now0) });
    if (reduce) { story = TOTAL; if (beats) beats.hidden = true; return draw(0) }
    onView(cv, function(on){ vis = on });
    if (window.matchMedia('(pointer: fine)').matches) window.addEventListener('pointermove', function(e){ scene.tilt((e.clientX / window.innerWidth - .5) * 2, (e.clientY / window.innerHeight - .5) * 2) }, {passive: true});
    (function loop (t) {
      now0 = t;
      if (vis) { if (last !== null) story += t - last; last = t; draw(t) } else last = null;   // the story waits while off screen
      requestAnimationFrame(loop);
    })(performance.now());
  }

  /* How it works: the cube pinned beside five short steps (at the top of the screen on phones). The scroll
     only chooses the step being read: the one nearest the middle of the screen (just under the cube on
     phones). When it changes, the cube plays the change to that step's formation (data-beat) at its own
     pace and finishes it, then keeps working in place. Moving several steps ahead plays each change in
     order, faster; moving back goes straight to the step being read, never rewinding. Before the first
     step and after the last, the logo. The step being shown is highlighted; clicking one scrolls to it.
     Readers who ask for reduced motion see each formation, still. */
  function voxelSystem () {
    var cv = document.querySelector('canvas.voxel-sys'), sec = cv && cv.closest('section');
    if (!cv || !sec) return;
    var steps = Array.prototype.slice.call(sec.querySelectorAll('[data-beat]')), vis = false, now0 = 0;
    var scene = fractalCube(cv, cv.parentNode, {src: [-.36, .3, 4.9], twin: [-.36, .3, 5.6], mesh: [-.62, .78, 8.6], run: [-.62, .78, 8.6], results: [-.6, .62, 7.2], logo: [-.52, .56, 5.4]});
    var n = steps.length;
    function beat (k) { return k < 0 || k >= n ? 'logo' : steps[k].getAttribute('data-beat') }   // -1 before the steps, n after them
    function reading () {                                                   // the step being read
      var vh = window.innerHeight, pin = cv.parentNode.getBoundingClientRect();
      var focus = pin.top > 0 && pin.bottom < vh * .6 ? pin.bottom + (vh - pin.bottom) * .35 : vh * .5;
      var first = steps[0].getBoundingClientRect(), last = steps[n - 1].getBoundingClientRect();
      if (focus < first.top - vh * .1) return -1;
      if (focus > last.bottom + vh * .25) return n;
      var k = 0, best = Infinity;
      steps.forEach(function(li, i){ var r = li.getBoundingClientRect(), d = Math.abs(r.top + r.height / 2 - focus); if (d < best) { best = d; k = i } });
      return k;
    }
    var cur = -1, anim = null, held = 0;                                    // anim: {a, b, t0, dur}; held: when the current formation was reached
    function show (k) { steps.forEach(function(li, i){ li.classList.toggle('on', i === k) }) }
    function draw (t) {
      var want = reading();
      if (reduce) { cur = want; show(want); return scene.render(beat(want), beat(want), 1, 0) }
      if (anim && t - anim.t0 >= anim.dur) { cur = anim.b; anim = null; held = t }
      if (!anim && want !== cur) {
        var next = want > cur ? cur + 1 : want;                             // forward: one step at a time; back: straight there
        if (beat(next) === beat(cur)) { cur = next; held = t }
        else anim = {a: cur, b: next, t0: t, dur: want > next ? 520 : 1800};   // catching up runs each change quickly
      }
      show(want);
      var o = {yaw: (anim ? anim.b : cur) * .08};
      if (anim) return scene.render(beat(anim.a), beat(anim.b), clamp01((t - anim.t0) / anim.dur), t, o);
      var f = beat(cur), u = 0;
      if (f === 'run') { var q = ((t - held) / 3000) % 2; u = 1 - .75 * (q < 1 ? q : 2 - q) }   // the App keeps running: waves of work out to every instance
      scene.render(f, f, u, t, o);
    }
    steps.forEach(function(li){
      li.tabIndex = 0;
      function go () { var r = li.getBoundingClientRect(); window.scrollTo({top: window.scrollY + r.top + r.height / 2 - window.innerHeight * .5, behavior: reduce ? 'auto' : 'smooth'}) }
      li.addEventListener('click', go);
      li.addEventListener('keydown', function(e){ if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go() } });
    });
    scene.onResize(function(){ draw(now0) });
    if (reduce) { window.addEventListener('scroll', function(){ draw(0) }, {passive: true}); return draw(0) }
    onView(sec, function(on){ vis = on });
    (function loop (t) { now0 = t; if (vis) draw(t); requestAnimationFrame(loop) })(performance.now());
  }

  /* Footer: a band of the logo's voxels, its colours running magenta to mint across the
     page, brightening in slow waves like the cube's shards drifting apart. */
  function footField () {
    var cv = document.querySelector('.foot-field');
    if (!cv) return;
    var ctx = cv.getContext('2d'), w = 0, h = 0, S = 7, G = 5, cells = [], pal = [], vis = false;
    function palette () { pal = ['--sp-1', '--sp-2', '--sp-3', '--sp-4', '--sp-5'].map(css) }
    function size () {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = cv.clientWidth; h = cv.clientHeight; cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cells = [];
      for (var y = 0; y < h; y += S + G) for (var x = 0; x < w; x += S + G) {
        var f = x / w, i = Math.min(4, Math.floor(f * 5)), n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
        cells.push({x: x, y: y, c: i, n: n - Math.floor(n), d: y / h});
      }
    }
    function draw (t) {
      ctx.clearRect(0, 0, w, h);
      cells.forEach(function(c){
        var wave = .5 + .5 * Math.sin(t / 1400 + c.x / 140 - c.y / 60 + c.n * 2);
        var a = (.08 + .55 * Math.pow(wave, 3)) * (.35 + .65 * c.d) * (c.n > .35 ? 1 : .25);
        ctx.globalAlpha = a; ctx.fillStyle = pal[c.c]; ctx.fillRect(c.x, c.y, S, S);
      });
      ctx.globalAlpha = 1;
    }
    palette(); size(); draw(0);
    document.addEventListener('themechange', function(){ palette(); draw(0) });
    if (window.ResizeObserver) new ResizeObserver(function(){ size(); draw(0) }).observe(cv);
    if (reduce) return;
    onView(cv, function(on){ vis = on });
    (function frame (now) { if (vis) draw(now); requestAnimationFrame(frame) })(performance.now());
  }

  /* Home page, results: the five industry results become an explorer, one result at a
     time beside a list of industries, advancing on its own until the reader takes over
     (after the tab pattern on Linear and Vercel's sites, with Magic UI's Flickering Grid
     behind each result in the logo's colours). */
  /* Behind each inner page's header: a hairline grid of square cells, fading out away from the upper right, with a few cells lit faintly in the logo's
     colours, each slowly brightening and fading. Still for readers who ask for reduced motion; it waits
     while the header is off screen. */
  function heroGrid () {
    var U = FractalScene.util;
    document.querySelectorAll('main > header.hero:not(.hero-home)').forEach(function(head){   // not on the home page: its cube is the picture there
      var cv = document.createElement('canvas'); cv.className = 'hero-grid'; cv.setAttribute('aria-hidden', 'true');
      head.insertBefore(cv, head.firstChild);
      var ctx = cv.getContext('2d'), w = 0, h = 0, S = 56, ox = 0, cells = [], vis = true, home = head.classList.contains('hero-home');
      function size () {
        var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        w = cv.clientWidth; h = cv.clientHeight; cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ox = (head.getBoundingClientRect().left - cv.getBoundingClientRect().left) % S;      // a grid line runs down the text's left edge
        cells = [];
        var cols = Math.ceil(w / S) + 1, rows = Math.ceil(h / S) + 1;
        for (var k = 0; k < 22; k++) { var c = Math.floor(U.rnd(k, 31) * cols), r = Math.floor(U.rnd(k, 32) * rows); cells.push({c: c, r: r, p: U.rnd(k, 33) * 9000, d: 7000 + U.rnd(k, 34) * 6000, col: U.ramp(U.palette.SPEC, U.rnd(k, 35))}) }
      }
      function fade (x, y) {                                                // 1 at the focus, 0 well away from it
        var fx = home ? w * .68 : w * .82, fy = home ? h * .5 : h * .3, rx = home ? w * .5 : w * .55, ry = home ? h * .75 : h * .9;
        var d = Math.hypot((x - fx) / rx, (y - fy) / ry); return Math.max(0, 1 - d * d) * Math.max(0, Math.min(1, (h - y) / (h * .3)));   // and out before the header ends
      }
      function draw (t) {
        ctx.clearRect(0, 0, w, h);
        var light = root.getAttribute('data-theme') === 'light', ink = light ? '11,14,18' : '235,238,242', base = light ? .085 : .06;
        ctx.lineWidth = 1;
        for (var x = ox; x < w; x += S) for (var y = 0; y < h; y += S) {    // each segment drawn with its own strength, so the grid fades out
          var a = base * fade(x, y + S / 2); if (a > .004) { ctx.strokeStyle = 'rgba(' + ink + ',' + a.toFixed(3) + ')'; ctx.beginPath(); ctx.moveTo(x + .5, y); ctx.lineTo(x + .5, y + S); ctx.stroke() }
          var b = base * fade(x + S / 2, y); if (b > .004) { ctx.strokeStyle = 'rgba(' + ink + ',' + b.toFixed(3) + ')'; ctx.beginPath(); ctx.moveTo(x, y + .5); ctx.lineTo(x + S, y + .5); ctx.stroke() }
        }
        cells.forEach(function(c){
          var x = ox + c.c * S, y = c.r * S, f = fade(x + S / 2, y + S / 2), k = reduce ? .6 : .5 - .5 * Math.cos(((t + c.p) % c.d) / c.d * Math.PI * 2);
          var a = f * k * (light ? .16 : .13); if (a < .004) return;
          ctx.fillStyle = 'rgba(' + (c.col[0] | 0) + ',' + (c.col[1] | 0) + ',' + (c.col[2] | 0) + ',' + a.toFixed(3) + ')';
          ctx.fillRect(x + 1, y + 1, S - 1, S - 1);
        });
      }
      size();
      if (window.ResizeObserver) new ResizeObserver(function(){ size(); draw(performance.now()) }).observe(cv);
      document.addEventListener('themechange', function(){ draw(performance.now()) });
      if (reduce) return draw(0);
      onView(head, function(on){ vis = on });
      var last = 0;
      (function loop (t) { if (vis && t - last > 50) { last = t; draw(t) } requestAnimationFrame(loop) })(performance.now());   // 20 frames a second is plenty for a slow fade
    });
  }

  /* Tables: each cell carries its column's name, which a phone shows above the cell when the rows stack. */
  function tableLabels () {
    document.querySelectorAll('.tbl-wrap table').forEach(function(t){
      var names = Array.prototype.map.call(t.querySelectorAll('thead th'), function(th){ return th.textContent.trim() });
      t.querySelectorAll('tbody tr').forEach(function(tr){ Array.prototype.forEach.call(tr.children, function(td, i){ if (names[i]) td.setAttribute('data-label', names[i]) }) });
    });
  }

  /* An industry page's data sheets (market.html). On phones each folds to a row with the solution's name
     and its first impact, so the page reads as a list like the Markets catalog; a row opens its sheet, and a
     link to a solution (from Markets or the On this page list) opens that one. Wider, every sheet is open. */
  function solSheets () {
    var list = document.querySelector('.sol-list');
    if (!list) return;
    var q = window.matchMedia('(max-width: 760px)'), sols = Array.prototype.slice.call(list.querySelectorAll(':scope > .sol'));
    sols.forEach(function(s){
      var body = s.querySelector('.sol-body'), imp = s.querySelector('.lab.impact + ul > li'), b = document.createElement('button');
      body.id = s.id + '-sheet';
      b.type = 'button'; b.className = 'sol-h'; b.setAttribute('aria-expanded', 'false'); b.setAttribute('aria-controls', body.id);
      b.innerHTML = '<span class="sol-h-t"><b></b><span></span></span><svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 4.5l3 3 3-3"/></svg>';
      b.querySelector('b').textContent = s.querySelector('h3').textContent;
      b.querySelector('.sol-h-t > span').textContent = imp ? imp.textContent : '';
      b.addEventListener('click', function(){ set(s, !s.classList.contains('open')) });
      s.insertBefore(b, s.firstChild);
    });
    function set (s, on) { s.classList.toggle('open', on); s.querySelector('.sol-h').setAttribute('aria-expanded', on ? 'true' : 'false') }
    function target (hash) { var s = hash && document.getElementById(decodeURIComponent(hash.slice(1))); return sols.indexOf(s) >= 0 ? s : null }
    function fit () { list.classList.toggle('acc', q.matches) }
    fit();
    if (q.addEventListener) q.addEventListener('change', fit);
    document.addEventListener('click', function(e){ var a = e.target.closest('a[href^="#"]'), s = a && target(a.getAttribute('href')); if (s) set(s, true) });
    window.addEventListener('hashchange', function(){ var s = target(location.hash); if (s) set(s, true) });
    var at = target(location.hash);                                          // arrived from Markets: open that sheet and land on it, now the others are folded
    if (at) {
      set(at, true);
      if (q.matches) { at.scrollIntoView({block: 'start'}); window.addEventListener('load', function(){ at.scrollIntoView({block: 'start'}) }) }
    }
  }

  /* Each explorer is built both ways once, tabs and accordion, and shows the one that fits the window:
     the accordion on phones, the tabs wider (switching as the window crosses the phone width). */
  function explorer () {
    var q = window.matchMedia('(max-width: 760px)'), all = document.querySelectorAll('[data-explorer]');
    all.forEach(function(ex){ explorerOne(ex); accordion(ex) });
    function fit () { all.forEach(function(ex){ ex.classList.toggle('acc', q.matches); ex.classList.toggle('ready', !q.matches) }) }
    fit();
    if (q.addEventListener) q.addEventListener('change', fit);
  }
  /* On phones an explorer is an accordion: the titles in a column, one open at a time. */
  function accordion (ex) {
    var panels = Array.prototype.slice.call(ex.querySelectorAll('.ex-panels > .pillar'));
    ex.classList.add('acc');
    var heads = panels.map(function(p, i){
      var label = p.querySelector(':scope > .tag') || p.querySelector(':scope > h3'), b = document.createElement('button');
      b.type = 'button'; b.className = 'acc-h'; b.setAttribute('aria-expanded', 'false'); if (!p.id) p.id = 'acc-' + Math.random().toString(36).slice(2, 8);
      b.setAttribute('aria-controls', p.id);
      b.innerHTML = '<span></span><svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 4.5l3 3 3-3"/></svg>';
      b.firstChild.textContent = label.textContent;
      p.parentNode.insertBefore(b, p);
      b.addEventListener('click', function(){ open(heads[i] === cur ? -1 : i) });
      return b;
    });
    var cur = null;
    function open (k) {
      cur = k >= 0 ? heads[k] : null;
      panels.forEach(function(p, i){ p.classList.toggle('open', i === k); heads[i].setAttribute('aria-expanded', i === k ? 'true' : 'false') });
    }
    var at = panels.map(function(p){ return '#' + p.id }).indexOf(location.hash);
    open(at >= 0 ? at : 0);
    window.addEventListener('hashchange', function(){                     // an in-page link to a closed panel opens it
      var k = panels.map(function(p){ return '#' + p.id }).indexOf(location.hash);
      if (k >= 0) { open(k); heads[k].scrollIntoView({block: 'start'}) }
    });
  }
  function explorerOne (ex) {
    var tabs = ex.querySelector('.ex-tabs'), panels = Array.prototype.slice.call(ex.querySelectorAll('.ex-panels > .pillar'));
    var cv = ex.querySelector('.ex-panels canvas'), cur = 0, D = 6000, t0 = null, paused = false, vis = false, userTook = false;
    var btns = panels.map(function(p, i){
      var b = document.createElement('button'), num = document.createElement('span'), bar = document.createElement('i');
      var id = 'ex-tab-' + i, pid = 'ex-panel-' + i;
      b.type = 'button'; b.id = id; b.setAttribute('role', 'tab'); b.setAttribute('aria-controls', pid);
      var label = p.querySelector(':scope > .tag') || p.querySelector(':scope > h3');                 // results are named by industry, benefits by their title
      b.textContent = label.textContent;
      num.textContent = String(i + 1).padStart(2, '0'); b.appendChild(num); b.appendChild(bar);
      if (!p.id) p.id = pid; p.setAttribute('role', 'tabpanel'); p.setAttribute('aria-labelledby', id); b.setAttribute('aria-controls', p.id);
      b.addEventListener('click', function(){ userTook = true; show(i) });
      b.addEventListener('keydown', function(e){
        var d = (e.key === 'ArrowDown' || e.key === 'ArrowRight') ? 1 : (e.key === 'ArrowUp' || e.key === 'ArrowLeft') ? -1 : 0;
        if (d) { e.preventDefault(); userTook = true; show((cur + d + panels.length) % panels.length); btns[cur].b.focus() }
      });
      tabs.appendChild(b);
      return {b: b, bar: bar};
    });
    function show (i) {
      cur = i; t0 = null;
      panels.forEach(function(p, k){ p.classList.toggle('on', k === i); p.tabIndex = k === i ? 0 : -1; p.setAttribute('aria-hidden', k === i ? 'false' : 'true') });
      btns.forEach(function(o, k){ o.b.setAttribute('aria-selected', k === i ? 'true' : 'false'); o.b.tabIndex = k === i ? 0 : -1; o.bar.style.setProperty('--t', 0) });
    }
    ex.classList.add('ready');
    if (ex.classList.contains('rich')) userTook = true;               // rich panels are read, not skimmed: no automatic advance
    var at = panels.map(function(p){ return '#' + p.id }).indexOf(location.hash);   // a link to one benefit (eg. /#b-safe) opens it
    show(at >= 0 ? at : 0); if (at >= 0) userTook = true;
    window.addEventListener('hashchange', function(){ var k = panels.map(function(p){ return '#' + p.id }).indexOf(location.hash); if (k >= 0) { userTook = true; show(k) } });
    ex.addEventListener('pointerenter', function(){ paused = true });
    ex.addEventListener('pointerleave', function(){ paused = false });
    ex.addEventListener('focusin', function(){ paused = true });
    ex.addEventListener('focusout', function(){ paused = false });
    onView(ex, function(on){ vis = on });

    // flickering grid
    var ctx = cv && cv.getContext('2d'), w = 0, h = 0, cells = [], S = 4, G = 6, pal = [];
    function palette () { pal = ['--sp-1', '--sp-2', '--sp-3', '--sp-4', '--sp-5'].map(css) }
    function size () {
      if (!ctx) return;
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = cv.clientWidth; h = cv.clientHeight; cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cells = [];
      for (var y = 0; y < h; y += S + G) for (var x = 0; x < w; x += S + G) cells.push({x: x, y: y, a: Math.random() * .3, c: Math.random()});
    }
    function grid (dt) {
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);
      cells.forEach(function(c){
        if (!reduce && Math.random() < .045 * dt / 16) c.a = Math.random() * .55;
        var hue = Math.floor((c.c * 2.2 + cur * .8 + c.x / w * 1.8)) % 5;            // each industry shifts the band of colours
        ctx.globalAlpha = c.a; ctx.fillStyle = pal[hue]; ctx.fillRect(c.x, c.y, S, S);
      });
      ctx.globalAlpha = 1;
    }
    palette(); size(); grid(16);
    document.addEventListener('themechange', function(){ palette(); grid(16) });
    if (window.ResizeObserver && cv) new ResizeObserver(function(){ size(); grid(16) }).observe(cv);
    if (reduce) return;
    var last = null;
    (function frame (now) {
      var dt = last === null ? 16 : Math.min(64, now - last); last = now;
      if (vis) {
        if (!paused && !userTook) {
          if (t0 === null) t0 = now - 0;
          var k = (now - t0) / D;
          btns[cur].bar.style.setProperty('--t', Math.min(1, k).toFixed(3));
          if (k >= 1) show((cur + 1) % panels.length);
        } else if (t0 !== null && paused) { t0 += dt }                      // hold the timer while the reader is on it
        grid(dt);
      }
      requestAnimationFrame(frame);
    })(performance.now());
  }
})();
