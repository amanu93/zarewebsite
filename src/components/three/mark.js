/* Zare Innovations — particle assembly of the Z mark.
   <zare-mark> renders one THREE.Points cloud that rests as a streaming field
   across the hero, sweeps out to the right, arcs over the top of the frame and
   pours back down to WRITE a lit, three-dimensional Z left of centre — all
   under an externally driven clock — then holds and sways.

   ARCHITECTURE (after docs/particles.md). Particles never own free positions.
   Each one owns a scalar u along a pre-baked path — an inflow spline that
   sweeps the viewport rightward and over the top, concatenated with the
   glyph's stroke centreline, resampled to equal arc length and baked into a
   float texture. Scroll does not move particles toward targets; it COMPRESSES
   THE PARAMETER WINDOW from [flowStart, 1] down to [0, strokeU], so the whole
   population slides along the path and condenses onto the stroke. Because the
   stroke sits at the low end of the parameter, the head of the stream
   traverses it first and coverage extends from the top of the glyph downward:
   the mark is written, not faded up. Three deliberate departures from the
   reference, all because a glyph is not a ring:

   - No post-arrival orbit. A ring is closed, so overflow scroll can become a
     seamless loop; sliding along a stroke would smear the logo. Ambient drift
     along the path is integrated on the CPU scaled by (1 - progress), so it
     freezes exactly at arrival and the formed state's life comes from
     breathing and twinkle instead.
   - Final positions are exact mask samples, not the path. Each particle
     carries a lateral offset from the stroke centreline to its own cell of
     the rasterised mask (rim, bevel, slab depth included), eased in as tsp²
     — the reference's own trick for its spoke particles.
   - The stroke centreline is not hand-authored. A geodesic distance
     transform through the glyph interior, from its topmost cell, gives every
     mask cell a stroke parameter t; bin centroids give the centreline. The
     glyph stays swappable by replacing one PNG.

   THE MARK READS BY COLOUR, NOT SILHOUETTE. In the logo the Z is teal on a
   navy tile. Particles forming both would render tile and glyph in one colour
   and produce a solid rectangle with no Z in it, so the particles form the
   glyph only and the page background plays the tile.

   Unchanged scaffolding: one draw call, one ShaderMaterial, per-particle
   motion on the GPU from a handful of uniforms, IntersectionObserver lazy
   init, tab-visibility pause, reduced-motion static render, WebGL fallback. */
(function () {
  if (customElements.get('zare-mark')) return;

  var FALLBACK_BG =
    'radial-gradient(80% 110% at 50% 45%, rgba(64,193,199,.16), rgba(0,0,0,0) 60%)';

  var DEFAULT_MASK = '/hero/zare-mark.png';

  /* Mask sampling resolution. Fine enough that the distance transform
     resolves the mark's corners, coarse enough to stay off the boot path. */
  var SAMPLE_W = 200;
  /* The PNG is cropped tight, so the shape touches the image borders; the
     margin gives the distance transform an outside to measure from. */
  var PAD = 6;
  /* Band, in sample pixels, treated as the rim of the slab. */
  var RIM_PX = 2.6;
  /* How far in from the edge the face normals bend toward the rim. */
  var BEVEL_PX = 6.5;
  /* Share of particles allocated to the rim — a few percent of the area but
     the entire silhouette. */
  var RIM_SHARE = 0.34;

  /* World height of the mark, before the host's `scale` attribute. */
  var MARK_H = 1.8;
  /* Slab depth, as a fraction of MARK_H. */
  var THICK = 0.08;

  /* Mark centre at this fraction of the view half-width, left of centre —
     about 27% across — leaving the right half to the state-5 messages.
     Recomputed on resize, clamped so narrow viewports keep the mark on
     screen. */
  var ANCHOR = -0.45;

  /* Path bake. SAMPLES texels per row; each row is one inflow variant ending
     in the same stroke, so the rest field braids instead of drawing one
     line. */
  var SAMPLES = 257;
  /* Bins for the geodesic centreline extraction. */
  var STROKE_BINS = 96;
  /* u per second of ambient conveyor drift at rest, toward the mark. The
     path is ~17 world units long, so this is the dominant rest motion:
     -0.006 is about 20px/s at 1600w — a current you sense, not watch. */
  var FLOW_SPEED = -0.006;
  /* Duration, in seconds, of the time-driven formation used when the scroll
     handover never happens (coarse pointers). */
  var FORM_T = 7;
  /* Depth quantisation. 24 discrete bands, size and opacity co-varying, is
     what reads as a starfield rather than a blur. */
  var DEPTH_BANDS = 24;

  function glowTexture(THREE, inner, outer) {
    var c = document.createElement('canvas');
    c.width = c.height = 64;
    var x = c.getContext('2d');
    var g = x.createRadialGradient(32, 32, 2, 32, 32, 30);
    g.addColorStop(0, inner);
    g.addColorStop(0.35, outer);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }

  /* Deterministic PRNG (mulberry32), so the field is identical across
     reloads and the per-row wobble cannot flicker between visits. */
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* Value-noise fBm, bake-time only. Sampled in PATH SPACE at each particle's
     rest position, so neighbours on the path share low-frequency offsets and
     the rest field forms coherent clouds rather than TV static. */
  function h2(x, y) {
    var s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return s - Math.floor(s);
  }
  function vnoise(x, y) {
    var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    var a = h2(xi, yi), b = h2(xi + 1, yi), c = h2(xi, yi + 1), d = h2(xi + 1, yi + 1);
    return ((a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2) - 1;
  }
  function fbm(x, y) {
    var sum = 0, amp = 1, frq = 1, norm = 0;
    for (var i = 0; i < 4; i++) {
      sum += vnoise(x * frq, y * frq) * amp;
      norm += amp;
      amp *= 0.5;
      frq *= 2;
    }
    return sum / norm;
  }

  /* Two-pass chamfer distance transform, in sample pixels. 0 outside,
     increasing inward. Feeds the rim test and the normal gradient; chamfer's
     ~2% error is far below one particle's diameter. */
  function insideDistance(alpha, W, H) {
    var d = new Float32Array(W * H);
    var i, x, y, m;
    var INF = 1e9, D = 1, Q = 1.41421356;

    for (i = 0; i < W * H; i++) d[i] = alpha[i] > 0.5 ? INF : 0;

    for (y = 1; y < H - 1; y++) {
      for (x = 1; x < W - 1; x++) {
        i = y * W + x;
        if (d[i] === 0) continue;
        m = d[i];
        if (d[i - 1] + D < m) m = d[i - 1] + D;
        if (d[i - W] + D < m) m = d[i - W] + D;
        if (d[i - W - 1] + Q < m) m = d[i - W - 1] + Q;
        if (d[i - W + 1] + Q < m) m = d[i - W + 1] + Q;
        d[i] = m;
      }
    }
    for (y = H - 2; y > 0; y--) {
      for (x = W - 2; x > 0; x--) {
        i = y * W + x;
        if (d[i] === 0) continue;
        m = d[i];
        if (d[i + 1] + D < m) m = d[i + 1] + D;
        if (d[i + W] + D < m) m = d[i + W] + D;
        if (d[i + W + 1] + Q < m) m = d[i + W + 1] + Q;
        if (d[i + W - 1] + Q < m) m = d[i + W - 1] + Q;
        d[i] = m;
      }
    }
    return d;
  }

  /* Rasterises the mask into a padded alpha field, its distance transform and
     rim/face index lists. */
  function buildField(img) {
    var W = SAMPLE_W + PAD * 2;
    var H = Math.max(1, Math.round(SAMPLE_W * img.height / img.width)) + PAD * 2;

    var c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    var ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, PAD, PAD, W - PAD * 2, H - PAD * 2);

    var raw = ctx.getImageData(0, 0, W, H).data;
    var alpha = new Float32Array(W * H);
    for (var i = 0; i < W * H; i++) alpha[i] = raw[i * 4 + 3] / 255;

    var dist = insideDistance(alpha, W, H);

    var rim = [], face = [];
    for (var y = 1; y < H - 1; y++) {
      for (var x = 1; x < W - 1; x++) {
        var j = y * W + x;
        if (dist[j] <= 0) continue;
        if (dist[j] <= RIM_PX) rim.push(j); else face.push(j);
      }
    }
    if (!rim.length || !face.length) return null;

    return { w: W, h: H, dist: dist, rim: rim, face: face };
  }

  /* Geodesic stroke parameterisation. Distance from the glyph's topmost cells
     measured THROUGH the interior (bucketed Dijkstra, 8-neighbour, integer
     costs 2/3 ≈ 1/√2), so the zigzag is followed around its corners rather
     than cut across. Returns per-cell t in [0,1] plus a smoothed centreline
     of bin centroids — which is both the writing order and the path the
     particles ride down. */
  function buildStroke(field) {
    var W = field.w, H = field.h, dist = field.dist;
    var geo = new Float32Array(W * H).fill(-1);

    var topY = -1;
    for (var y = 1; y < H - 1 && topY < 0; y++) {
      for (var x = 1; x < W - 1; x++) {
        if (dist[y * W + x] > 0) { topY = y; break; }
      }
    }
    if (topY < 0) return null;

    var buckets = [[]];
    for (var x0 = 1; x0 < W - 1; x0++) {
      var s0 = topY * W + x0;
      if (dist[s0] > 0) { geo[s0] = 0; buckets[0].push(s0); }
    }

    var NB = [1, -1, W, -W, W + 1, W - 1, -W + 1, -W - 1];
    var NC = [2, 2, 2, 2, 3, 3, 3, 3];
    var maxGeo = 0;

    for (var b = 0; b < buckets.length; b++) {
      var q = buckets[b];
      if (!q) continue;
      for (var qi = 0; qi < q.length; qi++) {
        var cell = q[qi];
        if (geo[cell] !== b) continue; /* stale entry, superseded */
        if (b > maxGeo) maxGeo = b;
        for (var n = 0; n < 8; n++) {
          var nx = cell + NB[n];
          if (dist[nx] <= 0) continue;
          var nc = b + NC[n];
          if (geo[nx] < 0 || nc < geo[nx]) {
            geo[nx] = nc;
            while (buckets.length <= nc) buckets.push([]);
            buckets[nc].push(nx);
          }
        }
      }
    }
    if (!maxGeo) return null;

    /* Bin centroids along t. Bins are cross-sections of the stroke, so their
       centroids trace its middle; two smoothing passes stop the polyline
       jittering where the stroke widens. */
    var sx = new Float32Array(STROKE_BINS), sy = new Float32Array(STROKE_BINS),
        sn = new Float32Array(STROKE_BINS);
    for (var i = 0; i < W * H; i++) {
      if (geo[i] < 0) continue;
      var bin = Math.min(STROKE_BINS - 1, (geo[i] / maxGeo * STROKE_BINS) | 0);
      sx[bin] += i % W;
      sy[bin] += (i / W) | 0;
      sn[bin]++;
    }
    var line = [];
    for (var k = 0; k < STROKE_BINS; k++) {
      if (sn[k]) line.push({ x: sx[k] / sn[k], y: sy[k] / sn[k] });
    }
    for (var pass = 0; pass < 2; pass++) {
      for (var m = 1; m < line.length - 1; m++) {
        line[m] = {
          x: (line[m - 1].x + line[m].x * 2 + line[m + 1].x) / 4,
          y: (line[m - 1].y + line[m].y * 2 + line[m + 1].y) / 4
        };
      }
    }
    return { geo: geo, maxGeo: maxGeo, line: line };
  }

  /* Catmull-Rom through the control points. */
  function spline(pts, samples) {
    var P = [pts[0]].concat(pts, [pts[pts.length - 1]]);
    var segs = P.length - 3, out = [];
    for (var i = 0; i <= samples; i++) {
      var t = (i / samples) * segs;
      var s = Math.min(segs - 1, Math.floor(t)), lt = t - s;
      var p0 = P[s], p1 = P[s + 1], p2 = P[s + 2], p3 = P[s + 3];
      var t2 = lt * lt, t3 = t2 * lt;
      var f = function (a, bb, c, d) {
        return 0.5 * (2 * bb + (-a + c) * lt +
          (2 * a - 5 * bb + 4 * c - d) * t2 + (-a + 3 * bb - 3 * c + d) * t3);
      };
      out.push({ x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) });
    }
    return out;
  }

  /* Concatenates one row's inflow with the stroke and resamples the whole
     thing to SAMPLES equal arc-length steps. Equal arc length is why dot
     spacing looks even everywhere instead of bunching in the bends. Texel
     layout: x, y, strokeU, z — strokeU constant across the row. */
  function bakeRow(inflowPts, strokePts, out, rowOffset) {
    var pts = inflowPts.concat(strokePts);
    var arc = [0];
    for (var i = 1; i < pts.length; i++) {
      var dx = pts[i].x - pts[i - 1].x, dy = pts[i].y - pts[i - 1].y;
      arc.push(arc[i - 1] + Math.sqrt(dx * dx + dy * dy));
    }
    var total = arc[arc.length - 1];
    /* Index inflowPts.length — the FIRST stroke point — not length - 1: the
       segment between the last inflow point and the stroke's top tip is the
       descent, and it belongs to the inflow. Counting it into the stroke
       shifts every arrival point up the path by a t-dependent amount and
       smears the written glyph toward the drop. */
    var strokeU = 1 - arc[inflowPts.length] / total;

    /* Texel 0 is the far end of the inflow (u = 1 in the shader's reversed
       lookup) and texel SAMPLES-1 the stroke's bottom tip (u = 0), matching
       the shader's sp = (1 - u) * (SAMPLES - 1). */
    for (var k = 0; k < SAMPLES; k++) {
      var target = (k / (SAMPLES - 1)) * total;
      var lo = 0, hi = arc.length - 1;
      while (hi - lo > 1) {
        var mid = (lo + hi) >> 1;
        if (arc[mid] <= target) lo = mid; else hi = mid;
      }
      var span = arc[hi] - arc[lo];
      var f = span > 0 ? (target - arc[lo]) / span : 0;
      var o = (rowOffset + k) * 4;
      out[o] = pts[lo].x + (pts[hi].x - pts[lo].x) * f;
      out[o + 1] = pts[lo].y + (pts[hi].y - pts[lo].y) * f;
      out[o + 2] = strokeU;
      /* Gentle depth wave along the inflow, flattening as the path nears the
         stroke so the write lands on plane. */
      out[o + 3] = Math.sin((k / SAMPLES) * Math.PI * 2 + rowOffset) *
        0.35 * Math.min(1, Math.max(0, 1 - k / (SAMPLES - 1)) / 0.3);
    }
    return strokeU;
  }

  /* Pillar icon point sets — CREATE (spark), BUILD (blocks), TRANSFORM
     (cycle). Drawn as primitives on a small canvas and sampled, same idea as
     the mask; normalized to -0.5..0.5. Sandbox-only addition. */
  function buildIconPoints(kind) {
    var c = document.createElement('canvas');
    c.width = c.height = 96;
    var x = c.getContext('2d');
    x.fillStyle = '#fff'; x.strokeStyle = '#fff';
    x.lineWidth = 11; x.lineCap = 'round'; x.lineJoin = 'round';
    if (kind === 0) {
      /* CREATE — four-point spark. */
      x.beginPath();
      x.moveTo(48, 6); x.quadraticCurveTo(53, 43, 90, 48);
      x.quadraticCurveTo(53, 53, 48, 90);
      x.quadraticCurveTo(43, 53, 6, 48);
      x.quadraticCurveTo(43, 43, 48, 6);
      x.fill();
    } else if (kind === 1) {
      /* BUILD — three slabs on the mark's own diagonal. */
      var slab = function (yy, w) {
        x.beginPath();
        x.moveTo(48 - w / 2 + 7, yy); x.lineTo(48 + w / 2 + 7, yy);
        x.lineTo(48 + w / 2 - 7, yy + 16); x.lineTo(48 - w / 2 - 7, yy + 16);
        x.closePath(); x.fill();
      };
      slab(10, 34); slab(38, 52); slab(66, 70);
    } else {
      /* TRANSFORM — two arcs chasing, arrowheads at each end. */
      x.beginPath(); x.arc(48, 48, 32, -1.2, 1.5); x.stroke();
      x.beginPath(); x.arc(48, 48, 32, Math.PI - 1.2, Math.PI + 1.5); x.stroke();
      var head = function (ang) {
        var hx = 48 + 32 * Math.cos(ang), hy = 48 + 32 * Math.sin(ang);
        x.beginPath();
        x.moveTo(hx - Math.sin(ang) * 15, hy + Math.cos(ang) * 15);
        x.lineTo(hx + Math.cos(ang) * 9, hy + Math.sin(ang) * 9);
        x.lineTo(hx - Math.cos(ang) * 9, hy - Math.sin(ang) * 9);
        x.closePath(); x.fill();
      };
      head(1.5); head(Math.PI + 1.5);
    }
    var d = x.getImageData(0, 0, 96, 96).data;
    /* Each point carries a write order t in 0..1 — the icon is DRAWN, like
       the mark: top-to-bottom for the solid glyphs, along the arc for the
       cycle. */
    var pts = [];
    for (var yy = 0; yy < 96; yy++) for (var xx = 0; xx < 96; xx++) {
      if (d[(yy * 96 + xx) * 4 + 3] <= 100) continue;
      var t;
      if (kind === 2) {
        /* Both arcs write together, mirrored — order is angle mod π. */
        var ang = Math.atan2(yy - 48, xx - 48);
        t = ((((ang + 1.2) % Math.PI) + Math.PI) % Math.PI) / Math.PI;
      } else {
        t = yy / 96;
      }
      pts.push([(xx - 48) / 96, (48 - yy) / 96, t]);
    }
    return pts;
  }

  class ZareMark extends HTMLElement {
    static get observedAttributes() { return ['speed']; }

    constructor() {
      super();
      this._speed = 1;
      this._last = 0;
      this._raf = 0;
      this._inView = false;
      this._booted = false;
      this._px = 0; this._py = 0; this._tx = 0; this._ty = 0;
      this._elapsed = 0;
      this._drift = 0;
      /* Formation source. Defaults to the wall clock so the component is
         self-sufficient; the React wrapper hands it the scrollbar instead,
         after a successful boot on a fine pointer without reduced motion. */
      this._scrollDriven = false;
      this._formP = 0;
      this._peelMax = 0;
      this._halfW = 0.7;
      this._halfH = MARK_H / 2;
    }

    /** Public. p is 0..1 across the hero's formation range. */
    setFormProgress(p) {
      this._formP = p < 0 ? 0 : p > 1 ? 1 : p;
    }

    /** Public. Hands the formation clock over to the scrollbar. */
    setScrollDriven(on) {
      this._scrollDriven = !!on;
    }

    /** Public. Release — the whole field disperses upward as the hero hands
     *  off to the next section. */
    setRelease(r) {
      this._relV = r < 0 ? 0 : r > 1 ? 1 : r;
      if (this._pmat && this._pmat.uniforms.uRelease) {
        this._pmat.uniforms.uRelease.value = this._relV;
      }
    }

    /** Public. Per-pillar peel progress, each 0..1 — the front face of the
     *  formed mark streams right to write the three pillar icons. */
    setPeel(a, b, c) {
      this._peelMax = Math.max(a || 0, Math.max(b || 0, c || 0));
      if (this._pmat && this._pmat.uniforms.uPeel) {
        this._pmat.uniforms.uPeel.value.set(a || 0, b || 0, c || 0);
      }
    }

    attributeChangedCallback(n, _o, v) {
      if (n === 'speed') {
        var f = parseFloat(v);
        this._speed = isFinite(f) ? f : 1;
      }
    }

    connectedCallback() {
      var st = this.style;
      st.display = 'block';
      if (getComputedStyle(this).position === 'static') st.position = 'absolute';
      st.inset = '0';
      st.width = '100%';
      st.height = '100%';
      st.pointerEvents = 'none';
      st.overflow = 'hidden';

      var self = this;
      this._io = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          self._inView = e.isIntersecting;
          if (e.isIntersecting && !self._booted) self._boot();
          self._syncRunning();
        });
      }, { rootMargin: '120px' });
      this._io.observe(this);

      this._onVis = function () { self._syncRunning(); };
      document.addEventListener('visibilitychange', this._onVis);
    }

    disconnectedCallback() {
      if (this._io) this._io.disconnect();
      document.removeEventListener('visibilitychange', this._onVis);
      if (this._raf) cancelAnimationFrame(this._raf);
      if (this._ro) this._ro.disconnect();
      if (this._renderer) this._renderer.dispose();
    }

    /* The mask has to be decoded before any geometry exists, so boot is
       async. Nothing is appended until it resolves; a failed load takes the
       same path as a WebGL failure. */
    _boot() {
      if (this._booted) return;
      var self = this;
      if (!window.THREE) { setTimeout(function () { self._boot(); }, 80); return; }
      this._booted = true;

      var img = new Image();
      img.decoding = 'async';
      img.onload = function () {
        var field, stroke;
        try {
          field = buildField(img);
          stroke = field && buildStroke(field);
        } catch { field = null; }
        if (!field || !stroke) { self._fallback(); return; }
        try { self._setup(field, stroke); } catch { self._fallback(); }
      };
      img.onerror = function () { self._fallback(); };
      img.src = this.getAttribute('mask') || DEFAULT_MASK;
    }

    _fallback() {
      var d = document.createElement('div');
      d.style.cssText = 'position:absolute;inset:0;background:' + FALLBACK_BG;
      this.appendChild(d);
    }

    _setup(field, stroke) {
      var THREE = window.THREE, self = this;
      var coarse = matchMedia('(pointer: coarse)').matches || window.innerWidth < 768;
      var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      this._static = reduced;
      this._coarse = coarse;

      var renderer;
      try {
        renderer = new THREE.WebGLRenderer({
          antialias: !coarse, alpha: true,
          powerPreference: 'low-power', preserveDrawingBuffer: true
        });
      } catch { this._fallback(); return; }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.25 : 1.75));
      renderer.domElement.style.cssText =
        'position:absolute;inset:0;width:100%;height:100%;display:block;';
      this.appendChild(renderer.domElement);
      this._renderer = renderer;

      var scene = new THREE.Scene();
      var camera = new THREE.PerspectiveCamera(38, 1, 0.1, 60);
      camera.position.set(0, 0, 6.4);
      this._scene = scene;
      this._camera = camera;

      var group = new THREE.Group();
      group.scale.setScalar(parseFloat(this.getAttribute('scale') || '1') || 1);
      scene.add(group);
      this._group = group;

      var W = field.w, H = field.h, dist = field.dist;
      var rimCells = field.rim, faceCells = field.face;
      var geo = stroke.geo, maxGeo = stroke.maxGeo;

      /* Sample pixels to world units, sized off the mark itself so the
         padding never changes how big it renders. */
      var unit = MARK_H / (H - PAD * 2);
      var cx = W / 2, cy = H / 2;
      var th = MARK_H * THICK;
      this._halfH = MARK_H / 2;
      this._halfW = (W - PAD * 2) * unit / 2;

      /* Anchor before the bake: the inflow control points live in group-local
         coordinates, which depend on where the group sits. */
      var vw = this.clientWidth || 1600, vh = this.clientHeight || 900;
      this._applyAnchor(vw, vh);
      var sc = group.scale.x, ax = group.position.x;
      var halfView = Math.tan(camera.fov * Math.PI / 360) * camera.position.z * (vw / vh);
      var halfViewH = Math.tan(camera.fov * Math.PI / 360) * camera.position.z;
      /* Group-local extents of the visible frame, with margin. Asymmetric,
         because the group is left of centre. */
      var lxMin = (-halfView - ax) / sc - 0.3;
      var lxMax = (halfView - ax) / sc + 0.3;
      var lyMax = halfViewH / sc + 0.2;

      var maskToLocal = function (p) {
        return { x: (p.x - cx) * unit, y: (cy - p.y) * unit };
      };
      var strokeLocal = stroke.line.map(maskToLocal);
      var s0 = strokeLocal[0];

      /* Arc-length parameterisation of the centreline. The trajectory bake
         resamples the whole path by arc length, so the point the shader lands
         a particle on is the ARC-fraction point — the lateral offsets below
         must be measured from that same point, not from the geodesic-fraction
         bin, or the reconstruction warps at the bends. */
      var sArc = [0];
      for (var si = 1; si < strokeLocal.length; si++) {
        var sdx = strokeLocal[si].x - strokeLocal[si - 1].x;
        var sdy = strokeLocal[si].y - strokeLocal[si - 1].y;
        sArc.push(sArc[si - 1] + Math.sqrt(sdx * sdx + sdy * sdy));
      }
      var sTotal = sArc[sArc.length - 1] || 1;
      var strokeAt = function (t) {
        var target = t * sTotal;
        var lo = 0, hi = sArc.length - 1;
        while (hi - lo > 1) {
          var mid = (lo + hi) >> 1;
          if (sArc[mid] <= target) lo = mid; else hi = mid;
        }
        var span = sArc[hi] - sArc[lo];
        var f = span > 0 ? (target - sArc[lo]) / span : 0;
        return {
          x: strokeLocal[lo].x + (strokeLocal[hi].x - strokeLocal[lo].x) * f,
          y: strokeLocal[lo].y + (strokeLocal[hi].y - strokeLocal[lo].y) * f
        };
      };

      /* ---- Bake the trajectory texture -------------------------------- */
      var ROWS = coarse ? 4 : 7;
      var traj = new Float32Array(SAMPLES * ROWS * 4);
      var maxStrokeU = 0;
      var seed = rng(1337);
      for (var r = 0; r < ROWS; r++) {
        /* One inflow per row: entering frame-left, across the frame rising
           right, up the right edge, over the top, down to the stroke's top
           tip. `lane` fans the rows across the full height of the frame —
           the row braids are the rest field, so together they have to cover
           it, not share one line — and the jitter keeps them from reading
           as a printed grid. */
        var lane = ROWS > 1 ? (r / (ROWS - 1) - 0.5) * 1.5 : 0;
        var j1 = (seed() - 0.5), j2 = (seed() - 0.5), j3 = (seed() - 0.5);
        var inflow = spline([
          { x: lxMin - 0.6, y: (lane * 0.9 + j1 * 0.3) * lyMax },
          { x: (lxMin + lxMax) / 2 + j2 * 1.2, y: (lane + j1 * 0.25) * lyMax },
          { x: lxMax * 0.82 + j3 * 0.5, y: (lane * 0.55 + 0.25 + j2 * 0.3) * lyMax },
          { x: lxMax * 0.98, y: (0.98 + j3 * 0.2) * lyMax },
          { x: s0.x + 1.3 + j2 * 0.6, y: lyMax * 1.12 },
          { x: s0.x + 0.28, y: s0.y + 0.85 }
        ], 200);
        var su = bakeRow(inflow, strokeLocal, traj, r * SAMPLES);
        if (su > maxStrokeU) maxStrokeU = su;
      }
      var trajTex = new THREE.DataTexture(
        traj, SAMPLES, ROWS, THREE.RGBAFormat, THREE.FloatType);
      trajTex.magFilter = trajTex.minFilter = THREE.NearestFilter;
      trajTex.needsUpdate = true;

      /* Rest window start. The stroke must sit entirely outside the rest
         window or the glyph would be partly formed before any scrolling;
         derived from the bake rather than assumed. */
      var flowStart = Math.max(0.3, maxStrokeU + 0.03);
      var flowRange = 1 - flowStart;
      this._flowRange = flowRange;

      /* CPU-side path sample, for seeding each particle's rest-position
         noise in path space. */
      var pathAt = function (row, u) {
        var k = Math.round((1 - u) * (SAMPLES - 1));
        var o = (row * SAMPLES + Math.max(0, Math.min(SAMPLES - 1, k))) * 4;
        return { x: traj[o], y: traj[o + 1] };
      };

      /* ---- Particles ---------------------------------------------------- */
      var pillarsOn = !!this.getAttribute('pillars');
      this._pillarsOn = pillarsOn;
      var iconSets = [buildIconPoints(0), buildIconPoints(1), buildIconPoints(2)];
      var iconCx = lxMax * 0.52;
      var iconYs = [lyMax * 0.5, 0, -lyMax * 0.5];
      var iconR = 0.55;

      var N = coarse ? 12000 : 46000;
      /* Share of particles that rest as loose dust across the whole frame
         rather than on the braids. Their scatter offset is the vector from
         their path anchor to a uniform random point, so the same collapse
         that condenses the braids sweeps the dust into the stream. */
      var DUST_SHARE = 0.42;
      var aLat = new Float32Array(N * 3), aNorm = new Float32Array(N * 3),
          aNoise = new Float32Array(N * 3), aU = new Float32Array(N),
          aRow = new Float32Array(N), aSize = new Float32Array(N),
          aBig = new Float32Array(N), aShade = new Float32Array(N),
          aDetach = new Float32Array(N), aPhase = new Float32Array(N),
          aPillar = new Float32Array(N), aIconT = new Float32Array(N * 3),
          aLink = new Float32Array(N);

      for (var i = 0; i < N; i++) {
        var onRim = Math.random() < RIM_SHARE;
        var list = onRim ? rimCells : faceCells;
        var cell = list[(Math.random() * list.length) | 0];
        var py = (cell / W) | 0, pxi = cell - py * W;

        /* Sub-pixel jitter, or the cloud would land on a lattice. */
        var fx = pxi + Math.random() - 0.5, fy = py + Math.random() - 0.5;
        var tx = (fx - cx) * unit;
        var ty = (cy - fy) * unit;

        /* Outward normal from the distance gradient. d increases inward, so
           outward is its negation; y negated again because canvas y runs down
           and world y runs up. */
        var gx = (dist[cell + 1] - dist[cell - 1]) * 0.5;
        var gy = (dist[cell + W] - dist[cell - W]) * 0.5;
        var oxn = -gx, oyn = gy;
        var gl = Math.sqrt(oxn * oxn + oyn * oyn);
        if (gl > 1e-4) { oxn /= gl; oyn /= gl; } else { oxn = 0; oyn = 0; }

        var tz, nx, ny, nz;
        if (onRim) {
          /* Across the full depth, normal fanning with it so the rim reads
             as rounded rather than as a flat wall. */
          var zt = Math.random() * 2 - 1;
          tz = zt * th * 0.5;
          nx = oxn; ny = oyn; nz = zt * 0.8;
        } else {
          /* Front or back face. The shell is hollow: interior volume is
             never visible, so filling it would spend particles on nothing. */
          var sg = Math.random() < 0.5 ? -1 : 1;
          tz = sg * th * 0.5 * (0.88 + Math.random() * 0.12);
          var bev = 1 - dist[cell] / BEVEL_PX;
          if (bev < 0) bev = 0;
          bev *= 0.75;
          nx = oxn * bev; ny = oyn * bev; nz = sg * (1 - bev);
        }
        var nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
        aNorm[i * 3] = nx / nl; aNorm[i * 3 + 1] = ny / nl; aNorm[i * 3 + 2] = nz / nl;

        /* Stroke parameter of this cell — the writing order — and from it
           the particle's u: the window mapping sends u = flowStart to the
           stroke's bottom tip and u = 1 to its top, so t is inverted. The
           jitter feathers the write edge. */
        var t = geo[cell] >= 0 ? geo[cell] / maxGeo : 0.5 - ty / MARK_H;
        /* Floor at 0.002, not 0: tJit = 0 makes aU exactly 1, and the
           shader's wrap sends wmod(flowRange, flowRange) to 0 — teleporting
           top-tip particles to the bottom tip of the stroke. */
        var tJit = Math.max(0.002, Math.min(1, t + (Math.random() - 0.5) * 0.05));
        var u = flowStart + flowRange * (1 - tJit);
        aU[i] = u;
        var row = (Math.random() * ROWS) | 0;
        aRow[i] = row;

        /* Lateral offset: from the arc-fraction centreline point this
           particle's u maps the shader to, out to its own mask cell. Eased
           in as tsp², it is what turns the written line into the full lit
           slab — and because it is measured against the exact point the
           shader samples at arrival, pathPoint + lateral reproduces the
           mask cell exactly. */
        var lineP = strokeAt(tJit);
        aLat[i * 3] = tx - lineP.x;
        aLat[i * 3 + 1] = ty - lineP.y;
        aLat[i * 3 + 2] = tz;

        /* Rest scatter, sampled in path space at this particle's rest
           position: two frequency bands, decorrelated per component. The
           coherence is what gives the rest field its leaning, cloudy grain —
           the "lineation" — instead of uniform fog. */
        var rp = pathAt(row, u);
        if (Math.random() < DUST_SHARE) {
          /* Dust: exact offset to a uniform random point in the frame,
             divided by the shader's scatter gain, so at rest the whole
             viewport is seeded and the same collapse gathers them in. */
          aNoise[i * 3] =
            (lxMin + Math.random() * (lxMax - lxMin) - rp.x) / 2.0;
          aNoise[i * 3 + 1] =
            ((Math.random() * 2 - 1) * lyMax - rp.y) / 1.5;
        } else {
          aNoise[i * 3] = fbm(rp.x * 0.5, rp.y * 0.5) * 0.6 +
            fbm(rp.x * 2.4 + 7.3, rp.y * 2.4) * 0.25;
          aNoise[i * 3 + 1] = fbm(rp.x * 0.5 + 3.1, rp.y * 0.5 + 3.1) * 0.6 +
            fbm(rp.x * 2.4, rp.y * 2.4 + 9.7) * 0.25;
        }
        aNoise[i * 3 + 2] = fbm(rp.x * 0.7 + 11, rp.y * 0.7 + 11) * 0.6;

        /* aSize is the FORMED size — the distribution the settled logo is
           made of, unchanged from the build the mark was approved in. The
           rest field's extra character (a few big bright grains) lives in
           aBig, which the shader fades out with formation so none of it
           survives into the glyph. */
        aSize[i] = 0.5 + Math.random() * Math.random() * 1.25;
        var big = Math.random();
        aBig[i] = big < 0.02 ? 2.8 : big < 0.10 ? 1.9 : 1.0;

        aShade[i] = Math.random();
        /* Peel set: a thin veil of the front face — the mark keeps most of
           its density; peeled particles render larger to compensate. */
        if (pillarsOn && !onRim && tz > 0 && Math.random() < 0.75) {
          var pil = (Math.random() * 3) | 0;
          aPillar[i] = pil + 1;
          if (Math.random() < 0.10) {
            /* Link tracer: rides the mark→icon channel instead of filling
               the icon; z slot is its cycle phase. */
            aLink[i] = 1;
            aIconT[i * 3 + 2] = Math.random();
          } else {
            var ipts = iconSets[pil];
            var ip = ipts[(Math.random() * ipts.length) | 0];
            aIconT[i * 3] = iconCx + ip[0] * iconR + (Math.random() - 0.5) * 0.015;
            aIconT[i * 3 + 1] = iconYs[pil] + ip[1] * iconR + (Math.random() - 0.5) * 0.015;
            /* z slot carries the write order, not depth. */
            aIconT[i * 3 + 2] = ip[2];
          }
        }
        aDetach[i] = Math.random() < 0.03 ? 0.5 + Math.random() : 0.0;
        aPhase[i] = Math.random() * Math.PI * 2;
      }

      var pg = new THREE.BufferGeometry();
      /* `position` carries the lateral offset — every particle's real
         position is computed on the GPU from the path texture. */
      pg.setAttribute('position', new THREE.BufferAttribute(aLat, 3));
      pg.setAttribute('aNorm', new THREE.BufferAttribute(aNorm, 3));
      pg.setAttribute('aNoise', new THREE.BufferAttribute(aNoise, 3));
      pg.setAttribute('aU', new THREE.BufferAttribute(aU, 1));
      pg.setAttribute('aRow', new THREE.BufferAttribute(aRow, 1));
      pg.setAttribute('aSize', new THREE.BufferAttribute(aSize, 1));
      pg.setAttribute('aBig', new THREE.BufferAttribute(aBig, 1));
      pg.setAttribute('aShade', new THREE.BufferAttribute(aShade, 1));
      pg.setAttribute('aDetach', new THREE.BufferAttribute(aDetach, 1));
      pg.setAttribute('aPhase', new THREE.BufferAttribute(aPhase, 1));
      pg.setAttribute('aPillar', new THREE.BufferAttribute(aPillar, 1));
      pg.setAttribute('aIconT', new THREE.BufferAttribute(aIconT, 3));
      pg.setAttribute('aLink', new THREE.BufferAttribute(aLink, 1));

      var pmat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        uniforms: {
          /* Wall clock: breathing, twinkle, detach drift. */
          uTime: { value: 0 },
          /* Formation progress, 0..1. Follows the scrollbar when handed
             over; split from uTime so a stationary visitor never freezes. */
          uForm: { value: 0 },
          /* Ambient conveyor drift along the path, integrated on the CPU
             scaled by (1 - uForm) so it freezes exactly at arrival. */
          uDrift: { value: 0 },
          uTraj: { value: trajTex },
          uRows: { value: ROWS },
          uSamples: { value: SAMPLES },
          uFlowStart: { value: flowStart },
          uPR: { value: Math.min(window.devicePixelRatio || 1, 2) },
          /* Per-pillar peel progress. */
          uPeel: { value: new THREE.Vector3(0, 0, 0) },
          uRelease: { value: 0 },
          uLink0: { value: new THREE.Vector4() },
          uLink1: { value: new THREE.Vector4() },
          uLink2: { value: new THREE.Vector4() }
        },
        vertexShader: [
          'attribute vec3 aNorm; attribute vec3 aNoise;',
          'attribute float aU; attribute float aRow; attribute float aSize; attribute float aBig;',
          'attribute float aShade; attribute float aDetach; attribute float aPhase;',
          'attribute float aPillar; attribute vec3 aIconT; attribute float aLink;',
          'uniform vec3 uPeel; uniform float uRelease;',
          'uniform vec4 uLink0; uniform vec4 uLink1; uniform vec4 uLink2;',
          'uniform float uTime; uniform float uForm; uniform float uDrift;',
          'uniform sampler2D uTraj; uniform float uRows; uniform float uSamples;',
          'uniform float uFlowStart; uniform float uPR;',
          'varying float vShade; varying float vFade; varying float vLight; varying float vForm; varying float vRest;',
          'float wmod(float v, float r){ return mod(mod(v, r) + r, r); }',
          /* Manual bilinear along the row; the float texture is NEAREST.
             u = 1 is the far inflow, u = 0 the stroke's bottom tip. */
          'vec4 traj(float row, float u){',
          '  float sp = (1.0 - clamp(u, 0.0, 1.0)) * (uSamples - 1.0);',
          '  float lo = floor(sp); float f = sp - lo;',
          '  float hi = min(lo + 1.0, uSamples - 1.0);',
          '  float rv = (row + 0.5) / uRows;',
          '  return mix(texture2D(uTraj, vec2((lo + 0.5) / uSamples, rv)),',
          '             texture2D(uTraj, vec2((hi + 0.5) / uSamples, rv)), f);',
          '}',
          'void main(){',
          /* Per-row finish line: golden-ratio staggered so the braids of the
             stream converge at slightly different scroll depths for free. */
          '  float ev = 0.82 + 0.15 * fract(aRow * 0.618034 * 7.0);',
          '  float tsp = clamp(uForm / ev, 0.0, 1.0);',
          '  float strokeU = traj(aRow, 0.0).b;',
          '  float flowRange = 1.0 - uFlowStart;',
          /* THE CORE MOVE: scroll compresses the parameter window from',
             [flowStart, 1] to [0, strokeU]. Particles slide along the path
             and condense onto the stroke; the stream head crosses the glyph
             first, so coverage extends from its top tip downward — the mark
             is written. */
          '  float flowing = wmod(aU - uFlowStart + uDrift, flowRange);',
          '  float squeeze = 1.0 + (strokeU / flowRange - 1.0) * tsp;',
          '  float cu = (uFlowStart * (1.0 - tsp) + flowing) * squeeze;',
          '  vec4 s4 = traj(aRow, cu);',
          /* Scatter collapses on approach to the stroke AND with scroll, so
             the cloud condenses onto the line before the line becomes the
             slab. */
          '  float nU = (1.0 - tsp) * smoothstep(strokeU, strokeU + 0.22, cu);',
          '  float lat = tsp * tsp;',
          '  vec3 pos = vec3(s4.xy, s4.a * (1.0 - tsp))',
          '           + position * lat',
          '           + aNoise * nU * vec3(2.0, 1.5, 1.0);',
          /* Rest wander: every particle strolls its own smooth random loop
             around its anchor — two incommensurate frequencies per axis,
             phases scattered, so no two share a direction or a rhythm —
             and the whole term is gone by arrival. */
          '  float rest = 1.0 - tsp;',
          '  pos += vec3(sin(uTime * 0.05 + aPhase) + 0.6 * sin(uTime * 0.13 + aPhase * 2.1),',
          '              cos(uTime * 0.06 + aPhase * 1.7) + 0.6 * cos(uTime * 0.11 + aPhase * 3.3),',
          '              sin(uTime * 0.04 + aPhase * 2.3)) * 0.035 * rest;',
          '  float formed = smoothstep(0.96, 1.0, tsp);',
          '  pos += aNorm * sin(uTime * 0.5 + aPhase) * 0.010 * formed;',
          '  float dr = max(0.0, sin(uTime * 0.12 + aPhase));',
          '  pos += aNorm * dr * dr * aDetach * 0.30 * formed;',
          /* Pillar peel: the icon is WRITTEN — each particle's departure is
             gated by its cell's order along the icon's stroke, so coverage
             extends along the shape exactly like the mark's own write. The
             small lift is zero at both ends. */
          '  float peelPe = 0.0; float linkGate = 0.0; float linkEnv = 1.0;',
          '  if (aPillar > 0.5) {',
          '    float pp = aPillar < 1.5 ? uPeel.x : (aPillar < 2.5 ? uPeel.y : uPeel.z);',
          '    if (aLink > 0.5) {',
          /* The connection IS particles: tracers cycle the mark→icon channel
             on the wall clock, staggered by phase so the channel reads as a
             continuous current. Faded at both ends so recycling never pops;
             a small transverse wander keeps it a stream, not a printed
             line. */
          '      vec4 LK = aPillar < 1.5 ? uLink0 : (aPillar < 2.5 ? uLink1 : uLink2);',
          /* Half the tracers run mark→icon, half back — dependence flows both
             ways. */
          '      float dir = step(0.5, fract(aPhase * 0.31831)) * 2.0 - 1.0;',
          '      float cyc = fract(aIconT.z + uTime * 0.11 * dir);',
          '      vec2 lp = mix(LK.xy, LK.zw, cyc);',
          '      lp += vec2(sin(aPhase * 7.0 + uTime * 0.5), cos(aPhase * 5.3 + uTime * 0.44)) * 0.012;',
          '      linkGate = smoothstep(0.12, 0.5, pp);',
          '      linkEnv = smoothstep(0.0, 0.12, cyc) * (1.0 - smoothstep(0.86, 1.0, cyc));',
          '      pos = mix(pos, vec3(lp, 0.05), linkGate);',
          '    } else {',
          '    float ord = aIconT.z;',
          '    float st = clamp((pp - ord * 0.68) / 0.32, 0.0, 1.0);',
          '    float pe = st * st * (3.0 - 2.0 * st);',
          '    vec3 lift = vec3(0.12, 0.2, 0.3) * (0.5 + aShade * 0.5) * sin(pe * 3.14159);',
          '    pos = mix(pos, vec3(aIconT.xy, 0.0), pe) + lift;',
          /* Settled icons breathe: a tiny phase-scattered stroll, far below
             one particle diameter of the icon grid, so the shape holds. */
          '    pos += vec3(sin(uTime * 0.5 + aPhase * 3.1),',
          '                cos(uTime * 0.43 + aPhase * 2.3), 0.0) * 0.010 * pe;',
          '    peelPe = pe;',
          '    }',
          '  }',
          /* Release — the field lets go upward as the hero unpins. */
          '  pos += (aNoise * vec3(2.2, 1.2, 1.0) + vec3(0.0, 2.4, 0.0)) * uRelease * uRelease;',
          /* Lit in view space, so the sway moves the highlight across the
             slab instead of painting it on. */
          '  vec3 n = normalize(normalMatrix * aNorm);',
          '  vec3 L = normalize(vec3(-0.35, 0.65, 0.72));',
          '  vLight = 0.30 + 0.70 * max(dot(n, L), 0.0);',
          '  vec4 mv = modelViewMatrix * vec4(pos, 1.0);',
          '  gl_Position = projectionMatrix * mv;',
          /* Quantised depth: ~24 discrete bands with size and opacity
             co-varying (near ≈ 2x the size, 2x the opacity of far) is what
             reads as a starfield rather than a blur. Both factors — and the
             oversized rest grains in aBig — fade out with formation, so the
             settled logo's render reduces exactly to aSize at full fade:
             the approved representation, untouched by the field's
             character. */
          '  float dz = s4.a * rest + position.z * lat + aNoise.z * nU;',
          '  float band = min(' + (DEPTH_BANDS - 1) + '.0, floor(clamp(dz * 0.9 + 0.5, 0.0, 1.0) * ' + DEPTH_BANDS + '.0));',
          '  float dt = band / ' + (DEPTH_BANDS - 1) + '.0;',
          /* Rest points are SMALLER than formed ones — the field reads as fine
             dust; coverage comes from count, not size. */
          '  gl_PointSize = aSize * uPR * (22.0 / -mv.z) * (0.5 + 0.5 * tsp)',
          '    * mix(mix(0.6, 1.4, dt) * aBig, 1.0, tsp) * (1.0 + peelPe * 0.3) * mix(1.0, 0.45, linkGate);',
          '  vShade = aShade;',
          /* Fade the ends of the parameter window at rest, so the slow
             conveyor recycles particles invisibly instead of popping them
             from one end of the path to the other. */
          '  float edge = smoothstep(0.0, 0.05, flowing)',
          '             * (1.0 - smoothstep(flowRange - 0.05, flowRange, flowing));',
          /* Twinkle dies exactly at arrival, so the settled mark is crisp. */
          '  float tw = 0.85 + 0.15 * sin(uTime * 0.55 + aPhase * 4.0);',
          '  vFade = mix(0.72 * tw * mix(0.55, 1.0, dt) * edge, 1.0, tsp);',
          '  vFade *= 1.0 - uRelease;',
          /* Peeled icons sit quieter than the lit slab. */
          '  vFade *= 1.0 - peelPe * 0.38;',
          '  vFade = mix(vFade, 0.6 * linkEnv * (1.0 - uRelease), linkGate);',
          '  vForm = smoothstep(0.45, 0.95, tsp);',
          '  vRest = rest;',
          '}'
        ].join('\n'),
        fragmentShader: [
          'varying float vShade; varying float vFade; varying float vLight; varying float vForm; varying float vRest;',
          'void main(){',
          '  float d = length(gl_PointCoord - 0.5);',
          /* Harder-edged at rest — small crisp dots read as a starfield;
             the soft glow belongs to the formed slab. */
          '  float a = smoothstep(0.5, mix(0.10, 0.34, vRest), d) * vFade;',
          /* The logo teal, its shadow and its highlight. */
          '  vec3 teal = vec3(0.251, 0.757, 0.780);',
          '  vec3 deep = vec3(0.055, 0.290, 0.355);',
          '  vec3 lit  = vec3(0.860, 0.988, 1.0);',
          '  vec3 col = mix(deep, teal, smoothstep(0.0, 0.55, vLight));',
          '  col = mix(col, lit, smoothstep(0.72, 1.0, vLight) * 0.85);',
          '  col = mix(col, lit, vShade * 0.10);',
          /* In flight the stream is pale; the brand colour arrives with the
             shape rather than preceding it. */
          /* At rest and in flight the field is pale, near-white and brighter
             than the formed slab — a starfield against the navy. The brand
             colour and the quieter alpha arrive with the shape. */
          '  vec3 pale = vec3(0.86, 0.94, 0.97);',
          '  col = mix(pale, col, vForm);',
          '  gl_FragColor = vec4(col, a * (0.30 + 0.26 * vRest));',
          '}'
        ].join('\n')
      });

      group.add(new THREE.Points(pg, pmat));
      this._pmat = pmat;
      if (pillarsOn) {
        pmat.uniforms.uLink0.value.set(this._halfW * 0.62, iconYs[0] * 0.22, iconCx - iconR * 0.32, iconYs[0]);
        pmat.uniforms.uLink1.value.set(this._halfW * 0.62, iconYs[1] * 0.22, iconCx - iconR * 0.32, iconYs[1]);
        pmat.uniforms.uLink2.value.set(this._halfW * 0.62, iconYs[2] * 0.22, iconCx - iconR * 0.32, iconYs[2]);
      }


      /* Light that crosses the mark once as it completes, tracing the same
         diagonal the write descends. */
      var tl = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTexture(THREE, 'rgba(235,255,255,.95)', 'rgba(64,193,199,.55)'),
        transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending
      }));
      tl.scale.setScalar(0.5);
      group.add(tl);
      this._sweepLight = tl;


      this._ro = new ResizeObserver(function () { self._resize(); });
      this._ro.observe(this);
      this._resize();

      if (!coarse && !reduced) {
        /* NOT this.parentElement: the canvas sits inside a
           pointer-events-none wrapper, which never receives pointer events —
           a listener there is silently dead. The hero <section> is the
           nearest ancestor that actually gets them; events from the copy and
           the cards bubble up to it, so the field responds wherever in the
           hero the pointer is. */
        var evHost = this.closest('section') || document.body;
        evHost.addEventListener('pointermove', function (e) {
          var rect = self.getBoundingClientRect();
          if (!rect.width || !rect.height) return;
          self._tx = (e.clientX - rect.left) / rect.width * 2 - 1;
          self._ty = (e.clientY - rect.top) / rect.height * 2 - 1;
        });
        evHost.addEventListener('pointerleave', function () {
          self._tx = 0; self._ty = 0;
        });
      }

      if (reduced) {
        /* Formation pushed to the end: the mark renders already written and
           static. Without it a reduced-motion visitor would get the rest
           field, which means nothing on its own. */
        this._pmat.uniforms.uTime.value = 200;
        this._pmat.uniforms.uForm.value = 1;
        this._pmat.uniforms.uDrift.value = 0;
        this._pose(0, 0);
        this._renderOnce();
        return;
      }
      this._syncRunning();
    }

    /* Seats the mark left of centre. `want` is the composition; `minX` the
       constraint — a viewport narrow enough that the composition would push
       the mark past the left edge gets a margin instead. Math.min(0, ...)
       stops the clamp itself pushing the mark right of centre. */
    _applyAnchor(w, h) {
      var halfView = Math.tan(this._camera.fov * Math.PI / 360) *
        this._camera.position.z * (w / h);
      var want = ANCHOR * halfView;
      var minX = -(halfView - this._halfW * this._group.scale.x - 0.25);
      this._group.position.x = Math.min(0, Math.max(want, minX));
    }

    _resize() {
      if (!this._renderer) return;
      var w = this.clientWidth || 1, h = this.clientHeight || 1;
      this._renderer.setSize(w, h, false);
      this._camera.aspect = w / h;
      this._camera.updateProjectionMatrix();
      this._halfViewH = Math.tan(this._camera.fov * Math.PI / 360) * this._camera.position.z;
      this._halfViewW = this._halfViewH * (w / h);
      this._applyAnchor(w, h);
      if (this._static) this._renderOnce();
    }

    /* A logo has an upright, so this sways rather than turning. 0.40rad is
       about 23 degrees: enough that the slab's depth and the light crossing
       it are unmistakable, well short of where the mark stops being legible.
       `gate` holds it flat until there is something written to sway. */
    _pose(t, gate) {
      this._group.rotation.set(
        (-0.05 + 0.05 * Math.sin(t * 0.19)) * gate + this._py * 0.05,
        (0.40 * Math.sin(t * 0.24)) * gate + this._px * 0.10,
        (0.015 * Math.sin(t * 0.16)) * gate
      );
    }

    _renderOnce() {
      if (this._renderer) {
        this._pose(0, 0);
        this._renderer.render(this._scene, this._camera);
      }
    }

    _syncRunning() {
      var should = this._booted && !this._static && this._inView
        && !document.hidden && this._renderer;
      if (should && !this._raf) { this._last = performance.now(); this._tick(); }
      if (!should && this._raf) { cancelAnimationFrame(this._raf); this._raf = 0; }
    }

    _tick() {
      var self = this;
      this._raf = requestAnimationFrame(function () { if (self._raf) self._tick(); });

      var now = performance.now();
      var dt = Math.min(now - this._last, 100) / 1000;
      this._last = now;
      var gate = 1;

      if (this._pmat) {
        this._elapsed += dt;
        this._pmat.uniforms.uTime.value = this._elapsed;

        var form = this._scrollDriven
          ? this._formP
          : Math.min(1, this._elapsed / FORM_T);
        this._pmat.uniforms.uForm.value = form;

        /* The conveyor. At rest it advances (wrapped through the shorter
           side, so the applied value stays small); the APPLIED drift is the
           raw value scaled by (1 - form)^1.5, which is exactly zero at
           arrival no matter how fast the scrub was — a ring can absorb
           leftover drift as orbit; a logo cannot, so every particle must
           land on its own cell. Damping by progress rather than wall time
           also keeps the whole thing reversible. */
        var fr = this._flowRange || 0.7;
        if (form < 0.02) {
          this._drift = ((this._drift + dt * FLOW_SPEED) % fr + fr) % fr;
          if (this._drift > fr / 2) this._drift -= fr;
        }
        this._pmat.uniforms.uDrift.value =
          this._drift * Math.pow(1 - form, 1.5);

        /* Coarse pointers never get the scroll handover, so the pillars
           auto-play after the time-driven formation completes. */
        if (!this._scrollDriven && this._pillarsOn && form >= 1) {
          var pt = this._elapsed - FORM_T - 0.8;
          var c01 = function (v) { return v < 0 ? 0 : v > 1 ? 1 : v; };
          this.setPeel(c01(pt / 2), c01((pt - 2.6) / 2), c01((pt - 5.2) / 2));
        }

        /* Sway eases in as the write completes, and back out as the pillars
           peel — icons far from the origin would swing on the lever arm. */
        gate = Math.max(0, Math.min(1, (form - 0.85) / 0.15));
        gate *= Math.max(0, 1 - (this._peelMax || 0) * 1.4);

        if (this._sweepLight) {
          var lt = this._scrollDriven
            ? (this._formP - 0.62) / 0.38
            : (form - 0.78) / 0.22;
          if (lt > 0 && lt < 1) {
            this._sweepLight.material.opacity = Math.sin(lt * Math.PI) * 0.85;
            this._sweepLight.position.set(
              -this._halfW + lt * this._halfW * 2,
              this._halfH - lt * this._halfH * 2,
              MARK_H * THICK * 0.5 + 0.16
            );
          } else {
            this._sweepLight.material.opacity = 0;
          }
        }
      }

      /* 0.09/frame, not 0.04: at 0.04 the damped pointer trailed far enough
         behind the cursor to read as detached rather than fluid. */
      this._px += (this._tx - this._px) * 0.09;
      this._py += (this._ty - this._py) * 0.09;
      /* Wall clock, so the mark keeps breathing while the visitor is
         stationary at state 4. Only the gate depends on scroll. */
      this._pose(this._elapsed * this._speed * (this._coarse ? 0.75 : 1), gate);
      this._renderer.render(this._scene, this._camera);
    }
  }

  customElements.define('zare-mark', ZareMark);
})();

/* Marks this as an ES module so it can be side-effect imported from
   TypeScript, matching mobius.js. */
export {};
