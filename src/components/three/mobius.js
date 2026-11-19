/* Zare Innovations — signature Möbius strip background animation.
   Variants: metal | glass | ribbon. Real-time Three.js, lazy-init,
   reduced-motion + no-WebGL fallbacks, tab-pause, pointer parallax. */
(function () {
  if (customElements.get('zare-mobius')) return;

  var TEAL = 0x40c1c7, NAVY = 0x0a293b, PURPLE = 0x6f5bd8;

  function mobiusPos(R, u, v, arr) {
    var c = Math.cos(u / 2), s = Math.sin(u / 2), r = R + v * c;
    arr[0] = r * Math.cos(u); arr[1] = r * Math.sin(u); arr[2] = v * s;
    return arr;
  }

  function buildStrip(THREE, R, w, uSeg, vSeg, u0, u1, colorFn) {
    var pos = [], uv = [], col = [], idx = [], i, j;
    for (i = 0; i <= uSeg; i++) {
      var u = u0 + (u1 - u0) * i / uSeg;
      for (j = 0; j <= vSeg; j++) {
        var v = -w + 2 * w * j / vSeg;
        var c = Math.cos(u / 2), s = Math.sin(u / 2), r = R + v * c;
        pos.push(r * Math.cos(u), r * Math.sin(u), v * s);
        uv.push(i / uSeg, j / vSeg);
        if (colorFn) { var cc = colorFn(u, v); col.push(cc.r, cc.g, cc.b); }
      }
    }
    for (i = 0; i < uSeg; i++) for (j = 0; j < vSeg; j++) {
      var a = i * (vSeg + 1) + j, b = a + vSeg + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    if (colorFn) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  function edgeCurve(THREE, R, w, n) {
    var pts = [], p = [0, 0, 0];
    for (var i = 0; i < n; i++) {
      var u = 4 * Math.PI * i / n;
      mobiusPos(R, u, w, p);
      pts.push(new THREE.Vector3(p[0], p[1], p[2]));
    }
    return new THREE.CatmullRomCurve3(pts, true);
  }

  function glowTexture(THREE, inner, outer) {
    var c = document.createElement('canvas'); c.width = c.height = 64;
    var x = c.getContext('2d');
    var g = x.createRadialGradient(32, 32, 2, 32, 32, 30);
    g.addColorStop(0, inner); g.addColorStop(0.35, outer); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    var t = new THREE.CanvasTexture(c); return t;
  }

  var FALLBACK_BG = {
    metal: 'radial-gradient(90% 120% at 68% 45%, rgba(64,193,199,.18), rgba(10,41,59,0) 55%), radial-gradient(70% 90% at 80% 70%, rgba(111,91,216,.12), rgba(0,0,0,0) 60%)',
    glass: 'radial-gradient(80% 110% at 66% 42%, rgba(64,193,199,.22), rgba(0,0,0,0) 58%)',
    ribbon: 'radial-gradient(85% 110% at 66% 45%, rgba(64,193,199,.20), rgba(0,0,0,0) 60%)'
  };

  class ZareMobius extends HTMLElement {
    static get observedAttributes() { return ['speed', 'markers']; }
    constructor() {
      super();
      this._speed = 1; this._markers = true;
      this._angle = 0; this._last = 0; this._raf = 0;
      this._inView = false; this._booted = false;
      this._px = 0; this._py = 0; this._tx = 0; this._ty = 0;
      this._markerT = 0;
      /* Formation source. Defaults to the wall clock, which is the behaviour
         that has always shipped. Only setScrollDriven(true) changes it, and
         only the React wrapper calls that, and only after Three has actually
         booted on a fine pointer without reduced motion. Everything else
         (mobile, reduced motion, no WebGL, no JS) keeps the original path. */
      this._scrollDriven = false;
      this._formP = 0;
    }

    /* Public. p is 0..1 across the hero's scroll range. */
    setFormProgress(p) {
      this._formP = p < 0 ? 0 : p > 1 ? 1 : p;
    }

    /* Public. Hands the formation clock over to the scrollbar. */
    setScrollDriven(on) {
      this._scrollDriven = !!on;
    }
    attributeChangedCallback(n, _o, v) {
      if (n === 'speed') { var f = parseFloat(v); this._speed = isFinite(f) ? f : 1; }
      if (n === 'markers') {
        this._markers = !(v === 'false' || v === null);
        if (this._markerGroup) this._markerGroup.visible = this._markers;
        if (this._static) this._renderOnce();
      }
    }
    connectedCallback() {
      var st = this.style;
      st.display = 'block';
      if (getComputedStyle(this).position === 'static') st.position = 'absolute';
      st.inset = '0';
      st.width = '100%'; st.height = '100%';
      st.pointerEvents = 'none';
      st.overflow = 'hidden';
      /* hidden founder signal — eight markers, one endless road */
      if (!this.dataset.route) this.dataset.route = '0x08-ring';
      if (!window.__zareLoop) {
        window.__zareLoop = 1;
        try { console.info('%c\u221E  zare \u00b7 the loop has no seam \u00b7 8 lights walk it until the bell rings', 'color:#40c1c7;font:12px monospace'); } catch (e) {}
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
      if (this._renderer) { this._renderer.dispose(); }
    }
    _boot() {
      if (this._booted) return;
      var self = this;
      if (!window.THREE) { setTimeout(function () { self._boot(); }, 80); return; }
      this._booted = true;
      try { this._setup(); } catch (e) { this._fallback(); }
    }
    _fallback() {
      var v = this.getAttribute('variant') || 'metal';
      var d = document.createElement('div');
      d.style.cssText = 'position:absolute;inset:0;background:' + (FALLBACK_BG[v] || FALLBACK_BG.metal);
      this.appendChild(d);
    }
    _setup() {
      var THREE = window.THREE, self = this;
      var variant = this.getAttribute('variant') || 'metal';
      var coarse = matchMedia('(pointer: coarse)').matches || window.innerWidth < 768;
      var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      this._static = reduced;
      this._coarse = coarse;

      var renderer;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: !coarse, alpha: true, powerPreference: 'low-power', preserveDrawingBuffer: true });
      } catch (e) { this._fallback(); return; }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.25 : 1.75));
      renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';
      this.appendChild(renderer.domElement);
      this._renderer = renderer;

      var scene = new THREE.Scene();
      var camera = new THREE.PerspectiveCamera(38, 1, 0.1, 60);
      camera.position.set(0, 0, 6.4);
      this._scene = scene; this._camera = camera;

      var R = 1.35, W = 0.5;
      var uSeg = coarse ? 130 : 240, vSeg = coarse ? 10 : 16;
      var group = new THREE.Group();
      var ox = this.dataset.ox != null ? this.dataset.ox : this.getAttribute('offset-x');
      var oy = this.dataset.oy != null ? this.dataset.oy : this.getAttribute('offset-y');
      group.position.x = ox != null && ox !== '' ? parseFloat(ox) : 1.05;
      group.position.y = oy != null && oy !== '' ? parseFloat(oy) : 0;
      if (isNaN(group.position.x)) group.position.x = 1.05;
      if (isNaN(group.position.y)) group.position.y = 0;
      var s0 = parseFloat(this.getAttribute('scale') || '1');
      group.scale.setScalar(s0);
      this._invert = this.getAttribute('invert') === 'true' ? -1 : 1;
      if (this._invert === -1) group.scale.z *= -1;
      scene.add(group);
      this._group = group;

      var edge = edgeCurve(THREE, R, W, coarse ? 220 : 420);
      this._edge = edge;

      if (variant === 'particles') {
        // halftone particle strip — GPU shader formation, breathing idle, detach/return
        var N = coarse ? 5000 : 14000;
        var aStart = new Float32Array(N * 3), aTarget = new Float32Array(N * 3),
            aNorm = new Float32Array(N * 3), aSize = new Float32Array(N),
            aDelay = new Float32Array(N), aShade = new Float32Array(N),
            aDetach = new Float32Array(N), aPhase = new Float32Array(N);
        var p = [0, 0, 0], q = [0, 0, 0];
        for (var pi = 0; pi < N; pi++) {
          var u = Math.random() * Math.PI * 2;
          // halftone density: bias v toward edges + wave bands along u
          var vv = (Math.random() * 2 - 1);
          if (Math.random() < 0.35) vv = Math.sign(vv || 1) * (0.75 + 0.25 * Math.random());
          var band = 0.5 + 0.5 * Math.sin(u * 6);
          if (Math.random() > 0.55 + 0.45 * band && Math.random() < 0.5) { pi--; continue; }
          var v = vv * W;
          mobiusPos(R, u, v, p);
          aTarget[pi * 3] = p[0]; aTarget[pi * 3 + 1] = p[1]; aTarget[pi * 3 + 2] = p[2];
          // surface normal approx via tangent cross
          mobiusPos(R, u + 0.01, v, q);
          var tx = q[0] - p[0], ty = q[1] - p[1], tz = q[2] - p[2];
          mobiusPos(R, u, v + 0.01, q);
          var bx = q[0] - p[0], by = q[1] - p[1], bz = q[2] - p[2];
          var nx = ty * bz - tz * by, ny = tz * bx - tx * bz, nz = tx * by - ty * bx;
          var nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
          aNorm[pi * 3] = nx / nl; aNorm[pi * 3 + 1] = ny / nl; aNorm[pi * 3 + 2] = nz / nl;
          // loose start cloud
          var rr = 2.2 + Math.random() * 2.6, th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
          aStart[pi * 3] = rr * Math.sin(ph) * Math.cos(th);
          aStart[pi * 3 + 1] = rr * Math.sin(ph) * Math.sin(th) * 0.7;
          aStart[pi * 3 + 2] = rr * Math.cos(ph) * 0.8;
          aSize[pi] = 0.55 + Math.random() * Math.random() * 1.35;
          // eight formation phases along the loop + jitter
          aDelay[pi] = Math.floor(u / (Math.PI * 2) * 8) * 0.45 + Math.random() * 1.6;
          aShade[pi] = Math.random();
          aDetach[pi] = Math.random() < 0.04 ? 0.5 + Math.random() : 0.0;
          aPhase[pi] = Math.random() * Math.PI * 2;
        }
        var pg = new THREE.BufferGeometry();
        pg.setAttribute('position', new THREE.BufferAttribute(aStart, 3));
        pg.setAttribute('aTarget', new THREE.BufferAttribute(aTarget, 3));
        pg.setAttribute('aNorm', new THREE.BufferAttribute(aNorm, 3));
        pg.setAttribute('aSize', new THREE.BufferAttribute(aSize, 1));
        pg.setAttribute('aDelay', new THREE.BufferAttribute(aDelay, 1));
        pg.setAttribute('aShade', new THREE.BufferAttribute(aShade, 1));
        pg.setAttribute('aDetach', new THREE.BufferAttribute(aDetach, 1));
        pg.setAttribute('aPhase', new THREE.BufferAttribute(aPhase, 1));
        var pmat = new THREE.ShaderMaterial({
          transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
          uniforms: {
            uTime: { value: 0 },
            // Formation clock, split from uTime so the two can be driven
            // independently. When the hero is scroll-driven, uForm follows the
            // scrollbar while uTime keeps running on the wall clock: without
            // the split, a visitor who stops scrolling would freeze the idle
            // breathing and drift below and see a dead object.
            uForm: { value: 0 },
            uPR: { value: Math.min(window.devicePixelRatio || 1, 2) }
          },
          vertexShader: [
            'attribute vec3 aTarget; attribute vec3 aNorm;',
            'attribute float aSize; attribute float aDelay; attribute float aShade; attribute float aDetach; attribute float aPhase;',
            'uniform float uTime; uniform float uForm; uniform float uPR;',
            'varying float vShade; varying float vFade;',
            'void main(){',
            // formation reads uForm; the two idle terms below stay on uTime
            '  float e = clamp((uForm - aDelay) / 3.2, 0.0, 1.0);',
            '  e = e * e * (3.0 - 2.0 * e);',
            '  vec3 pos = mix(position, aTarget, e);',
            '  pos += aNorm * sin(e * 3.14159) * 0.45;',
            '  float formed = step(0.999, e);',
            '  pos += aNorm * sin(uTime * 0.5 + aPhase) * 0.012 * formed;',
            '  float drift = max(0.0, sin(uTime * 0.12 + aPhase)) ;',
            '  pos += aNorm * drift * drift * aDetach * 0.4 * formed;',
            '  vec4 mv = modelViewMatrix * vec4(pos, 1.0);',
            '  gl_Position = projectionMatrix * mv;',
            '  gl_PointSize = aSize * uPR * (22.0 / -mv.z) * (0.35 + 0.65 * e);',
            '  vShade = aShade;',
            '  vFade = 0.25 + 0.75 * e;',
            '}'
          ].join('\n'),
          fragmentShader: [
            'varying float vShade; varying float vFade;',
            'void main(){',
            '  float d = length(gl_PointCoord - 0.5);',
            '  float a = smoothstep(0.5, 0.12, d) * vFade;',
            '  vec3 base = vec3(0.92, 0.96, 0.97);',
            '  vec3 ice  = vec3(1.0, 1.0, 1.0);',
            '  vec3 dim  = vec3(0.62, 0.70, 0.74);',
            '  vec3 col = mix(base, ice, smoothstep(0.55, 1.0, vShade));',
            '  col = mix(col, dim, smoothstep(0.0, 0.18, 0.18 - vShade) * 0.7);',
            '  gl_FragColor = vec4(col, a * 0.55);',
            '}'
          ].join('\n')
        });
        group.add(new THREE.Points(pg, pmat));
        this._pmat = pmat;
        this._formT = 0.45 * 7 + 1.6 + 3.2; // last delay + travel
        // light that circles the loop once after formation
        var tl = new THREE.Sprite(new THREE.SpriteMaterial({
          map: glowTexture(THREE, 'rgba(235,255,255,.95)', 'rgba(64,193,199,.55)'),
          transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending
        }));
        tl.scale.setScalar(0.42); group.add(tl); this._loopLight = tl;
      } else if (variant === 'metal') {
        var mat = new THREE.MeshStandardMaterial({
          color: 0x0d2b3e, metalness: 0.92, roughness: 0.28,
          side: THREE.DoubleSide
        });
        group.add(new THREE.Mesh(buildStrip(THREE, R, W, uSeg, vSeg, 0, Math.PI * 2), mat));
        var tube = new THREE.Mesh(
          new THREE.TubeGeometry(edge, coarse ? 200 : 380, 0.012, 6, true),
          new THREE.MeshBasicMaterial({ color: TEAL, transparent: true, opacity: 0.95 }));
        group.add(tube);
        var halo = new THREE.Mesh(
          new THREE.TubeGeometry(edge, coarse ? 140 : 260, 0.035, 6, true),
          new THREE.MeshBasicMaterial({ color: TEAL, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false }));
        group.add(halo);
        scene.add(new THREE.HemisphereLight(0x24506a, 0x02090f, 0.85));
        var l1 = new THREE.DirectionalLight(TEAL, 1.15); l1.position.set(3.5, 2.5, 4); scene.add(l1);
        var l2 = new THREE.DirectionalLight(PURPLE, 0.65); l2.position.set(-4, -2.5, 2.5); scene.add(l2);
        var l3 = new THREE.DirectionalLight(0xdff6f7, 0.3); l3.position.set(0, 5, 3); scene.add(l3);
      } else if (variant === 'veil') {
        // simple translucent strip for light backgrounds — frosted glass
        var vmat = new THREE.MeshPhysicalMaterial({
          color: 0x8fd8dd, metalness: 0, roughness: 0.18,
          transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false,
          clearcoat: 1, clearcoatRoughness: 0.15
        });
        var vgeo = buildStrip(THREE, R, W, uSeg, vSeg, 0, Math.PI * 2);
        group.add(new THREE.Mesh(vgeo, vmat));
        // faint inner sheen so overlapping layers read as glass depth
        group.add(new THREE.Mesh(vgeo, new THREE.MeshBasicMaterial({
          color: 0xffffff, transparent: true, opacity: 0.05, side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending, depthWrite: false
        })));
        var vtube = new THREE.Mesh(
          new THREE.TubeGeometry(edge, coarse ? 200 : 380, 0.009, 6, true),
          new THREE.MeshBasicMaterial({ color: 0x2ba6ac, transparent: true, opacity: 0.35, depthWrite: false }));
        group.add(vtube);
        scene.add(new THREE.HemisphereLight(0xffffff, 0xb9d8dd, 1.0));
        var vl = new THREE.DirectionalLight(0xffffff, 0.7); vl.position.set(3, 3, 4); scene.add(vl);
      } else if (variant === 'ghost') {
        // transparent background treatment — faint dark glass + teal edge, sits behind copy
        var ghmat = new THREE.MeshPhysicalMaterial({
          color: 0x2e7d8a, metalness: 0.55, roughness: 0.3,
          transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false
        });
        group.add(new THREE.Mesh(buildStrip(THREE, R, W, uSeg, vSeg, 0, Math.PI * 2), ghmat));
        var ghtube = new THREE.Mesh(
          new THREE.TubeGeometry(edge, coarse ? 200 : 380, 0.011, 6, true),
          new THREE.MeshBasicMaterial({ color: TEAL, transparent: true, opacity: 0.55, depthWrite: false }));
        group.add(ghtube);
        var ghhalo = new THREE.Mesh(
          new THREE.TubeGeometry(edge, coarse ? 140 : 260, 0.034, 6, true),
          new THREE.MeshBasicMaterial({ color: TEAL, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false }));
        group.add(ghhalo);
        scene.add(new THREE.HemisphereLight(0x24506a, 0x02090f, 0.7));
        var ghl = new THREE.DirectionalLight(TEAL, 0.8); ghl.position.set(3, 2.5, 4); scene.add(ghl);
        var ghl2 = new THREE.DirectionalLight(PURPLE, 0.4); ghl2.position.set(-4, -2, 2.5); scene.add(ghl2);
      } else if (variant === 'glass') {
        var gmat = new THREE.MeshPhysicalMaterial({
          color: 0xa9ecef, metalness: 0, roughness: 0.12,
          transparent: true, opacity: 0.26, side: THREE.DoubleSide, depthWrite: false,
          clearcoat: 0.8, clearcoatRoughness: 0.2
        });
        var geo = buildStrip(THREE, R, W, uSeg, vSeg, 0, Math.PI * 2);
        group.add(new THREE.Mesh(geo, gmat));
        group.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
          color: TEAL, transparent: true, opacity: 0.05, side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending, depthWrite: false
        })));
        var etube = new THREE.Mesh(
          new THREE.TubeGeometry(edge, coarse ? 200 : 380, 0.008, 6, true),
          new THREE.MeshBasicMaterial({ color: 0xcffafb, transparent: true, opacity: 0.35, depthWrite: false }));
        group.add(etube);
        // internal travelling light
        var pl = new THREE.PointLight(0x9ff4f6, 1.8, 4.5, 2);
        group.add(pl); this._travelLight = pl;
        var spr = new THREE.Sprite(new THREE.SpriteMaterial({
          map: glowTexture(THREE, 'rgba(230,255,255,.95)', 'rgba(64,193,199,.5)'),
          transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending
        }));
        spr.scale.setScalar(0.5); group.add(spr); this._travelSprite = spr;
        scene.add(new THREE.HemisphereLight(0x2a5a72, 0x061520, 0.9));
        var gl1 = new THREE.DirectionalLight(0xbfeff1, 0.55); gl1.position.set(2, 3, 4); scene.add(gl1);
      } else { // ribbon — brand-gradient segments with geometric cuts (logo slash rhythm)
        var teal = new THREE.Color(0x40c1c7), navy = new THREE.Color(0x123c52), purple = new THREE.Color(0x6f5bd8);
        var colorFn = function (u) {
          var t = (u / (Math.PI * 2)) % 1;
          var c = new THREE.Color();
          if (t < 0.45) c.copy(teal).lerp(navy, t / 0.45);
          else if (t < 0.75) c.copy(navy).lerp(purple, (t - 0.45) / 0.3);
          else c.copy(purple).lerp(teal, (t - 0.75) / 0.25);
          return c;
        };
        var CUTS = 9, gap = 0.055;
        var rmat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
        for (var k = 0; k < CUTS; k++) {
          var a = Math.PI * 2 * (k + gap) / CUTS, b = Math.PI * 2 * (k + 1 - gap) / CUTS;
          group.add(new THREE.Mesh(buildStrip(THREE, R, W, Math.ceil(uSeg / CUTS), vSeg, a, b, colorFn), rmat));
        }
      }

      // 8 faint milestone markers riding the single continuous edge
      var mg = new THREE.Group();
      var mtex = glowTexture(THREE, 'rgba(255,255,255,.9)', variant === 'ribbon' ? 'rgba(18,60,82,.6)' : 'rgba(64,193,199,.6)');
      for (var m = 0; m < 8; m++) {
        var sp = new THREE.Sprite(new THREE.SpriteMaterial({
          map: mtex, transparent: true, opacity: variant === 'ribbon' ? 0.35 : 0.22,
          depthWrite: false, blending: variant === 'ribbon' ? THREE.NormalBlending : THREE.AdditiveBlending
        }));
        sp.scale.setScalar(0.16);
        mg.add(sp);
      }
      mg.visible = this._markers;
      group.add(mg);
      this._markerGroup = mg;

      // resize
      this._ro = new ResizeObserver(function () { self._resize(); });
      this._ro.observe(this);
      this._resize();

      // pointer parallax (desktop only). Attached to the owning <section>
      // rather than the parent wrapper: in the hero the wrapper div is
      // pointer-events-none, so events never fire on it. Same fix as the
      // pointer block in mark.js.
      var pxHost = this.closest('section') || this.parentElement;
      if (!coarse && !reduced && pxHost) {
        var host = pxHost;
        host.addEventListener('pointermove', function (e) {
          var r = host.getBoundingClientRect();
          self._tx = (e.clientX - r.left) / r.width * 2 - 1;
          self._ty = (e.clientY - r.top) / r.height * 2 - 1;
        });
        host.addEventListener('pointerleave', function () { self._tx = 0; self._ty = 0; });
      }

      if (reduced) {
        this._angle = 1.1;
        // Both clocks are pushed past the end so the strip renders already
        // formed and static. uForm matters as much as uTime here: without it
        // a reduced-motion visitor would get the unformed start cloud, which
        // is the one state that means nothing on its own.
        if (this._pmat) {
          this._pmat.uniforms.uTime.value = 200;
          this._pmat.uniforms.uForm.value = 200;
        }
        this._pose(0); this._renderOnce(); return;
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
    _pose(t) {
      var g = this._group;
      var inv = this._invert || 1;
      g.rotation.set(inv * (-0.95 + 0.07 * Math.sin(t * 0.19) + this._py * 0.06),
                     inv * (0.12 * Math.sin(t * 0.13) + this._px * 0.1),
                     inv * this._angle);
      if (this._markerGroup && this._markerGroup.visible) {
        for (var i = 0; i < 8; i++) {
          var p = this._edge.getPointAt((this._markerT + i / 8) % 1);
          this._markerGroup.children[i].position.copy(p);
        }
      }
      if (this._travelLight) {
        var lp = this._edge.getPointAt(this._markerT % 1);
        this._travelLight.position.copy(lp).multiplyScalar(0.82);
        this._travelSprite.position.copy(this._travelLight.position);
      }
    }
    _renderOnce() {
      if (this._renderer) { this._pose(0); this._renderer.render(this._scene, this._camera); }
    }
    _syncRunning() {
      var should = this._booted && !this._static && this._inView && !document.hidden && this._renderer;
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
      var rotGate = 1;
      if (this._pmat) {
        // uTime always advances on the wall clock. It drives the idle
        // breathing and the detach drift, which must keep moving whether or
        // not the visitor is scrolling.
        this._elapsed = (this._elapsed || 0) + dt;
        this._pmat.uniforms.uTime.value = this._elapsed;

        // uForm drives formation only: scrollbar when handed over, otherwise
        // the same clock, which reproduces the original behaviour exactly.
        // Scroll maps to formT + 1 rather than formT so two things hold at the
        // end of the range: rotGate below reaches a full 1.0 instead of
        // stalling at 2/3, and formation finishes at about 89% of the scroll,
        // leaving the last stretch as the formed system holding its shape.
        // That final stretch is the third beat; without it the strip completes
        // exactly as the hero unpins and the beat is never seen.
        var form = this._scrollDriven
          ? this._formP * (this._formT + 1)
          : this._elapsed;
        this._pmat.uniforms.uForm.value = form;

        // Gates key off formation progress rather than elapsed time, so the
        // rotation eases in and the light completes its circuit as the strip
        // completes, not on a timer running independently of it.
        rotGate = Math.max(0, Math.min(1, (form - this._formT + 2) / 3));
        if (this._loopLight) {
          var lt = this._scrollDriven
            ? (this._formP - 0.55) / 0.45      // one circuit over the last 45%
            : (form - this._formT + 1.5) / 14; // one circuit on the clock
          if (lt > 0 && lt < 1) {
            this._loopLight.material.opacity = Math.sin(Math.min(lt, 1) * Math.PI) * 0.9;
            this._loopLight.position.copy(this._edge.getPointAt(lt % 1));
          } else { this._loopLight.material.opacity = 0; }
        }
      }
      this._angle += dt * 0.11 * sp * rotGate;               // slow continuous revolution
      this._markerT = (this._markerT + dt * 0.016 * sp) % 1; // one edge circuit ≈ 60s
      this._px += (this._tx - this._px) * 0.04;
      this._py += (this._ty - this._py) * 0.04;
      this._pose(now / 1000);
      this._renderer.render(this._scene, this._camera);
    }
  }
  customElements.define('zare-mobius', ZareMobius);
})();

// Added on port: marks this as an ES module so it can be side-effect
// imported from TypeScript. The IIFE above is verbatim from the design
// handoff and must not be edited.
export {};
