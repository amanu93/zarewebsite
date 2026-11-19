/* Zare Innovations — particle ring formation.
   <zare-ring> renders one THREE.Points cloud that assembles into a torus under
   an externally driven clock, then holds and turns.

   This is a sibling of mobius.js, not a replacement for it. The two share an
   approach but nothing else: this file carries only the particle variant, so
   it drops the five mesh materials, their lighting rigs and the tube geometry
   that mobius.js needs and this does not. Keeping them separate means the
   experiment can be reverted by changing one import.

   Everything that matters for cost is unchanged from mobius.js: one draw call
   for the whole cloud, one ShaderMaterial, all per-particle motion computed on
   the GPU from two uniforms, IntersectionObserver lazy init, tab-visibility
   pause, a reduced-motion static render and a WebGL-failure fallback. */
(function () {
  if (customElements.get('zare-ring')) return;

  /* Torus surface. u sweeps the ring, v sweeps the tube section. */
  function ringPos(R, r, u, v, arr) {
    var cv = Math.cos(v), rr = R + r * cv;
    arr[0] = rr * Math.cos(u);
    arr[1] = rr * Math.sin(u);
    arr[2] = r * Math.sin(v);
    return arr;
  }

  /* Analytic normal. Cheaper and exact, where mobius.js had to approximate one
     from two finite-difference tangents because its surface is not separable. */
  function ringNorm(u, v, arr) {
    var cv = Math.cos(v);
    arr[0] = cv * Math.cos(u);
    arr[1] = cv * Math.sin(u);
    arr[2] = Math.sin(v);
    return arr;
  }

  function circleCurve(THREE, R, n) {
    var pts = [];
    for (var i = 0; i < n; i++) {
      var u = Math.PI * 2 * i / n;
      pts.push(new THREE.Vector3(R * Math.cos(u), R * Math.sin(u), 0));
    }
    return new THREE.CatmullRomCurve3(pts, true);
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

  var FALLBACK_BG =
    'radial-gradient(80% 110% at 50% 45%, rgba(64,193,199,.16), rgba(0,0,0,0) 60%)';

  /* Formation constants. Eight phases sweep the ring, each particle then
     travels for TRAVEL. FORM_T is when the last one lands. */
  var PHASES = 8, PHASE_GAP = 0.45, JITTER = 1.6, TRAVEL = 3.2;
  var FORM_T = PHASE_GAP * (PHASES - 1) + JITTER + TRAVEL;

  class ZareRing extends HTMLElement {
    static get observedAttributes() { return ['speed', 'markers']; }

    constructor() {
      super();
      this._speed = 1;
      this._markers = true;
      this._angle = 0;
      this._last = 0;
      this._raf = 0;
      this._inView = false;
      this._booted = false;
      this._px = 0; this._py = 0; this._tx = 0; this._ty = 0;
      this._markerT = 0;
      this._elapsed = 0;
      /* Formation source. Defaults to the wall clock so the component is
         self-sufficient; the React wrapper hands it the scrollbar instead, and
         only after a successful boot on a fine pointer without reduced motion. */
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
        if (this._static) this._renderOnce();
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

    _boot() {
      if (this._booted) return;
      var self = this;
      if (!window.THREE) { setTimeout(function () { self._boot(); }, 80); return; }
      this._booted = true;
      try { this._setup(); } catch { this._fallback(); }
    }

    _fallback() {
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

      /* Major radius and tube radius. A thin tube reads as a ring with volume;
         much thicker and it becomes a doughnut, which is a different object. */
      var R = 1.5, r = 0.15;

      var group = new THREE.Group();
      /* Centred, unlike mobius.js which sat at x = 1.05 beside the copy. The
         ring is the subject of this sequence and the messages surround it, so
         it belongs on the axis. */
      var ox = this.getAttribute('offset-x');
      group.position.x = ox != null && ox !== '' ? parseFloat(ox) || 0 : 0;
      group.scale.setScalar(parseFloat(this.getAttribute('scale') || '1') || 1);
      scene.add(group);
      this._group = group;

      this._edge = circleCurve(THREE, R, coarse ? 180 : 360);

      var N = coarse ? 5000 : 14000;
      var aStart = new Float32Array(N * 3), aTarget = new Float32Array(N * 3),
          aNorm = new Float32Array(N * 3), aSize = new Float32Array(N),
          aDelay = new Float32Array(N), aShade = new Float32Array(N),
          aDetach = new Float32Array(N), aPhase = new Float32Array(N);
      var p = [0, 0, 0];

      for (var i = 0; i < N; i++) {
        var u = Math.random() * Math.PI * 2;

        /* Halftone density banding along the ring. This is not decoration: a
           torus is rotationally symmetric about its own axis, so a uniform one
           would look completely still while spinning. The bands break that
           symmetry and are what makes state 4 legible as rotation. */
        var band = 0.5 + 0.5 * Math.sin(u * 6);
        if (Math.random() > 0.55 + 0.45 * band && Math.random() < 0.5) { i--; continue; }

        /* Bias toward the outer face of the tube, which is what a viewer sees. */
        var v = Math.random() * Math.PI * 2;
        if (Math.random() < 0.35) v = (Math.random() - 0.5) * 1.2;

        ringPos(R, r, u, v, p);
        aTarget[i * 3] = p[0]; aTarget[i * 3 + 1] = p[1]; aTarget[i * 3 + 2] = p[2];

        ringNorm(u, v, p);
        aNorm[i * 3] = p[0]; aNorm[i * 3 + 1] = p[1]; aNorm[i * 3 + 2] = p[2];

        /* Loose start cloud — state 0. */
        var rr = 2.2 + Math.random() * 2.6,
            th = Math.random() * Math.PI * 2,
            ph = Math.acos(2 * Math.random() - 1);
        aStart[i * 3] = rr * Math.sin(ph) * Math.cos(th);
        aStart[i * 3 + 1] = rr * Math.sin(ph) * Math.sin(th) * 0.7;
        aStart[i * 3 + 2] = rr * Math.cos(ph) * 0.8;

        aSize[i] = 0.55 + Math.random() * Math.random() * 1.35;
        aDelay[i] = Math.floor(u / (Math.PI * 2) * PHASES) * PHASE_GAP + Math.random() * JITTER;
        aShade[i] = Math.random();
        aDetach[i] = Math.random() < 0.04 ? 0.5 + Math.random() : 0.0;
        aPhase[i] = Math.random() * Math.PI * 2;
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
          /* Wall clock. Drives idle breathing and detach drift, which must keep
             moving whether or not the visitor is scrolling. */
          uTime: { value: 0 },
          /* Formation clock. Follows the scrollbar when handed over. Split from
             uTime so a stationary visitor does not freeze a dead object. */
          uForm: { value: 0 },
          uPR: { value: Math.min(window.devicePixelRatio || 1, 2) }
        },
        vertexShader: [
          'attribute vec3 aTarget; attribute vec3 aNorm;',
          'attribute float aSize; attribute float aDelay; attribute float aShade; attribute float aDetach; attribute float aPhase;',
          'uniform float uTime; uniform float uForm; uniform float uPR;',
          'varying float vShade; varying float vFade;',
          'void main(){',
          '  float e = clamp((uForm - aDelay) / ' + TRAVEL.toFixed(1) + ', 0.0, 1.0);',
          '  e = e * e * (3.0 - 2.0 * e);',
          '  vec3 pos = mix(position, aTarget, e);',
          '  pos += aNorm * sin(e * 3.14159) * 0.45;',
          /* smoothstep rather than step: with a scrubbed clock a hard cut makes
             the whole cloud switch on within one frame of scrolling. */
          '  float formed = smoothstep(0.97, 1.0, e);',
          '  pos += aNorm * sin(uTime * 0.5 + aPhase) * 0.014 * formed;',
          '  float drift = max(0.0, sin(uTime * 0.12 + aPhase));',
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
      this._formT = FORM_T;

      /* Light that walks the ring once as it completes. */
      var tl = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTexture(THREE, 'rgba(235,255,255,.95)', 'rgba(64,193,199,.55)'),
        transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending
      }));
      tl.scale.setScalar(0.42);
      group.add(tl);
      this._loopLight = tl;

      /* Eight markers riding the ring. Same motif as mobius.js. */
      var mg = new THREE.Group();
      var mtex = glowTexture(THREE, 'rgba(255,255,255,.9)', 'rgba(64,193,199,.6)');
      for (var m = 0; m < PHASES; m++) {
        var sp = new THREE.Sprite(new THREE.SpriteMaterial({
          map: mtex, transparent: true, opacity: 0.22,
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

      if (!coarse && !reduced && this.parentElement) {
        var host = this.parentElement;
        host.addEventListener('pointermove', function (e) {
          var rect = host.getBoundingClientRect();
          self._tx = (e.clientX - rect.left) / rect.width * 2 - 1;
          self._ty = (e.clientY - rect.top) / rect.height * 2 - 1;
        });
        host.addEventListener('pointerleave', function () { self._tx = 0; self._ty = 0; });
      }

      if (reduced) {
        /* Both clocks pushed past the end, so the ring renders already formed
           and static. uForm matters as much as uTime: without it a
           reduced-motion visitor gets the unformed start cloud, which is the
           one state that means nothing on its own. */
        this._pmat.uniforms.uTime.value = 200;
        this._pmat.uniforms.uForm.value = 200;
        this._pose(0);
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

    /* TILT is the whole read of the object. At 0 the ring is a flat circle
       facing the camera and at -PI/2 it collapses to a line; -0.62 gives an
       open ellipse with enough perspective to show it is a solid in space. */
    _pose(t) {
      var g = this._group;
      g.rotation.set(
        -0.62 + 0.05 * Math.sin(t * 0.19) + this._py * 0.06,
        0.10 * Math.sin(t * 0.13) + this._px * 0.10,
        this._angle
      );
      if (this._markerGroup && this._markerGroup.visible) {
        for (var i = 0; i < PHASES; i++) {
          var pt = this._edge.getPointAt((this._markerT + i / PHASES) % 1);
          this._markerGroup.children[i].position.copy(pt);
        }
      }
    }

    _renderOnce() {
      if (this._renderer) {
        this._pose(0);
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
      var rotGate = 1;

      if (this._pmat) {
        this._elapsed += dt;
        this._pmat.uniforms.uTime.value = this._elapsed;

        /* Scroll maps straight onto the formation window: the wrapper has
           already narrowed the hero's full range down to the part that builds
           the ring, so 1.0 here means "state 3 reached, ring complete". */
        var form = this._scrollDriven ? this._formP * this._formT : this._elapsed;
        this._pmat.uniforms.uForm.value = form;

        /* Rotation eases in as the ring closes rather than running on a timer
           beside it, so nothing turns before there is a thing to turn. */
        rotGate = Math.max(0, Math.min(1, (form - this._formT + 2.5) / 2.5));

        if (this._loopLight) {
          /* One circuit across the last third of the formation. */
          var lt = this._scrollDriven
            ? (this._formP - 0.62) / 0.38
            : (form - this._formT + 1.5) / 14;
          if (lt > 0 && lt < 1) {
            this._loopLight.material.opacity = Math.sin(lt * Math.PI) * 0.9;
            this._loopLight.position.copy(this._edge.getPointAt(lt % 1));
          } else {
            this._loopLight.material.opacity = 0;
          }
        }
      }

      /* Clock-driven, so the ring keeps turning while the visitor is stationary
         at state 4. Only the gate depends on scroll. */
      this._angle += dt * 0.13 * sp * rotGate;
      this._markerT = (this._markerT + dt * 0.02 * sp) % 1;
      this._px += (this._tx - this._px) * 0.04;
      this._py += (this._ty - this._py) * 0.04;
      this._pose(now / 1000);
      this._renderer.render(this._scene, this._camera);
    }
  }

  customElements.define('zare-ring', ZareRing);
})();

/* Marks this as an ES module so it can be side-effect imported from
   TypeScript, matching mobius.js. */
export {};
