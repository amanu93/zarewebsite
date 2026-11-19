/* Zare Innovations — particle assembly of the globe, WRITTEN.
   <zare-globe-write> is the third mix in the family that produced
   <zare-mobius-write>:

   - From <zare-mark> (mark.js): the whole particle system. The rest field —
     dust and braids with path-space fBm, quantised depth bands, the slow
     rightward conveyor, per-particle wander — the sizes, and the scroll
     movement: each particle owns a scalar u along a pre-baked path and
     scroll COMPRESSES THE PARAMETER WINDOW, so the stream sweeps the frame
     rightward, arcs over the top and pours down to WRITE the shape.
   - From the zare-website-v3 globe (zare-body.html): the target and its
     life. The shape being written is a PLAIN particle sphere — points
     uniform over the whole surface; geography belongs to the revealed
     globe underneath, never to the field. As the write completes, the
     globe's other layers arrive with it: the opaque navy core, the
     atmospheric rim, illuminated coastlines, faint borders, the bright
     Ethiopia outline, pulsing served-country markers, and delivery arcs
     out of Addis Ababa with moving flight lights. Formed, the globe is
     INTERACTIVE: it spins slowly, fine pointers can drag it, and hovering
     Addis Ababa raises its label.

   HOW THE WRITE MAPS TO A SPHERE. The centreline is the equator,
   parameterised once around from the point diametrically opposite Addis
   Ababa — the write starts on the sphere's far top edge, sweeps the
   meridians around like a scanner, and Ethiopia lands facing the camera as
   the loop closes. Each particle's lateral offset is the 3D vector from
   its equatorial arrival point to its own land dot, eased in as tsp²: at
   arrival pathPoint + lateral reproduces the dot exactly — a sphere of
   the field's own particles.

   THE REVEAL. The particle sphere is not the final globe — it is its
   chrysalis. A second scroll window (setReveal) fades the REAL v3 globe
   in — fine land dots, core, coastlines, borders, Ethiopia, markers,
   arcs, flights — while the field particles LIFT OFF the surface into an
   orbiting shell around it: the atmosphere glow is made of particles,
   not a gradient sprite, and the globe underneath stays clean. Particles
   crossing in front of the disc are veiled out so the geography reads
   unobstructed; the shell shows around the limb, where an atmosphere
   belongs. Fully reversible: scrolling back re-condenses the halo onto
   the sphere and hands it back to the write.

   ONE FRAME, TWO SPACES — same trick as the Möbius: the group holds its
   base pose (tilt 0.38, Ethiopia-forward yaw) from the first frame, and
   the bake carries every view-authored control point into that local frame
   through the inverse pose matrix. Depth banding subtracts the view plane
   (uPlane) so the bands key on the braid wave, not on screen height. The
   idle spin and any drag are applied THROUGH the formation gate, so they
   ease out on reverse scroll and the rest field is never rendered through
   a leftover rotation.

   Geometry data loads at boot: /hero/earth-water.png (land mask) and
   /hero/countries-110m.json (TopoJSON), decoded in JS exactly as the v3
   build script did in Python. A failed load takes the WebGL-failure path.

   Unchanged scaffolding: one draw call for the particles, motion on the
   GPU from a handful of uniforms, IntersectionObserver lazy init,
   tab-visibility pause, reduced-motion static render, WebGL fallback. */
(function () {
  if (customElements.get('zare-globe-write')) return;

  var FALLBACK_BG =
    'radial-gradient(80% 110% at 50% 45%, rgba(64,193,199,.16), rgba(0,0,0,0) 60%)';

  var MASK_SRC = '/hero/earth-water.png';
  var GEO_SRC = '/hero/countries-110m.json';

  /* Globe radius in group-local units, before the host `scale` attribute. */
  var GR = 1.0;
  /* The v3 globe pose: forward tilt, Ethiopia facing the camera. The bake
     depends on both (see header), so they are constants. */
  var TILT_X = 0.38;
  /* served markers — mirrors the marker set on zareinnovations.com's globe */
  var MARKERS = [
    { id: 'ETH', ll: [9.02, 38.75], home: true },
    { id: 'USA', ll: [37.0902, -95.7129] },
    { id: 'CAN', ll: [55.1304, -106.3468] },
    { id: 'SEN', ll: [14.4974, -14.4524] },
    { id: 'ZAF', ll: [-30.5595, 22.9375] },
    { id: 'CYP', ll: [35.1264, 33.4299] },
    { id: 'GBR', ll: [52.5862, -2.1265] }
  ];
  var HOME_ROT = -MARKERS[0].ll[1] * Math.PI / 180; /* Ethiopia faces camera */
  /* Write start: the equator point opposite Addis — the sphere's far edge.
     The sweep runs once around and the loop closes where it began. */
  var LON0 = MARKERS[0].ll[1] + 180;

  /* Globe centre at this fraction of the view half-width. Off-centre
     left — the reveal brings a descriptive block in on the right — but
     well short of the edge. Clamped on narrow viewports. */
  var ANCHOR = -0.28;

  var SAMPLES = 257;
  var RING_PTS = 240;
  var FLOW_SPEED = -0.006;
  var FORM_T = 7;
  var DEPTH_BANDS = 24;

  function ll2v(lat, lon, r) {
    var la = lat * Math.PI / 180, lo = lon * Math.PI / 180;
    return {
      x: r * Math.cos(la) * Math.sin(lo),
      y: r * Math.sin(la),
      z: r * Math.cos(la) * Math.cos(lo)
    };
  }

  /* Soft dot for the v3 land-mass layers — ported verbatim. The rim glow
     that used to be a gradient sprite is now the particle halo itself. */
  function dotTexture(THREE) {
    var c = document.createElement('canvas');
    c.width = c.height = 32;
    var x = c.getContext('2d');
    var g = x.createRadialGradient(16, 16, 1, 16, 16, 15);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.5, 'rgba(255,255,255,.6)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 32, 32);
    return new THREE.CanvasTexture(c);
  }

  /* Deterministic PRNG (mulberry32) — identical field across reloads. */
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* Value-noise fBm, bake-time only; sampled in path space (see mark.js). */
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

  /* Catmull-Rom through 3D control points. */
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

  /* Inflow + equator, resampled to SAMPLES equal arc-length steps. Texel:
     x, y, strokeU, z — z is the path's REAL local depth (the equator is a
     full 3D circle in the posed frame), plus the braid wave on the inflow. */
  function bakeRow(inflowPts, strokePts, out, rowOffset) {
    var pts = inflowPts.concat(strokePts);
    var arc = [0];
    for (var i = 1; i < pts.length; i++) {
      var dx = pts[i].x - pts[i - 1].x, dy = pts[i].y - pts[i - 1].y,
          dz = pts[i].z - pts[i - 1].z;
      arc.push(arc[i - 1] + Math.sqrt(dx * dx + dy * dy + dz * dz));
    }
    var total = arc[arc.length - 1];
    /* Index inflowPts.length — the FIRST stroke point (see mark.js). */
    var strokeU = 1 - arc[inflowPts.length] / total;

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
      var taper = Math.min(1, Math.max(0, 1 - k / (SAMPLES - 1)) / 0.3);
      var wave = Math.sin((k / SAMPLES) * Math.PI * 2 + rowOffset) * 0.35;
      out[o + 3] = pts[lo].z + (pts[hi].z - pts[lo].z) * f + wave * taper;
    }
    return strokeU;
  }

  /* ---- TopoJSON decode, ported from the v3 build script ------------- */
  function decodeGeo(topo) {
    var sx = topo.transform.scale[0], sy = topo.transform.scale[1];
    var tx = topo.transform.translate[0], ty = topo.transform.translate[1];
    var arcs = topo.arcs.map(function (arc) {
      var x = 0, y = 0;
      return arc.map(function (d) {
        x += d[0]; y += d[1];
        return [x * sx + tx, y * sy + ty]; /* [lon, lat] */
      });
    });
    var geoms = topo.objects.countries.geometries;
    var ringsOf = function (g) {
      if (g.type === 'Polygon') return g.arcs;
      if (g.type === 'MultiPolygon') {
        var out = [];
        g.arcs.forEach(function (poly) { poly.forEach(function (r) { out.push(r); }); });
        return out;
      }
      return [];
    };
    var use = {}, ethIdx = {};
    geoms.forEach(function (g) {
      var isEth = g.properties && g.properties.name === 'Ethiopia';
      ringsOf(g).forEach(function (ring) {
        ring.forEach(function (a) {
          var idx = a >= 0 ? a : ~a;
          use[idx] = (use[idx] || 0) + 1;
          if (isEth) ethIdx[idx] = 1;
        });
      });
    });
    var coast = [], border = [], eth = [];
    Object.keys(use).forEach(function (k) {
      var i = +k;
      if (ethIdx[i]) eth.push(arcs[i]);
      else if (use[k] === 1) coast.push(arcs[i]);
      else border.push(arcs[i]);
    });
    /* Ethiopia rings (closed), for the interior dot fill. */
    var ethRings = [];
    geoms.forEach(function (g) {
      if (!(g.properties && g.properties.name === 'Ethiopia')) return;
      ringsOf(g).forEach(function (ring) {
        var pts = [];
        ring.forEach(function (a) {
          var arc = a >= 0 ? arcs[a] : arcs[~a].slice().reverse();
          var from = pts.length ? 1 : 0;
          for (var i = from; i < arc.length; i++) pts.push(arc[i]);
        });
        ethRings.push(pts);
      });
    });
    return { coast: coast, border: border, eth: eth, ethRings: ethRings };
  }

  function inRings(rings, lon, lat) {
    var inside = false;
    for (var r = 0; r < rings.length; r++) {
      var ring = rings[r], j = ring.length - 1;
      for (var i = 0; i < ring.length; i++) {
        var xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
        if ((yi > lat) !== (yj > lat) &&
            lon < (xj - xi) * (lat - yi) / (yj - yi + 1e-12) + xi) {
          inside = !inside;
        }
        j = i;
      }
    }
    return inside;
  }

  /* Line material with horizon fade — verbatim from the v3 globe, plus a
     uGate uniform so the geography arrives with the write. */
  function lineMat(THREE, hex, opacity) {
    return new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: {
        uColor: { value: new THREE.Color(hex) },
        uOpacity: { value: opacity },
        uGate: { value: 0 }
      },
      vertexShader: [
        'varying float vFade;',
        'void main(){',
        '  vec4 wp = modelMatrix * vec4(position, 1.0);',
        '  vec3 n = normalize(wp.xyz);',
        '  vec3 v = normalize(cameraPosition - wp.xyz);',
        '  vFade = smoothstep(-0.08, 0.35, dot(n, v));',
        '  gl_Position = projectionMatrix * viewMatrix * wp;',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform vec3 uColor; uniform float uOpacity; uniform float uGate; varying float vFade;',
        'void main(){ gl_FragColor = vec4(uColor, uOpacity * uGate * vFade); }'
      ].join('\n')
    });
  }
  function segmentsGeometry(THREE, polylines, r) {
    var pos = [];
    polylines.forEach(function (pts) {
      for (var i = 1; i < pts.length; i++) {
        var a = ll2v(pts[i - 1][1], pts[i - 1][0], r);
        var b = ll2v(pts[i][1], pts[i][0], r);
        pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
    });
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    return g;
  }

  class ZareGlobeWrite extends HTMLElement {
    static get observedAttributes() { return ['speed']; }

    constructor() {
      super();
      this._speed = 1;
      this._last = 0;
      this._raf = 0;
      this._inView = false;
      this._booted = false;
      this._elapsed = 0;
      this._drift = 0;
      this._rot = 0;           /* extra yaw on top of HOME_ROT: spin + drag */
      this._gate = 0;
      this._dragging = false;
      this._resumeAt = 0;
      this._scrollDriven = false;
      this._formP = 0;
      this._revP = 0;
      this._hoP = 0;
    }

    /** Public. p is 0..1 across the hero's formation range. */
    setFormProgress(p) {
      this._formP = p < 0 ? 0 : p > 1 ? 1 : p;
    }

    /** Public. r is 0..1 across the reveal window: the real globe fades in
     *  while the particle sphere lifts off into the orbiting halo. */
    setReveal(r) {
      this._revP = r < 0 ? 0 : r > 1 ? 1 : r;
    }

    /** Public. h is 0..1 across the hand-off window at the hero's end:
     *  the halo field streams DOWN out of the frame toward the section
     *  below, leaving the clean Earth. Reversible. */
    setHandoff(h) {
      this._hoP = h < 0 ? 0 : h > 1 ? 1 : h;
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

    /* Mask AND geography have to arrive before any geometry exists. Either
       failing takes the WebGL-failure path; the copy carries the story. */
    _boot() {
      if (this._booted) return;
      var self = this;
      if (!window.THREE) { setTimeout(function () { self._boot(); }, 80); return; }
      this._booted = true;

      var img = new Image();
      img.decoding = 'async';
      var geo = null, mask = null, done = false;
      var maybe = function () {
        if (done || !geo || !mask) return;
        done = true;
        try { self._setup(mask, geo); } catch (e) { self._fallback(); }
      };
      img.onload = function () { mask = img; maybe(); };
      img.onerror = function () { if (!done) { done = true; self._fallback(); } };
      img.src = MASK_SRC;
      fetch(GEO_SRC).then(function (r) {
        if (!r.ok) throw new Error('geo');
        return r.json();
      }).then(function (j) {
        geo = decodeGeo(j);
        maybe();
      }).catch(function () {
        if (!done) { done = true; self._fallback(); }
      });
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

    _setup(maskImg, geo) {
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
      var vw = this.clientWidth || 1600, vh = this.clientHeight || 900;
      /* Boot-time fit, like the anchor (the bake depends on the world
         scale): the sphere must fit the view's NARROWER axis with
         breathing room, or a portrait phone crops half the Earth. The
         `scale` attribute is the ceiling, never exceeded. */
      var hvH0 = Math.tan(camera.fov * Math.PI / 360) * camera.position.z;
      var fitSc = Math.min(hvH0 * (vw / vh), hvH0) * 0.92 / GR;
      var attrSc = parseFloat(this.getAttribute('scale') || '1') || 1;
      group.scale.setScalar(Math.min(attrSc, fitSc));
      scene.add(group);
      this._group = group;
      this._worldR = GR * group.scale.x;

      /* Anchor before the bake: inflow control points live in group-local
         coordinates, which depend on where the group sits. */
      this._applyAnchor(vw, vh);
      var sc = group.scale.x, gx = group.position.x, gy = group.position.y;
      var halfViewH = Math.tan(camera.fov * Math.PI / 360) * camera.position.z;
      var halfView = halfViewH * (vw / vh);
      var lxMin = -halfView - 0.3, lxMax = halfView + 0.3, lyMax = halfViewH + 0.2;

      /* Base pose matrix — built from the SAME Euler the pose applies, so
         bake and render agree exactly. */
      var base = new THREE.Matrix4().makeRotationFromEuler(
        new THREE.Euler(TILT_X, HOME_ROT, 0, 'XYZ'));
      var baseInv = base.clone().invert();
      var toLocal = function (p) {
        return new THREE.Vector3((p.x - gx) / sc, (p.y - gy) / sc, 0)
          .applyMatrix4(baseInv);
      };
      var toView = function (v) {
        var w = new THREE.Vector3(v.x, v.y, v.z).applyMatrix4(base);
        return { x: w.x * sc + gx, y: w.y * sc + gy };
      };

      /* View-plane depth in local coordinates, for the shader's banding:
         the plane maps to z = a·x + b·y + c in the posed frame. */
      var p00 = toLocal({ x: 0, y: 0 }), p10 = toLocal({ x: 1, y: 0 }),
          p01 = toLocal({ x: 0, y: 1 });
      var d1 = { x: p10.x - p00.x, y: p10.y - p00.y, z: p10.z - p00.z };
      var d2 = { x: p01.x - p00.x, y: p01.y - p00.y, z: p01.z - p00.z };
      var det = d1.x * d2.y - d1.y * d2.x || 1;
      var plA = (d1.z * d2.y - d2.z * d1.y) / det;
      var plB = (d2.z * d1.x - d1.z * d2.x) / det;
      var plC = p00.z - plA * p00.x - plB * p00.y;

      /* The centreline: the equator, once around from LON0 (opposite
         Addis). Closed loop — the write meets its own tail. */
      var eqAt = function (t) { return ll2v(0, LON0 + t * 360, GR); };
      var strokeLocal = [];
      for (var rp = 0; rp <= RING_PTS; rp++) strokeLocal.push(eqAt(rp / RING_PTS));
      var s0 = strokeLocal[0];
      var s0v = toView(s0);

      /* ---- Bake the trajectory texture -------------------------------- */
      var ROWS = coarse ? 4 : 7;
      var traj = new Float32Array(SAMPLES * ROWS * 4);
      var maxStrokeU = 0;
      var seed = rng(1337);
      for (var r = 0; r < ROWS; r++) {
        var lane = ROWS > 1 ? (r / (ROWS - 1) - 0.5) * 1.5 : 0;
        var j1 = (seed() - 0.5), j2 = (seed() - 0.5), j3 = (seed() - 0.5);
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

      var flowStart = Math.max(0.3, maxStrokeU + 0.03);
      var flowRange = 1 - flowStart;
      this._flowRange = flowRange;

      var pathAt = function (row, u) {
        var k = Math.round((1 - u) * (SAMPLES - 1));
        var o = (row * SAMPLES + Math.max(0, Math.min(SAMPLES - 1, k))) * 4;
        return { x: traj[o], y: traj[o + 1] };
      };

      /* ---- Land dots, from the mask (the v3 build script, in JS) ------ */
      var mc = document.createElement('canvas');
      mc.width = maskImg.naturalWidth;
      mc.height = maskImg.naturalHeight;
      var mx = mc.getContext('2d', { willReadFrequently: true });
      mx.drawImage(maskImg, 0, 0);
      var mdat = mx.getImageData(0, 0, mc.width, mc.height).data;
      var MW = mc.width, MH = mc.height;
      var isLand = function (lat, lon) {
        var x = (((lon + 180) % 360) / 360 * (MW - 1)) | 0;
        var y = ((90 - lat) / 180 * (MH - 1)) | 0;
        return mdat[(y * MW + x) * 4] < 128;
      };
      var N = coarse ? 12000 : 46000;
      var FIB = coarse ? 45000 : 165000; /* ~29% land → about N land dots */
      var ga = Math.PI * (3 - Math.sqrt(5));
      var land = [];
      for (var fi = 0; fi < FIB; fi++) {
        var yy = 1 - (fi / (FIB - 1)) * 2;
        var lat = Math.asin(yy) * 180 / Math.PI;
        var lon = ((ga * fi) % (Math.PI * 2)) * 180 / Math.PI;
        if (lon > 180) lon -= 360;
        if (isLand(lat, lon)) land.push([lat, lon]);
      }
      /* Ethiopia interior fill — denser, brighter (seeded like the build). */
      var erng = rng(42);
      var ethDots = [], tries = 0;
      while (ethDots.length < 220 && tries < 80000) {
        tries++;
        var elon = 32.9 + erng() * (48.2 - 32.9);
        var elat = 3.3 + erng() * (15.0 - 3.3);
        if (inRings(geo.ethRings, elon, elat)) ethDots.push([elat, elon]);
      }

      /* ---- Particles (the mark's field, targeting the sphere) --------- */
      var DUST_SHARE = 0.42;
      var aLat = new Float32Array(N * 3), aNorm = new Float32Array(N * 3),
          aNoise = new Float32Array(N * 3), aU = new Float32Array(N),
          aRow = new Float32Array(N), aSize = new Float32Array(N),
          aBig = new Float32Array(N), aShade = new Float32Array(N),
          aDetach = new Float32Array(N), aPhase = new Float32Array(N),
          aEth = new Float32Array(N);

      for (var i = 0; i < N; i++) {
        /* Uniform point on the sphere — the chrysalis is a PLAIN particle
           sphere, no continents. The map arrives only with the revealed
           globe's own land-dot layers underneath. */
        var d = [
          Math.asin(Math.random() * 2 - 1) * 180 / Math.PI,
          Math.random() * 360 - 180
        ];
        aEth[i] = 0;

        /* Sub-dot jitter, then back onto the sphere — several particles can
           share a dot without landing on the same pixel. */
        var v = ll2v(d[0], d[1], GR);
        var jx = v.x + (Math.random() - 0.5) * 0.012;
        var jy = v.y + (Math.random() - 0.5) * 0.012;
        var jz = v.z + (Math.random() - 0.5) * 0.012;
        var jl = Math.sqrt(jx * jx + jy * jy + jz * jz) || 1;
        jx = jx / jl * GR; jy = jy / jl * GR; jz = jz / jl * GR;

        /* Radial normal — breathing and detach push outward. */
        aNorm[i * 3] = jx / GR; aNorm[i * 3 + 1] = jy / GR; aNorm[i * 3 + 2] = jz / GR;

        /* Write order: the fraction of the sweep between LON0 and this
           dot's longitude — the scanner writes meridian by meridian. */
        var t = (((d[1] - LON0) / 360) % 1 + 1) % 1;
        var tJit = Math.max(0.002, Math.min(1, t + (Math.random() - 0.5) * 0.05));
        var u = flowStart + flowRange * (1 - tJit);
        aU[i] = u;
        var row = (Math.random() * ROWS) | 0;
        aRow[i] = row;

        /* Lateral offset: from the equatorial point this particle's u maps
           the shader to, out to its own land dot — measured against the
           exact point the shader samples, so pathPoint + lateral is the
           dot, exactly, at arrival. */
        var lineP = eqAt(tJit);
        aLat[i * 3] = jx - lineP.x;
        aLat[i * 3 + 1] = jy - lineP.y;
        aLat[i * 3 + 2] = jz - lineP.z;

        var rp2 = pathAt(row, u);
        if (Math.random() < DUST_SHARE) {
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

        aSize[i] = 0.5 + Math.random() * Math.random() * 1.25;
        var big = Math.random();
        aBig[i] = big < 0.02 ? 2.8 : big < 0.10 ? 1.9 : 1.0;

        aShade[i] = Math.random();
        aDetach[i] = Math.random() < 0.03 ? 0.5 + Math.random() : 0.0;
        aPhase[i] = Math.random() * Math.PI * 2;
      }

      var pg = new THREE.BufferGeometry();
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
      pg.setAttribute('aEth', new THREE.BufferAttribute(aEth, 1));

      var pmat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uForm: { value: 0 },
          uDrift: { value: 0 },
          uTraj: { value: trajTex },
          uRows: { value: ROWS },
          uSamples: { value: SAMPLES },
          uFlowStart: { value: flowStart },
          uPlane: { value: new THREE.Vector3(plA, plB, plC) },
          uReveal: { value: 0 },
          uHandoff: { value: 0 },
          uWorldR: { value: this._worldR },
          uPR: { value: Math.min(window.devicePixelRatio || 1, 2) }
        },
        vertexShader: [
          'attribute vec3 aNorm; attribute vec3 aNoise;',
          'attribute float aU; attribute float aRow; attribute float aSize; attribute float aBig;',
          'attribute float aShade; attribute float aDetach; attribute float aPhase; attribute float aEth;',
          'uniform float uTime; uniform float uForm; uniform float uDrift;',
          'uniform sampler2D uTraj; uniform float uRows; uniform float uSamples;',
          'uniform float uFlowStart; uniform vec3 uPlane; uniform float uReveal; uniform float uHandoff; uniform float uWorldR; uniform float uPR;',
          'varying float vShade; varying float vFade; varying float vForm; varying float vRest; varying float vEth; varying float vHalo; varying float vHop;',
          'float wmod(float v, float r){ return mod(mod(v, r) + r, r); }',
          'vec4 traj(float row, float u){',
          '  float sp = (1.0 - clamp(u, 0.0, 1.0)) * (uSamples - 1.0);',
          '  float lo = floor(sp); float f = sp - lo;',
          '  float hi = min(lo + 1.0, uSamples - 1.0);',
          '  float rv = (row + 0.5) / uRows;',
          '  return mix(texture2D(uTraj, vec2((lo + 0.5) / uSamples, rv)),',
          '             texture2D(uTraj, vec2((hi + 0.5) / uSamples, rv)), f);',
          '}',
          'void main(){',
          '  float ev = 0.82 + 0.15 * fract(aRow * 0.618034 * 7.0);',
          '  float tsp = clamp(uForm / ev, 0.0, 1.0);',
          '  float strokeU = traj(aRow, 0.0).b;',
          '  float flowRange = 1.0 - uFlowStart;',
          /* THE CORE MOVE (see mark.js): the window compresses from
             [flowStart, 1] to [0, strokeU]; the stream head crosses the
             equator first and the sweep writes the sphere meridian by
             meridian. Unlike the flat glyph, the path's z is kept whole —
             the equator is a full 3D circle in the posed frame — and the
             lateral offset carries each dot's remaining depth. */
          '  float flowing = wmod(aU - uFlowStart + uDrift, flowRange);',
          '  float squeeze = 1.0 + (strokeU / flowRange - 1.0) * tsp;',
          '  float cu = (uFlowStart * (1.0 - tsp) + flowing) * squeeze;',
          '  vec4 s4 = traj(aRow, cu);',
          '  float nU = (1.0 - tsp) * smoothstep(strokeU, strokeU + 0.22, cu);',
          '  float lat = tsp * tsp;',
          '  vec3 pos = vec3(s4.xy, s4.a)',
          '           + position * lat',
          '           + aNoise * nU * vec3(2.0, 1.5, 1.0);',
          '  float rest = 1.0 - tsp;',
          '  pos += vec3(sin(uTime * 0.05 + aPhase) + 0.6 * sin(uTime * 0.13 + aPhase * 2.1),',
          '              cos(uTime * 0.06 + aPhase * 1.7) + 0.6 * cos(uTime * 0.11 + aPhase * 3.3),',
          '              sin(uTime * 0.04 + aPhase * 2.3)) * 0.035 * rest;',
          '  float formed = smoothstep(0.96, 1.0, tsp);',
          '  pos += aNorm * sin(uTime * 0.5 + aPhase) * 0.006 * formed;',
          '  float dr = max(0.0, sin(uTime * 0.12 + aPhase));',
          '  pos += aNorm * dr * dr * aDetach * 0.10 * formed;',
          /* THE REVEAL: the written shell releases into an orbiting halo —
             the atmosphere is particles. Each particle rides out along its
             own radial to a personal shell radius and circles the sphere
             at its own speed and direction (half with the spin, half
             against), so the glow is a current, not a printed ring. Gated
             by tsp so nothing lifts that has not first arrived. */
          '  float rv = uReveal * tsp;',
          '  if (rv > 0.001) {',
          '    float hr = 1.12 + fract(aShade * 7.13) * 0.5;',
          '    float ds = step(0.5, fract(aPhase * 0.31831)) * 2.0 - 1.0;',
          '    float oa = uTime * (0.015 + 0.05 * fract(aPhase * 1.618)) * ds;',
          '    vec3 hd = vec3(aNorm.x * cos(oa) + aNorm.z * sin(oa), aNorm.y,',
          '                   -aNorm.x * sin(oa) + aNorm.z * cos(oa));',
          '    vec3 halo = hd * hr + aNoise * 0.04;',
          '    pos = mix(pos, halo, smoothstep(0.0, 1.0, rv));',
          '  }',
          /* THE HAND-OFF: at the hero's end the halo pours DOWN toward the
             section below — per-particle staggered so the field unfurls
             rather than sinking as one body, with a little lateral spread.
             A pure function of scroll; reversing re-forms the halo. */
          '  float hop = smoothstep(0.0, 1.0, clamp(uHandoff * 1.35 - fract(aShade * 3.7) * 0.35, 0.0, 1.0))',
          '            * smoothstep(0.0, 1.0, rv);',
          '  pos.y -= hop * hop * 7.5;',
          '  pos.x += (fract(aPhase * 0.618) - 0.5) * hop * 1.8;',
          '  vHalo = rv;',
          '  vec4 mv = modelViewMatrix * vec4(pos, 1.0);',
          '  gl_Position = projectionMatrix * mv;',
          /* Keep the revealed globe CLEAN: halo particles crossing in
             front of the disc are veiled out; the shell shows around the
             limb, where an atmosphere belongs. */
          '  vec4 mvC = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);',
          '  vec3 offv = mv.xyz - mvC.xyz;',
          '  float veil = smoothstep(uWorldR * 0.98, uWorldR * 0.62, length(offv.xy))',
          '             * step(0.0, offv.z) * vHalo * (1.0 - hop);',
          /* Banding keys on the braid wave: s4.a minus the view plane's
             own depth at this texel (uPlane), not on screen height. */
          '  float dz = (s4.a - (uPlane.x * s4.x + uPlane.y * s4.y + uPlane.z)) * rest',
          '           + aNoise.z * nU;',
          '  float band = min(' + (DEPTH_BANDS - 1) + '.0, floor(clamp(dz * 0.9 + 0.5, 0.0, 1.0) * ' + DEPTH_BANDS + '.0));',
          '  float dt = band / ' + (DEPTH_BANDS - 1) + '.0;',
          '  gl_PointSize = aSize * uPR * (22.0 / -mv.z) * (0.5 + 0.5 * tsp)',
          '    * mix(mix(0.6, 1.4, dt) * aBig, 1.0, tsp) * (1.0 + aEth * 0.25 * tsp)',
          '    * (1.0 - vHalo * 0.35 + hop * 0.55);',
          '  vShade = aShade;',
          '  float edge = smoothstep(0.0, 0.05, flowing)',
          '             * (1.0 - smoothstep(flowRange - 0.05, flowRange, flowing));',
          '  float tw = 0.85 + 0.15 * sin(uTime * 0.55 + aPhase * 4.0);',
          '  vFade = mix(0.72 * tw * mix(0.55, 1.0, dt) * edge, 1.0, tsp);',
          '  vFade *= 1.0 - veil * 0.9;',
          '  vFade *= 1.0 - smoothstep(0.82, 1.0, hop) * 0.7;',
          '  vHop = hop;',
          '  vForm = smoothstep(0.45, 0.95, tsp);',
          '  vRest = rest;',
          '  vEth = aEth;',
          '}'
        ].join('\n'),
        fragmentShader: [
          'varying float vShade; varying float vFade; varying float vForm; varying float vRest; varying float vEth; varying float vHalo; varying float vHop;',
          'void main(){',
          '  float d = length(gl_PointCoord - 0.5);',
          '  float a = smoothstep(0.5, mix(0.10, 0.34, vRest), d) * vFade;',
          /* The v3 globe's land palette: pale teal dots, Ethiopia brighter.
             Flat like the reference — the globe reads by geography, not by
             a lit surface. The rest field stays the mark's pale white; the
             halo takes the atmosphere teal and sits quieter than the
             sphere it surrounds. */
          '  vec3 landA = vec3(0.659, 0.867, 0.882);',
          '  vec3 landB = vec3(0.847, 0.984, 0.988);',
          '  vec3 ethC  = vec3(0.561, 0.941, 0.957);',
          '  vec3 land = mix(landA, landB, vShade * 0.35);',
          '  land = mix(land, ethC, vEth);',
          '  vec3 pale = vec3(0.86, 0.94, 0.97);',
          '  vec3 col = mix(pale, land, vForm);',
          '  col = mix(col, vec3(0.35, 0.80, 0.83), vHalo * 0.8);',
          '  col = mix(col, vec3(0.10, 0.81, 0.82), vHop);',
          '  float alpha = a * (0.30 + 0.26 * vRest) * (1.0 + vEth * 0.8);',
          '  gl_FragColor = vec4(col, alpha * (1.0 - vHalo * 0.45 * (1.0 - vHop)) * (1.0 + vHop * 0.6));',
          '}'
        ].join('\n')
      });

      group.add(new THREE.Points(pg, pmat));
      this._pmat = pmat;

      /* ---- The REAL globe, revealed from inside the particle sphere ---- */
      /* Opaque navy core: occludes the far side once the globe exists.
         Rendered first so the depth buffer is in place for everything else. */
      var core = new THREE.Mesh(
        new THREE.SphereGeometry(GR * 0.992, 64, 40),
        new THREE.MeshBasicMaterial({ color: 0x03111b, transparent: true, opacity: 0 })
      );
      core.renderOrder = -1;
      core.visible = false;
      group.add(core);
      this._core = core;
      /* No rim sprite: the atmosphere glow is the particle halo itself. */

      var dtex = dotTexture(THREE);

      /* The v3 land masses — its own fine dots, so the revealed globe is
         clean and the field's big particles stay OFF it. PointsMaterial
         size is world units and does not scale with the group, hence the
         explicit worldR factor. */
      var landGeom = (function () {
        var pos = [], stride = coarse ? 2 : 1;
        for (var li = 0; li < land.length; li += stride) {
          var lv = ll2v(land[li][0], land[li][1], GR);
          pos.push(lv.x, lv.y, lv.z);
        }
        var g2 = new THREE.BufferGeometry();
        g2.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        return g2;
      })();
      var landMat = new THREE.PointsMaterial({
        map: dtex, color: 0xa8dde1,
        size: (coarse ? 0.017 : 0.0125) * this._worldR,
        transparent: true, opacity: 0, depthWrite: false,
        blending: THREE.AdditiveBlending, sizeAttenuation: true
      });
      group.add(new THREE.Points(landGeom, landMat));
      this._landMat = landMat;

      var ethGeom = (function () {
        var pos = [];
        for (var ei = 0; ei < ethDots.length; ei++) {
          var evv = ll2v(ethDots[ei][0], ethDots[ei][1], GR * 1.001);
          pos.push(evv.x, evv.y, evv.z);
        }
        var g3 = new THREE.BufferGeometry();
        g3.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        return g3;
      })();
      var ethMat = new THREE.PointsMaterial({
        map: dtex, color: 0x8ff0f4,
        size: (coarse ? 0.019 : 0.014) * this._worldR,
        transparent: true, opacity: 0, depthWrite: false,
        blending: THREE.AdditiveBlending, sizeAttenuation: true
      });
      group.add(new THREE.Points(ethGeom, ethMat));
      this._ethMat = ethMat;

      /* coastlines (brighter) > country borders (faint) > Ethiopia (brightest) */
      this._lineMats = [];
      var addLines = function (polys, r, hex, op) {
        var m = lineMat(THREE, hex, op);
        group.add(new THREE.LineSegments(segmentsGeometry(THREE, polys, r), m));
        self._lineMats.push(m);
      };
      addLines(geo.coast, GR * 1.002, 0x7adfe3, 0.5);
      addLines(geo.border, GR * 1.0015, 0x40c1c7, 0.16);
      addLines(geo.eth, GR * 1.003, 0x10cfd1, 0.95);

      /* delivery arcs from Addis Ababa + moving flight lights */
      var home = ll2v(MARKERS[0].ll[0], MARKERS[0].ll[1], GR * 1.005);
      var homeV = new THREE.Vector3(home.x, home.y, home.z);
      this._curves = []; this._flights = [];
      MARKERS.forEach(function (m, i) {
        if (m.home) return;
        var pl = ll2v(m.ll[0], m.ll[1], GR * 1.005);
        var pnt = new THREE.Vector3(pl.x, pl.y, pl.z);
        var mid = homeV.clone().add(pnt).normalize()
          .multiplyScalar(GR + homeV.distanceTo(pnt) * 0.28);
        var curve = new THREE.QuadraticBezierCurve3(homeV, mid, pnt);
        var pts = curve.getPoints(72), seg = [];
        for (var s2 = 0; s2 < pts.length - 1; s2++) {
          seg.push(pts[s2].x, pts[s2].y, pts[s2].z,
                   pts[s2 + 1].x, pts[s2 + 1].y, pts[s2 + 1].z);
        }
        var ag = new THREE.BufferGeometry();
        ag.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3));
        var am = lineMat(THREE, 0x40c1c7, 0.38);
        group.add(new THREE.LineSegments(ag, am));
        self._lineMats.push(am);
        var fl = new THREE.Sprite(new THREE.SpriteMaterial({
          map: dtex, color: 0xd8fbfc, transparent: true, opacity: 0,
          depthWrite: false, blending: THREE.AdditiveBlending
        }));
        fl.scale.setScalar(GR * 0.035);
        group.add(fl);
        self._curves.push(curve);
        self._flights.push({ s: fl, off: i / MARKERS.length });
      });

      /* pulsing served-country markers */
      this._pulse = [];
      MARKERS.forEach(function (m, i) {
        var pl = ll2v(m.ll[0], m.ll[1], GR * 1.006);
        var base = (m.home ? 0.085 : 0.05) * GR;
        var dot = new THREE.Sprite(new THREE.SpriteMaterial({
          map: dtex, color: m.home ? 0x10cfd1 : 0x40c1c7, transparent: true,
          opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending
        }));
        dot.scale.setScalar(base);
        dot.position.set(pl.x, pl.y, pl.z);
        group.add(dot);
        var halo = new THREE.Sprite(new THREE.SpriteMaterial({
          map: dtex, color: m.home ? 0x10cfd1 : 0x40c1c7, transparent: true,
          opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending
        }));
        halo.scale.setScalar(base * 1.9);
        halo.position.copy(dot.position);
        group.add(halo);
        self._pulse.push({ dot: dot, halo: halo, base: base, phase: i * 0.9 });
      });
      var hl = ll2v(MARKERS[0].ll[0], MARKERS[0].ll[1], GR * 1.02);
      this._homeLocal = new THREE.Vector3(hl.x, hl.y, hl.z);

      this._ro = new ResizeObserver(function () { self._resize(); });
      this._ro.observe(this);
      this._resize();

      /* ---- Interactivity: drag + Addis label, on the hero <section> ----
         The element itself is pointer-events-none inside a none wrapper
         (see mark.js) — the section is the ancestor that actually receives
         events. Both are gated on the formed globe, and pointerdowns that
         start on a link or button are left alone, so the descriptive
         block's CTAs stay clickable. */
      var evHost = this.closest('section') || document.body;
      this._evHost = evHost;
      if (!coarse && !reduced) {
        var label = document.createElement('div');
        label.className = 'globe-label';
        label.textContent = 'ADDIS ABABA · ETHIOPIA';
        this.appendChild(label);
        this._label = label;

        evHost.addEventListener('pointerdown', function (e) {
          if (self._gate < 0.5) return;
          if (e.target && e.target.closest && e.target.closest('a,button')) return;
          if (e.pointerType === 'touch') return;
          self._dragging = true;
          self._dragX = e.clientX;
          evHost.classList.add('globe-dragging');
          try { evHost.setPointerCapture(e.pointerId); } catch (err) {}
        });
        evHost.addEventListener('pointermove', function (e) {
          if (self._dragging) {
            self._rot += (e.clientX - self._dragX) * 0.005;
            self._dragX = e.clientX;
            if (self._label) self._label.classList.remove('on');
            return;
          }
          if (self._gate < 0.5 || !self._label) return;
          var pt = self._homeScreen();
          if (!pt) { self._label.classList.remove('on'); return; }
          var rect = self.getBoundingClientRect();
          var dx = e.clientX - rect.left - pt.x, dy = e.clientY - rect.top - pt.y;
          if (dx * dx + dy * dy < 30 * 30) {
            self._label.style.left = pt.x + 'px';
            self._label.style.top = pt.y + 'px';
            self._label.classList.add('on');
          } else self._label.classList.remove('on');
        });
        var end = function () {
          if (!self._dragging) return;
          self._dragging = false;
          self._resumeAt = performance.now() + 1500;
          evHost.classList.remove('globe-dragging');
        };
        evHost.addEventListener('pointerup', end);
        evHost.addEventListener('pointercancel', end);
        evHost.addEventListener('pointerleave', function () {
          if (self._label) self._label.classList.remove('on');
        });
      }

      if (reduced) {
        /* Static frame: globe revealed, halo parked, Ethiopia forward. */
        this._pmat.uniforms.uTime.value = 200;
        this._pmat.uniforms.uForm.value = 1;
        this._pmat.uniforms.uDrift.value = 0;
        this._pmat.uniforms.uReveal.value = 1;
        this._gate = 1;
        this._applyGate(1);
        this._flights.forEach(function (f, i) {
          f.s.position.copy(self._curves[i].getPoint(0.35 + i * 0.08));
          f.s.material.opacity = 0.7;
        });
        this._pulse.forEach(function (pl2) {
          pl2.dot.material.opacity = 0.8;
          pl2.halo.material.opacity = 0.2;
        });
        this._pose();
        this._renderOnce();
        return;
      }
      this._syncRunning();
    }

    /* Seats the globe left of centre; the descriptive block owns the
       right. Clamped so narrow viewports keep the sphere on screen —
       Math.min(0, ...) stops the clamp itself pushing it right of centre. */
    _applyAnchor(w, h) {
      var halfView = Math.tan(this._camera.fov * Math.PI / 360) *
        this._camera.position.z * (w / h);
      var want = ANCHOR * halfView;
      var minX = -(halfView - this._worldR - 0.25);
      this._group.position.x = Math.min(0, Math.max(want, minX));
      this._group.position.y = 0;
    }

    _resize() {
      if (!this._renderer) return;
      var w = this.clientWidth || 1, h = this.clientHeight || 1;
      this._renderer.setSize(w, h, false);
      this._camera.aspect = w / h;
      this._camera.updateProjectionMatrix();
      if (this._static) this._renderOnce();
    }

    _homeScreen() {
      if (!this._group) return null;
      this._group.updateMatrixWorld();
      var wp = this._homeLocal.clone().applyMatrix4(this._group.matrixWorld);
      /* Addis on the far side → no label. Threshold scales with the globe. */
      if (wp.z < this._group.position.z + this._worldR * 0.25) return null;
      var ndc = wp.project(this._camera);
      return {
        x: (ndc.x * 0.5 + 0.5) * this.clientWidth,
        y: (-ndc.y * 0.5 + 0.5) * this.clientHeight
      };
    }

    /* Base pose plus the gated spin/drag. The base never moves — the bake
       depends on it; only _rot (gated) turns the sphere. */
    _pose() {
      this._group.rotation.set(TILT_X, HOME_ROT + this._rot * this._gate, 0);
    }

    /* Everything that is not field particles rides the REVEAL: the real
       globe fades in as the particle sphere lifts off around it. */
    _applyGate(g) {
      this._gate = g;
      this._core.visible = g > 0.02;
      this._core.material.opacity = g;
      this._landMat.opacity = 0.62 * g;
      this._ethMat.opacity = 0.95 * g;
      for (var i = 0; i < this._lineMats.length; i++) {
        this._lineMats[i].uniforms.uGate.value = g;
      }
    }

    _renderOnce() {
      if (this._renderer) this._renderer.render(this._scene, this._camera);
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
      var g = 0;

      if (this._pmat) {
        this._elapsed += dt;
        this._pmat.uniforms.uTime.value = this._elapsed;

        var form = this._scrollDriven
          ? this._formP
          : Math.min(1, this._elapsed / FORM_T);
        this._pmat.uniforms.uForm.value = form;

        /* The conveyor, damped by progress — zero at arrival, reversible. */
        var fr = this._flowRange || 0.7;
        if (form < 0.02) {
          this._drift = ((this._drift + dt * FLOW_SPEED) % fr + fr) % fr;
          if (this._drift > fr / 2) this._drift -= fr;
        }
        this._pmat.uniforms.uDrift.value =
          this._drift * Math.pow(1 - form, 1.5);

        /* The REVEAL window: scroll-driven through setReveal, or on the
           clock after the timed formation completes. Core, geography,
           markers, arcs, the halo lift-off and the spin all ride it — and
           reverse with it. */
        g = this._scrollDriven
          ? this._revP
          : Math.max(0, Math.min(1, (this._elapsed - FORM_T - 0.5) / 1.5));
        this._applyGate(g);
        this._pmat.uniforms.uReveal.value = g;
        this._pmat.uniforms.uHandoff.value = this._scrollDriven ? this._hoP : 0;

        if (!this._dragging && now > this._resumeAt) {
          this._rot += dt * 0.085 * sp * g; /* ~74s per revolution */
        }

        var t = now / 1000;
        for (var i = 0; i < this._pulse.length; i++) {
          var pl2 = this._pulse[i];
          var w = 0.5 + 0.5 * Math.sin(t * 2.4 + pl2.phase);
          pl2.dot.material.opacity = (0.45 + 0.55 * w) * g;
          pl2.halo.material.opacity = (0.08 + 0.3 * w) * g;
          pl2.halo.scale.setScalar(pl2.base * (1.5 + 0.9 * w));
        }

        this._pose();
        this._group.updateMatrixWorld();
        for (var j = 0; j < this._flights.length; j++) {
          var f = this._flights[j];
          var ft = (t * 0.11 + f.off) % 1;
          var pos = this._curves[j].getPoint(ft);
          f.s.position.copy(pos);
          var wz = pos.clone().applyMatrix4(this._group.matrixWorld).z
            - this._group.position.z;
          f.s.material.opacity = Math.max(0, Math.min(1,
            (wz / this._worldR + 0.1) * 2.4))
            * (0.35 + 0.65 * Math.sin(ft * Math.PI)) * g;
        }

        if (this._label && this._label.classList.contains('on')) {
          var pt = this._homeScreen();
          if (pt && g > 0.5) {
            this._label.style.left = pt.x + 'px';
            this._label.style.top = pt.y + 'px';
          } else this._label.classList.remove('on');
        }
      }

      this._renderer.render(this._scene, this._camera);
    }
  }

  customElements.define('zare-globe-write', ZareGlobeWrite);
})();

/* Marks this as an ES module so it can be side-effect imported from
   TypeScript, matching the other hero elements. */
export {};
