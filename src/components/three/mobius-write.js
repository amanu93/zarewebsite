/* Zare Innovations — particle assembly of the Möbius strip, WRITTEN.
   <zare-mobius-write> is the mix of the two heroes that shipped before it:

   - From <zare-mark> (mark.js): the whole particle system. The same rest
     field — dust and braids with path-space fBm, quantised depth bands, a
     slow rightward conveyor, per-particle wander — the same sizes, and the
     same scroll movement: particles never own free positions, each owns a
     scalar u along a pre-baked path, and scroll COMPRESSES THE PARAMETER
     WINDOW so the stream sweeps the frame rightward, arcs over the top and
     pours down to WRITE the shape along its length.
   - From <zare-mobius> (mobius.js, the v3 handoff): the target. The shape
     being written is the parametric Möbius strip — R 1.35, half-width 0.5,
     edge-biased halftone density — in the v3 pose, with the loop light
     completing one circuit of the single endless edge as the write lands,
     the eight markers riding it, and the slow continuous rotation after.

   HOW THE WRITE MAPS TO A LOOP. The glyph version's stroke centreline is
   replaced by the strip's own centreline, which at v = 0 is simply a circle
   of radius R in the group's local plane. Write order t runs once around
   from the ring's top (local u = π/2): the stream head arrives there first
   and coverage extends around the loop until it meets its own tail — the
   seam closes where the write began. Each particle's lateral offset is the
   3D vector from its centreline arrival point to its own surface sample
   (the half-twist lives entirely in these offsets), eased in as tsp², the
   same reconstruction the mark used for its slab.

   ONE FRAME, TWO SPACES. The strip only reads as a Möbius from the v3 tilt
   (rotation.x −0.95), but the rest field must fill the SCREEN. So the group
   holds the tilt from the first frame, and the bake transforms every
   view-space control point into the tilted local frame — rendered through
   the pose they land exactly where they were authored. The path's real z
   rides the texel slot the mark used for its depth wave.

   The idle spin (rotation.z) is gated by formation and eases back out on
   reverse scroll, so the anisotropic rest field is never rendered through a
   leftover rotation.

   Unchanged scaffolding: one draw call, one ShaderMaterial, per-particle
   motion on the GPU from a handful of uniforms, IntersectionObserver lazy
   init, tab-visibility pause, reduced-motion static render, WebGL fallback. */
(function () {
  if (customElements.get('zare-mobius-write')) return;

  var FALLBACK_BG =
    'radial-gradient(80% 110% at 50% 45%, rgba(64,193,199,.16), rgba(0,0,0,0) 60%)';

  /* Strip geometry, verbatim from the v3 handoff. */
  var R = 1.35, HW = 0.5;
  /* The v3 pose's base tilt. The bake depends on it (see header), so it is
     a constant here, not a per-frame expression. */
  var TILT = -0.95;

  /* Path bake. SAMPLES texels per row; each row is one inflow variant ending
     in the same centreline, so the rest field braids instead of drawing one
     line. */
  var SAMPLES = 257;
  /* Points along the centreline circle handed to the bake. */
  var RING_PTS = 240;
  /* u per second of ambient conveyor drift at rest. Same current as the
     mark's: -0.006 is about 20px/s at 1600w — sensed, not watched. */
  var FLOW_SPEED = -0.006;
  /* Duration, in seconds, of the time-driven formation used when the scroll
     handover never happens (coarse pointers). */
  var FORM_T = 4.5;
  /* Depth quantisation. 24 discrete bands, size and opacity co-varying, is
     what reads as a starfield rather than a blur. */
  var DEPTH_BANDS = 24;

  /* Möbius surface point. */
  function mobiusPos(u, v, arr) {
    var c = Math.cos(u / 2), s = Math.sin(u / 2), r = R + v * c;
    arr[0] = r * Math.cos(u);
    arr[1] = r * Math.sin(u);
    arr[2] = v * s;
    return arr;
  }

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

  /* Catmull-Rom through the control points — 3D, because the inflow lives in
     the tilted local frame where the screen plane has real depth. */
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
      out.push({
        x: f(p0.x, p1.x, p2.x, p3.x),
        y: f(p0.y, p1.y, p2.y, p3.y),
        z: f(p0.z, p1.z, p2.z, p3.z)
      });
    }
    return out;
  }

  /* Concatenates one row's inflow with the centreline and resamples the whole
     thing to SAMPLES equal arc-length steps. Equal arc length is why dot
     spacing looks even everywhere instead of bunching in the bends. Texel
     layout: x, y, strokeU, z — strokeU constant across the row, z the path's
     real local depth plus the mark's gentle wave, tapering to the ring plane
     as the path nears the write. */
  function bakeRow(inflowPts, strokePts, out, rowOffset) {
    var pts = inflowPts.concat(strokePts);
    var arc = [0];
    for (var i = 1; i < pts.length; i++) {
      var dx = pts[i].x - pts[i - 1].x, dy = pts[i].y - pts[i - 1].y,
          dz = pts[i].z - pts[i - 1].z;
      arc.push(arc[i - 1] + Math.sqrt(dx * dx + dy * dy + dz * dz));
    }
    var total = arc[arc.length - 1];
    /* Index inflowPts.length — the FIRST stroke point — not length - 1: the
       segment between the last inflow point and the ring belongs to the
       inflow. Counting it into the stroke shifts every arrival point around
       the loop by a t-dependent amount and smears the written strip. */
    var strokeU = 1 - arc[inflowPts.length] / total;

    /* Texel 0 is the far end of the inflow (u = 1 in the shader's reversed
       lookup) and texel SAMPLES-1 the write's far end (u = 0), matching the
       shader's sp = (1 - u) * (SAMPLES - 1). */
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
      /* Real path depth plus the mark's wave; both taper out over the last
         30% of the approach so the write lands exactly on the ring plane,
         where the centreline's own z is zero. */
      var taper = Math.min(1, Math.max(0, 1 - k / (SAMPLES - 1)) / 0.3);
      var wave = Math.sin((k / SAMPLES) * Math.PI * 2 + rowOffset) * 0.35;
      out[o + 3] = pts[lo].z + (pts[hi].z - pts[lo].z) * f + wave * taper;
    }
    return strokeU;
  }

  class ZareMobiusWrite extends HTMLElement {
    static get observedAttributes() { return ['speed', 'markers']; }

    constructor() {
      super();
      this._speed = 1;
      this._markers = true;
      this._last = 0;
      this._raf = 0;
      this._inView = false;
      this._booted = false;
      this._px = 0; this._py = 0; this._tx = 0; this._ty = 0;
      this._elapsed = 0;
      this._drift = 0;
      this._angle = 0;
      this._markerT = 0;
      /* Formation source. Defaults to the wall clock so the component is
         self-sufficient; the React wrapper hands it the scrollbar instead,
         after a successful boot on a fine pointer without reduced motion. */
      this._scrollDriven = false;
      this._formP = 0;
    }

    /** Public. p is 0..1 across the hero's formation range. */
    setFormProgress(p) {
      this._formP = p < 0 ? 0 : p > 1 ? 1 : p;
    }

    /** Public. Hands the formation clock over to the scrollbar. */
    setScrollDriven(on) {
      this._scrollDriven = !!on;
    }

    attributeChangedCallback(n, _o, v) {
      if (n === 'speed') {
        var f = parseFloat(v);
        this._speed = isFinite(f) ? f : 1;
      }
      if (n === 'markers') {
        this._markers = !(v === 'false' || v === null);
        if (this._markerGroup) this._markerGroup.visible = this._markers;
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

      /* hidden founder signal — eight markers, one endless road */
      if (!this.dataset.route) this.dataset.route = '0x08-ring';
      if (!window.__zareLoop) {
        window.__zareLoop = 1;
        try { console.info('%c∞  zare · the loop has no seam · 8 lights walk it until the bell rings', 'color:#40c1c7;font:12px monospace'); } catch (e) {}
      }

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

    _boot() {
      if (this._booted) return;
      var self = this;
      if (!window.THREE) { setTimeout(function () { self._boot(); }, 80); return; }
      this._booted = true;
      try { this._setup(); } catch (e) { this._fallback(); }
    }

    _fallback() {
      // Published so the scroll driver can refuse (or revoke) the pinned
      // choreography when no renderer exists — a flat gradient must never
      // earn 280svh of scrubbing.
      this.dataset.fallback = 'true';
      var d = document.createElement('div');
      d.style.cssText = 'position:absolute;inset:0;background:' + FALLBACK_BG;
      this.appendChild(d);
    }

    _setup() {
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
      } catch (e) { this._fallback(); return; }
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
      var ox = this.dataset.ox, oy = this.dataset.oy;
      group.position.x = ox != null && ox !== '' ? parseFloat(ox) : 0;
      group.position.y = oy != null && oy !== '' ? parseFloat(oy) : 0.1;
      if (isNaN(group.position.x)) group.position.x = 0;
      if (isNaN(group.position.y)) group.position.y = 0.1;
      group.scale.setScalar(parseFloat(this.getAttribute('scale') || '1') || 1);
      scene.add(group);
      this._group = group;

      /* View-space frame extents, with margin. The rest field is authored
         against the SCREEN; every control point is then carried into the
         tilted local frame below. */
      var vw = this.clientWidth || 1600, vh = this.clientHeight || 900;
      var halfViewH = Math.tan(camera.fov * Math.PI / 360) * camera.position.z;
      var halfView = halfViewH * (vw / vh);
      var lxMin = -halfView - 0.3, lxMax = halfView + 0.3, lyMax = halfViewH + 0.2;

      /* View plane (z = 0) into the tilted local frame: subtract the group
         offset, undo the scale, undo the base tilt. Rendered back through
         the pose, a baked point lands exactly where it was authored. */
      var sc = group.scale.x, gx = group.position.x, gy = group.position.y;
      var ctl = Math.cos(TILT), stl = Math.sin(TILT);
      var toLocal = function (p) {
        var x = (p.x - gx) / sc, yi = (p.y - gy) / sc;
        /* Inverse of Rx(TILT) applied to (yi, 0). */
        return { x: x, y: yi * ctl, z: yi * -stl };
      };

      /* The centreline: at v = 0 the strip's spine is a circle of radius R
         in the local plane. The write starts at the ring's top (local
         u = π/2 — still the top of the frame through the tilt) and runs
         once around, counterclockwise, continuing the inflow's leftward
         motion over the top of the frame. */
      var U0 = Math.PI / 2;
      var ringAt = function (t) {
        var a = U0 + t * Math.PI * 2;
        return { x: R * Math.cos(a), y: R * Math.sin(a), z: 0 };
      };
      var strokeLocal = [];
      for (var rp = 0; rp <= RING_PTS; rp++) strokeLocal.push(ringAt(rp / RING_PTS));
      var s0 = strokeLocal[0];

      /* ---- Bake the trajectory texture -------------------------------- */
      var ROWS = coarse ? 4 : 7;
      var traj = new Float32Array(SAMPLES * ROWS * 4);
      var maxStrokeU = 0;
      var seed = rng(1337);
      for (var r = 0; r < ROWS; r++) {
        /* One inflow per row: entering frame-left, across the frame rising
           right, up the right edge, over the top, down to the ring's top.
           Authored in view space — `lane` fans the rows across the full
           height of the frame — then carried into the local frame. The last
           control point is placed just above the ring top so the descent
           segment (which belongs to the inflow) drops onto the write. */
        var lane = ROWS > 1 ? (r / (ROWS - 1) - 0.5) * 1.5 : 0;
        var j1 = (seed() - 0.5), j2 = (seed() - 0.5), j3 = (seed() - 0.5);
        var s0v = { /* ring top back in view space, for authoring the drop */
          x: s0.x * sc + gx,
          y: (s0.y * ctl) * sc + gy /* Rx(TILT) of (y,0): y' = y·cos */
        };
        var inflow = spline([
          { x: lxMin - 0.6, y: (lane * 0.9 + j1 * 0.3) * lyMax },
          { x: (lxMin + lxMax) / 2 + j2 * 1.2, y: (lane + j1 * 0.25) * lyMax },
          { x: lxMax * 0.82 + j3 * 0.5, y: (lane * 0.55 + 0.25 + j2 * 0.3) * lyMax },
          { x: lxMax * 0.98, y: (0.98 + j3 * 0.2) * lyMax },
          { x: s0v.x + 1.3 + j2 * 0.6, y: lyMax * 1.12 },
          { x: s0v.x + 0.28, y: s0v.y + 0.85 }
        ].map(toLocal), 200);
        var su = bakeRow(inflow, strokeLocal, traj, r * SAMPLES);
        if (su > maxStrokeU) maxStrokeU = su;
      }
      var trajTex = new THREE.DataTexture(
        traj, SAMPLES, ROWS, THREE.RGBAFormat, THREE.FloatType);
      trajTex.magFilter = trajTex.minFilter = THREE.NearestFilter;
      trajTex.needsUpdate = true;

      /* Rest window start. The write must sit entirely outside the rest
         window or the strip would be partly formed before any scrolling;
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
          aDetach = new Float32Array(N), aPhase = new Float32Array(N);

      var p = [0, 0, 0], q = [0, 0, 0];
      for (var i = 0; i < N; i++) {
        /* Surface sample, with the v3 halftone density: v biased toward the
           edges, sinusoidal density bands along u. Rejection re-runs the
           draw rather than thinning N. */
        var um = Math.random() * Math.PI * 2;
        var vv = (Math.random() * 2 - 1);
        if (Math.random() < 0.35) vv = Math.sign(vv || 1) * (0.75 + 0.25 * Math.random());
        var band = 0.5 + 0.5 * Math.sin(um * 6);
        if (Math.random() > 0.55 + 0.45 * band && Math.random() < 0.5) { i--; continue; }
        var v = vv * HW;

        /* Write order: the fraction of the loop between the ring top and
           this sample's angle. The surface is evaluated at the un-wrapped
           angle so sample, centreline point and normal all agree. */
        var t = ((um - U0) / (Math.PI * 2) % 1 + 1) % 1;
        var ua = U0 + t * Math.PI * 2;
        mobiusPos(ua, v, p);

        /* Surface normal via tangent cross, as in the v3 build. */
        mobiusPos(ua + 0.01, v, q);
        var tx = q[0] - p[0], ty = q[1] - p[1], tz = q[2] - p[2];
        mobiusPos(ua, v + 0.01, q);
        var bx = q[0] - p[0], by = q[1] - p[1], bz = q[2] - p[2];
        var nx = ty * bz - tz * by, ny = tz * bx - tx * bz, nz = tx * by - ty * bx;
        var nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
        aNorm[i * 3] = nx / nl; aNorm[i * 3 + 1] = ny / nl; aNorm[i * 3 + 2] = nz / nl;

        /* The particle's u from its write order; jitter feathers the write
           edge. Floor at 0.002, not 0: tJit = 0 makes aU exactly 1, and the
           shader's wrap sends wmod(flowRange, flowRange) to 0 — teleporting
           seam particles to the far end of the write. */
        var tJit = Math.max(0.002, Math.min(1, t + (Math.random() - 0.5) * 0.05));
        var u = flowStart + flowRange * (1 - tJit);
        aU[i] = u;
        var row = (Math.random() * ROWS) | 0;
        aRow[i] = row;

        /* Lateral offset: from the centreline point this particle's u maps
           the shader to, out to its own surface sample. Eased in as tsp², it
           is what turns the written line into the full twisted strip — the
           half-twist lives entirely in these offsets — and because it is
           measured against the exact point the shader samples at arrival,
           pathPoint + lateral reproduces the surface sample exactly. */
        var lineP = ringAt(tJit);
        aLat[i * 3] = p[0] - lineP.x;
        aLat[i * 3 + 1] = p[1] - lineP.y;
        aLat[i * 3 + 2] = p[2];

        /* Rest scatter, sampled in path space at this particle's rest
           position: two frequency bands, decorrelated per component. The
           coherence is what gives the rest field its leaning, cloudy grain —
           the "lineation" — instead of uniform fog. */
        var rp2 = pathAt(row, u);
        if (Math.random() < DUST_SHARE) {
          /* Dust: exact offset to a uniform random point in the frame,
             authored in view space and carried into the local frame, divided
             by the shader's scatter gain, so at rest the whole viewport is
             seeded and the same collapse gathers them in. */
          var dp = toLocal({
            x: lxMin + Math.random() * (lxMax - lxMin),
            y: (Math.random() * 2 - 1) * lyMax
          });
          aNoise[i * 3] = (dp.x - rp2.x) / 2.0;
          aNoise[i * 3 + 1] = (dp.y - rp2.y) / 1.5;
        } else {
          aNoise[i * 3] = fbm(rp2.x * 0.5, rp2.y * 0.5) * 0.6 +
            fbm(rp2.x * 2.4 + 7.3, rp2.y * 2.4) * 0.25;
          aNoise[i * 3 + 1] = fbm(rp2.x * 0.5 + 3.1, rp2.y * 0.5 + 3.1) * 0.6 +
            fbm(rp2.x * 2.4, rp2.y * 2.4 + 9.7) * 0.25;
        }
        aNoise[i * 3 + 2] = fbm(rp2.x * 0.7 + 11, rp2.y * 0.7 + 11) * 0.6;

        /* aSize is the FORMED size — the distribution the settled strip is
           made of, the same one the mark shipped with. The rest field's
           extra character (a few big bright grains) lives in aBig, which the
           shader fades out with formation so none of it survives into the
           strip. */
        aSize[i] = 0.5 + Math.random() * Math.random() * 1.25;
        var big = Math.random();
        aBig[i] = big < 0.02 ? 2.8 : big < 0.10 ? 1.9 : 1.0;

        aShade[i] = Math.random();
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

      var pmat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        uniforms: {
          /* Wall clock: breathing, twinkle, detach drift. */
          uTime: { value: 0 },
          /* Formation progress, 0..1. Follows the scrollbar when handed
             over; split from uTime so a stationary visitor never freezes. */
          uForm: { value: 0 },
          /* Ambient conveyor drift along the path, integrated on the CPU
             scaled by (1 - uForm)^1.5 so it freezes exactly at arrival. */
          uDrift: { value: 0 },
          uTraj: { value: trajTex },
          uRows: { value: ROWS },
          uSamples: { value: SAMPLES },
          uFlowStart: { value: flowStart },
          uPR: { value: Math.min(window.devicePixelRatio || 1, 2) }
        },
        vertexShader: [
          'attribute vec3 aNorm; attribute vec3 aNoise;',
          'attribute float aU; attribute float aRow; attribute float aSize; attribute float aBig;',
          'attribute float aShade; attribute float aDetach; attribute float aPhase;',
          'uniform float uTime; uniform float uForm; uniform float uDrift;',
          'uniform sampler2D uTraj; uniform float uRows; uniform float uSamples;',
          'uniform float uFlowStart; uniform float uPR;',
          'varying float vShade; varying float vFade; varying float vLight; varying float vForm; varying float vRest;',
          'float wmod(float v, float r){ return mod(mod(v, r) + r, r); }',
          /* Manual bilinear along the row; the float texture is NEAREST.
             u = 1 is the far inflow, u = 0 the write\'s far end. */
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
             and condense onto the centreline; the stream head crosses the
             ring first, so coverage extends around the loop from its top —
             the strip is written. */
          '  float flowing = wmod(aU - uFlowStart + uDrift, flowRange);',
          '  float squeeze = 1.0 + (strokeU / flowRange - 1.0) * tsp;',
          '  float cu = (uFlowStart * (1.0 - tsp) + flowing) * squeeze;',
          '  vec4 s4 = traj(aRow, cu);',
          /* Scatter collapses on approach to the write AND with scroll, so
             the cloud condenses onto the line before the line becomes the
             strip. */
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
          /* Lit in view space, so the rotation moves the highlight across
             the strip instead of painting it on. */
          '  vec3 n = normalize(normalMatrix * aNorm);',
          '  vec3 L = normalize(vec3(-0.35, 0.65, 0.72));',
          '  vLight = 0.30 + 0.70 * max(dot(n, L), 0.0);',
          '  vec4 mv = modelViewMatrix * vec4(pos, 1.0);',
          '  gl_Position = projectionMatrix * mv;',
          /* Quantised depth: ~24 discrete bands with size and opacity
             co-varying (near ≈ 2x the size, 2x the opacity of far) is what
             reads as a starfield rather than a blur. Both factors — and the
             oversized rest grains in aBig — fade out with formation, so the
             settled strip\'s render reduces exactly to aSize at full fade. */
          /* s4.a carries the path's REAL local depth, which through the base
             tilt is proportional to screen height (z = y·tan(0.95)); banding
             on it raw would paint a top-bright gradient across the frame.
             Subtracting the plane depth leaves the braid wave — the same
             quantity the mark banded on. */
          '  float dz = (s4.a - s4.y * 1.3985) * rest + position.z * lat + aNoise.z * nU;',
          '  float band = min(' + (DEPTH_BANDS - 1) + '.0, floor(clamp(dz * 0.9 + 0.5, 0.0, 1.0) * ' + DEPTH_BANDS + '.0));',
          '  float dt = band / ' + (DEPTH_BANDS - 1) + '.0;',
          /* Rest points are SMALLER than formed ones — the field reads as fine
             dust; coverage comes from count, not size. */
          '  gl_PointSize = aSize * uPR * (22.0 / -mv.z) * (0.5 + 0.5 * tsp)',
          '    * mix(mix(0.6, 1.4, dt) * aBig, 1.0, tsp);',
          '  vShade = aShade;',
          /* Fade the ends of the parameter window at rest, so the slow
             conveyor recycles particles invisibly instead of popping them
             from one end of the path to the other. */
          '  float edge = smoothstep(0.0, 0.05, flowing)',
          '             * (1.0 - smoothstep(flowRange - 0.05, flowRange, flowing));',
          /* Twinkle dies exactly at arrival, so the settled strip is crisp. */
          '  float tw = 0.85 + 0.15 * sin(uTime * 0.55 + aPhase * 4.0);',
          '  vFade = mix(0.72 * tw * mix(0.55, 1.0, dt) * edge, 1.0, tsp);',
          '  vForm = smoothstep(0.45, 0.95, tsp);',
          '  vRest = rest;',
          '}'
        ].join('\n'),
        fragmentShader: [
          'varying float vShade; varying float vFade; varying float vLight; varying float vForm; varying float vRest;',
          'void main(){',
          '  float d = length(gl_PointCoord - 0.5);',
          /* Harder-edged at rest — small crisp dots read as a starfield;
             the soft glow belongs to the formed strip. */
          '  float a = smoothstep(0.5, mix(0.10, 0.34, vRest), d) * vFade;',
          /* The logo teal, its shadow and its highlight. */
          '  vec3 teal = vec3(0.251, 0.757, 0.780);',
          '  vec3 deep = vec3(0.055, 0.290, 0.355);',
          '  vec3 lit  = vec3(0.860, 0.988, 1.0);',
          '  vec3 col = mix(deep, teal, smoothstep(0.0, 0.55, vLight));',
          '  col = mix(col, lit, smoothstep(0.72, 1.0, vLight) * 0.85);',
          '  col = mix(col, lit, vShade * 0.10);',
          /* At rest and in flight the field is pale, near-white and brighter
             than the formed strip — a starfield against the navy. The brand
             colour and the quieter alpha arrive with the shape. */
          '  vec3 pale = vec3(0.86, 0.94, 0.97);',
          '  col = mix(pale, col, vForm);',
          '  gl_FragColor = vec4(col, a * (0.30 + 0.26 * vRest));',
          '}'
        ].join('\n')
      });

      group.add(new THREE.Points(pg, pmat));
      this._pmat = pmat;

      /* The single endless edge, u ∈ [0, 4π] at v = HW, for the loop light
         and the eight markers — both from the v3 build. */
      var edgePts = [], ep = [0, 0, 0];
      var edgeN = coarse ? 220 : 420;
      for (var e = 0; e < edgeN; e++) {
        mobiusPos(4 * Math.PI * e / edgeN, HW, ep);
        edgePts.push(new THREE.Vector3(ep[0], ep[1], ep[2]));
      }
      this._edge = new THREE.CatmullRomCurve3(edgePts, true);

      /* Light that completes one circuit of the edge as the write lands. */
      var tl = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTexture(THREE, 'rgba(235,255,255,.95)', 'rgba(64,193,199,.55)'),
        transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending
      }));
      tl.scale.setScalar(0.42);
      group.add(tl);
      this._loopLight = tl;

      /* 8 faint milestone markers riding the edge, gated by formation —
         before the strip exists there is nothing for them to ride. */
      var mg = new THREE.Group();
      var mtex = glowTexture(THREE, 'rgba(255,255,255,.9)', 'rgba(64,193,199,.6)');
      for (var m = 0; m < 8; m++) {
        var sp = new THREE.Sprite(new THREE.SpriteMaterial({
          map: mtex, transparent: true, opacity: 0,
          depthWrite: false, blending: THREE.AdditiveBlending
        }));
        sp.scale.setScalar(0.16);
        mg.add(sp);
      }
      mg.visible = this._markers;
      group.add(mg);
      this._markerGroup = mg;

      this._ro = new ResizeObserver(function () { self._resize(); });
      this._ro.observe(this);
      this._resize();

      if (!coarse && !reduced) {
        /* NOT this.parentElement: the canvas sits inside a
           pointer-events-none wrapper, which never receives pointer events —
           a listener there is silently dead. The hero <section> is the
           nearest ancestor that actually gets them. */
        var evHost = this.closest('section') || document.body;
        evHost.addEventListener('pointermove', function (e2) {
          var rect = self.getBoundingClientRect();
          if (!rect.width || !rect.height) return;
          self._tx = (e2.clientX - rect.left) / rect.width * 2 - 1;
          self._ty = (e2.clientY - rect.top) / rect.height * 2 - 1;
        });
        evHost.addEventListener('pointerleave', function () {
          self._tx = 0; self._ty = 0;
        });
      }

      if (reduced) {
        /* Formation pushed to the end: the strip renders already written,
           mid-rotation, static. */
        this._pmat.uniforms.uTime.value = 200;
        this._pmat.uniforms.uForm.value = 1;
        this._pmat.uniforms.uDrift.value = 0;
        this._angle = 1.1;
        this._pose(0, 1);
        this._renderOnce();
        return;
      }
      this._syncRunning();
    }

    _resize() {
      if (!this._renderer) return;
      var w = this.clientWidth || 1, h = this.clientHeight || 1;
      this._renderer.setSize(w, h, false);
      this._camera.aspect = w / h;
      this._camera.updateProjectionMatrix();
      if (this._static) this._renderOnce();
    }

    /* The v3 pose, around the constant base tilt the bake assumed. `g` is
       the formation gate: the wobble, the parallax weight and the spin all
       ease in as the write completes — and back out on reverse scroll, so
       the anisotropic rest field is never rendered through a leftover
       rotation. The base tilt itself never moves. */
    _pose(t, g) {
      this._group.rotation.set(
        TILT + (0.07 * Math.sin(t * 0.19)) * g + this._py * 0.06,
        (0.12 * Math.sin(t * 0.13)) * g + this._px * 0.1,
        this._angle * g
      );
      var mOp = 0.22 * g * (this._markers ? 1 : 0);
      if (this._markerGroup) {
        for (var i = 0; i < 8; i++) {
          var mk = this._markerGroup.children[i];
          mk.material.opacity = mOp;
          if (mOp > 0) mk.position.copy(this._edge.getPointAt((this._markerT + i / 8) % 1));
        }
      }
    }

    _renderOnce() {
      if (this._renderer) {
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
      var sp = this._speed * (this._coarse ? 0.75 : 1);
      var gate = 0;

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
           arrival no matter how fast the scrub was — every particle must
           land on its own surface sample for the strip to read. Damping by
           progress rather than wall time also keeps it reversible. */
        var fr = this._flowRange || 0.7;
        if (form < 0.02) {
          this._drift = ((this._drift + dt * FLOW_SPEED) % fr + fr) % fr;
          if (this._drift > fr / 2) this._drift -= fr;
        }
        this._pmat.uniforms.uDrift.value =
          this._drift * Math.pow(1 - form, 1.5);

        /* Wobble, spin and markers ease in over the write's last stretch. */
        gate = Math.max(0, Math.min(1, (form - 0.85) / 0.15));
        this._angle += dt * 0.11 * sp * gate;
        this._markerT = (this._markerT + dt * 0.016 * sp) % 1;

        /* The loop light: one full circuit of the single endless edge as
           the write completes — the v3 beat, on the mark's clock. */
        if (this._loopLight) {
          var lt = this._scrollDriven
            ? (this._formP - 0.62) / 0.38
            : (form - 0.78) / 0.22;
          if (lt > 0 && lt < 1) {
            this._loopLight.material.opacity = Math.sin(lt * Math.PI) * 0.9;
            this._loopLight.position.copy(this._edge.getPointAt(lt % 1));
          } else {
            this._loopLight.material.opacity = 0;
          }
        }
      }

      /* 0.09/frame, not 0.04: at 0.04 the damped pointer trailed far enough
         behind the cursor to read as detached rather than fluid. */
      this._px += (this._tx - this._px) * 0.09;
      this._py += (this._ty - this._py) * 0.09;
      /* Wall clock, so the strip keeps breathing and turning while the
         visitor is stationary. Only the gate depends on scroll. */
      this._pose(this._elapsed * sp, gate);
      this._renderer.render(this._scene, this._camera);
    }
  }

  customElements.define('zare-mobius-write', ZareMobiusWrite);
})();

/* Marks this as an ES module so it can be side-effect imported from
   TypeScript, matching mark.js and mobius.js. */
export {};
