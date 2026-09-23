// Showcase band: a 3D road bike that explodes into its parts as you scroll.
// Built from simple Three.js primitives; loaded as a module, and the page
// works without it.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';

const band = document.getElementById('showcase');
const canvas = document.getElementById('showcaseCanvas');

if (band && canvas) {
  try {
    init();
  } catch (e) {
    // No WebGL: show the caption as a plain section instead.
    canvas.remove();
    band.classList.add('no-webgl');
  }
}

function init() {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sticky = band.querySelector('.showcase-sticky');
  const caption = band.querySelector('.showcase-caption');
  const labelLayer = document.getElementById('bikeLabels');

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);

  // Lighting: soft sky fill plus a key light, like a studio product shot
  const hemi = new THREE.HemisphereLight(0xffffff, 0x8f95a3, 1.2);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffffff, 1.8);
  key.position.set(3, 5, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xffffff, 0.6);
  rim.position.set(-4, 2, -3);
  scene.add(rim);

  // rig moves the whole bike aside for the caption; root holds the bike itself
  const rig = new THREE.Group();
  scene.add(rig);
  const SCALE = 2.6;
  const root = new THREE.Group();
  root.scale.setScalar(SCALE);
  root.position.y = -0.5 * SCALE;
  rig.add(root);

  // ---------- Materials (colours are set from the site theme) ----------
  const mats = {
    frame: new THREE.MeshPhysicalMaterial({ roughness: 0.32, metalness: 0.1, clearcoat: 0.9, clearcoatRoughness: 0.2 }),
    tire: new THREE.MeshStandardMaterial({ roughness: 0.9 }),
    rim: new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.8 }),
    metal: new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.7 }),
    soft: new THREE.MeshStandardMaterial({ roughness: 0.8 }),
    chain: new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.6 }),
    hub: new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.5 }),
    spoke: new THREE.LineBasicMaterial({ transparent: true, opacity: 0.75 })
  };

  // ---------- Geometry helpers ----------
  const V = (x, y, z = 0) => new THREE.Vector3(x, y, z);
  const UP = V(0, 1, 0);

  function tube(a, b, radius, mat) {
    const dir = new THREE.Vector3().subVectors(b, a);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, dir.length(), 20), mat);
    mesh.position.copy(a).addScaledVector(dir, 0.5);
    mesh.quaternion.setFromUnitVectors(UP, dir.normalize());
    return mesh;
  }

  function curveTube(points, radius, mat, closed = false) {
    const curve = new THREE.CatmullRomCurve3(points, closed);
    return new THREE.Mesh(new THREE.TubeGeometry(curve, 64, radius, 10, closed), mat);
  }

  function disc(radius, depth, mat) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, depth, 40), mat);
    mesh.rotation.x = Math.PI / 2;
    return mesh;
  }

  // Key points of a road bike (metres, side view in the XY plane)
  const REAR = V(-0.5, 0.34);
  const FRONT = V(0.5, 0.34);
  const BB = V(-0.06, 0.28);
  const SEAT_TOP = V(-0.16, 0.8);
  const HEAD_TOP = V(0.36, 0.78);
  const HEAD_BOT = V(0.39, 0.64);

  // ---------- Parts ----------
  // Each part is a group with an "explode" offset and a stagger delay.
  const parts = [];
  function part(name, offset, delay) {
    const group = new THREE.Group();
    root.add(group);
    const p = { name, group, offset: V(...offset), delay };
    parts.push(p);
    return p;
  }

  // Frame
  const frame = part('frame', [0, 0, 0], 0);
  frame.group.add(
    tube(SEAT_TOP, HEAD_TOP, 0.018, mats.frame),             // top tube
    tube(BB, HEAD_BOT, 0.023, mats.frame),                    // down tube
    tube(BB, SEAT_TOP, 0.017, mats.frame),                    // seat tube
    tube(HEAD_TOP.clone().add(V(-0.005, 0.02)), HEAD_BOT.clone().add(V(0.005, -0.02)), 0.026, mats.frame), // head tube
    tube(V(BB.x, BB.y, 0.03), V(REAR.x, REAR.y, 0.065), 0.009, mats.frame),   // chainstays
    tube(V(BB.x, BB.y, -0.03), V(REAR.x, REAR.y, -0.065), 0.009, mats.frame),
    tube(V(-0.15, 0.75, 0.015), V(REAR.x, REAR.y, 0.065), 0.008, mats.frame), // seatstays
    tube(V(-0.15, 0.75, -0.015), V(REAR.x, REAR.y, -0.065), 0.008, mats.frame)
  );
  const bbShell = disc(0.028, 0.075, mats.frame);
  bbShell.position.copy(BB);
  frame.group.add(bbShell);

  // Wheels
  function wheel(center, offset, delay, name) {
    const p = part(name, offset, delay);
    const spinner = new THREE.Group();
    spinner.position.copy(center);
    p.group.add(spinner);
    spinner.add(new THREE.Mesh(new THREE.TorusGeometry(0.335, 0.017, 14, 110), mats.tire));
    spinner.add(new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.011, 10, 110), mats.rim));
    spinner.add(disc(0.022, 0.11, mats.hub));
    const pts = [];
    const SPOKES = 24;
    for (let i = 0; i < SPOKES; i++) {
      const a = (i / SPOKES) * Math.PI * 2;
      const side = i % 2 ? 0.035 : -0.035;
      pts.push(V(Math.cos(a + 0.2) * 0.02, Math.sin(a + 0.2) * 0.02, side), V(Math.cos(a) * 0.303, Math.sin(a) * 0.303, 0));
    }
    spinner.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), mats.spoke));
    p.spinner = spinner;
    return p;
  }
  const rearWheel = wheel(REAR, [-0.42, -0.02, -0.38], 0.1, 'rearWheel');
  const frontWheel = wheel(FRONT, [0.46, -0.02, -0.38], 0.1, 'frontWheel');

  // Fork
  const fork = part('fork', [0.3, 0.03, -0.12], 0.2);
  fork.group.add(
    tube(V(HEAD_BOT.x, HEAD_BOT.y - 0.03, 0.035), V(FRONT.x, FRONT.y, 0.055), 0.011, mats.frame),
    tube(V(HEAD_BOT.x, HEAD_BOT.y - 0.03, -0.035), V(FRONT.x, FRONT.y, -0.055), 0.011, mats.frame)
  );
  const crown = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.09), mats.frame);
  crown.position.set(HEAD_BOT.x, HEAD_BOT.y - 0.035, 0);
  crown.rotation.z = -0.2;
  fork.group.add(crown);

  // Cockpit: stem and drop handlebar
  const cockpit = part('cockpit', [0.32, 0.3, 0.05], 0.3);
  const STEM_END = V(0.46, 0.82);
  cockpit.group.add(tube(HEAD_TOP.clone().add(V(0, 0.02)), STEM_END, 0.014, mats.metal));
  cockpit.group.add(tube(V(STEM_END.x, STEM_END.y, -0.21), V(STEM_END.x, STEM_END.y, 0.21), 0.012, mats.soft));
  [-0.21, 0.21].forEach((z) => {
    cockpit.group.add(curveTube([
      V(0.46, 0.82, z), V(0.53, 0.815, z), V(0.565, 0.76, z), V(0.54, 0.7, z), V(0.47, 0.685, z)
    ], 0.011, mats.soft));
    const hood = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.035, 0.028), mats.soft);
    hood.position.set(0.535, 0.83, z);
    cockpit.group.add(hood);
  });

  // Seatpost and saddle
  const seat = part('seat', [-0.18, 0.38, 0], 0.3);
  seat.group.add(tube(SEAT_TOP, V(-0.19, 0.92), 0.012, mats.metal));
  const saddle = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.2, 8, 20), mats.soft);
  saddle.rotation.z = Math.PI / 2;
  saddle.scale.set(0.55, 1, 1.5);
  saddle.position.set(-0.19, 0.94, 0);
  seat.group.add(saddle);

  // Crankset: chainring, crank arms and pedals (the cranks turn slowly)
  const crankset = part('crankset', [0.05, -0.22, 0.42], 0.45);
  const cranks = new THREE.Group();
  cranks.position.copy(BB);
  crankset.group.add(cranks);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.007, 8, 80), mats.metal);
  ring.position.z = 0.07;
  const spider = disc(0.06, 0.006, mats.metal);
  spider.position.z = 0.07;
  cranks.add(ring, spider, disc(0.012, 0.19, mats.metal));
  [[0.09, 1], [-0.09, -1]].forEach(([z, dir]) => {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.17, 0.012), mats.metal);
    arm.position.set(0, -0.085 * dir, z);
    const pedal = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.018, 0.06), mats.soft);
    pedal.position.set(0, -0.17 * dir, z + 0.045 * Math.sign(z));
    cranks.add(arm, pedal);
  });
  crankset.spinner = cranks;

  // Chain loop around the chainring and the largest cog
  const chain = part('chain', [-0.05, -0.12, 0.26], 0.55);
  const chainPts = [];
  [90, 45, 0, -45, -90].forEach((d) => {
    const a = THREE.MathUtils.degToRad(d);
    chainPts.push(V(BB.x + Math.cos(a) * 0.104, BB.y + Math.sin(a) * 0.104, 0.065));
  });
  [-90, -135, 180, 135, 90].forEach((d) => {
    const a = THREE.MathUtils.degToRad(d);
    chainPts.push(V(REAR.x + Math.cos(a) * 0.05, REAR.y + Math.sin(a) * 0.05, 0.065));
  });
  chain.group.add(curveTube(chainPts, 0.0045, mats.chain, true));

  // Cassette and rear derailleur
  const cassette = part('cassette', [-0.45, -0.05, 0.46], 0.6);
  for (let i = 0; i < 7; i++) {
    const cog = disc(0.047 - i * 0.004, 0.0035, mats.metal);
    cog.position.set(REAR.x, REAR.y, 0.066 - i * 0.006);
    cassette.group.add(cog);
  }
  const mech = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.08, 0.02), mats.soft);
  mech.position.set(REAR.x + 0.01, REAR.y - 0.09, 0.075);
  mech.rotation.z = 0.35;
  cassette.group.add(mech);

  // Soft contact shadow under the bike
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = shadowCanvas.height = 128;
  const sg = shadowCanvas.getContext('2d');
  const sgrad = sg.createRadialGradient(64, 64, 0, 64, 64, 64);
  sgrad.addColorStop(0, 'rgba(0,0,0,0.35)');
  sgrad.addColorStop(1, 'rgba(0,0,0,0)');
  sg.fillStyle = sgrad;
  sg.fillRect(0, 0, 128, 128);
  const shadowMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shadowCanvas), transparent: true, depthWrite: false });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.7), shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0;
  root.add(shadow);

  // ---------- Labels ----------
  const labelDefs = [
    { text: 'Frame', part: frame, at: V(0.1, 0.8) },
    { text: 'Wheels', part: frontWheel, at: V(0.5, 0.69) },
    { text: 'Fork', part: fork, at: V(0.46, 0.48, 0.05) },
    { text: 'Cockpit', part: cockpit, at: V(0.56, 0.84, 0.21) },
    { text: 'Saddle', part: seat, at: V(-0.12, 0.97) },
    { text: 'Crankset', part: crankset, at: V(BB.x, BB.y - 0.17, 0.14) },
    { text: 'Chain', part: chain, at: V(-0.28, 0.39, 0.065) },
    { text: 'Cassette', part: cassette, at: V(REAR.x, REAR.y + 0.05, 0.07) }
  ];
  const labels = labelDefs.map((def) => {
    const el = document.createElement('div');
    el.className = 'bike-label';
    const span = document.createElement('span');
    span.textContent = def.text;
    el.appendChild(span);
    labelLayer && labelLayer.appendChild(el);
    return { ...def, el };
  });

  // ---------- Scroll state ----------
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const clamp01 = (t) => Math.min(1, Math.max(0, t));
  let progress = reduceMotion ? 1 : 0;
  let explode = reduceMotion ? 1 : 0;
  let captionT = reduceMotion ? 1 : 0;

  function readScroll() {
    if (reduceMotion) return;
    const rect = band.getBoundingClientRect();
    progress = clamp01((window.innerHeight - rect.top) / rect.height);
    // The band is pinned from progress ~0.33 onwards: hold the assembled bike,
    // explode it, then bring in the caption
    explode = clamp01((progress - 0.4) / 0.25);
    captionT = clamp01((progress - 0.72) / 0.1);
    if (caption) caption.style.setProperty('--caption', captionT.toFixed(3));
  }

  function updateScene() {
    parts.forEach((p) => {
      // Parts leave one after another, so the explosion reads as a sequence
      const t = ease(clamp01((explode - p.delay * 0.5) / 0.5));
      p.group.position.copy(p.offset).multiplyScalar(t);
    });
    shadowMat.opacity = 1 - 0.6 * explode;

    // Slide the bike right (wide screens) or up (tall screens) for the caption
    const c = ease(captionT);
    if (camera.aspect > 1.1) {
      rig.position.set(1.8 * c, 0.15 * c, 0);
      rig.scale.setScalar(1 - 0.45 * c);
    } else {
      rig.position.set(0, 1.0 * c, 0);
      rig.scale.setScalar(1 - 0.15 * c);
    }
  }

  const tmp = new THREE.Vector3();
  function updateLabels() {
    if (!labelLayer) return;
    const { width, height } = sticky.getBoundingClientRect();
    const visible = ease(clamp01((explode - 0.75) / 0.25));
    labels.forEach((l) => {
      tmp.copy(l.at);
      l.part.group.localToWorld(tmp);
      tmp.project(camera);
      const x = (tmp.x + 1) / 2 * width;
      const y = (1 - tmp.y) / 2 * height;
      l.el.style.transform = `translate(${x.toFixed(1)}px, ${(y - 10).toFixed(1)}px)`;
      l.el.style.opacity = visible.toFixed(3);
    });
  }

  // ---------- Theme ----------
  function applyTheme() {
    const css = getComputedStyle(document.documentElement);
    const color = (name, fallback) => new THREE.Color(css.getPropertyValue(name).trim() || fallback);
    const root_ = document.documentElement;
    const isDark = root_.getAttribute('data-theme') === 'dark' ||
      (!root_.getAttribute('data-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);

    mats.frame.color.copy(color('--accent', '#e71d36'));
    mats.hub.color.copy(color('--accent-2', '#1b746c'));
    mats.chain.color.copy(color('--accent-3', '#ff9f1c'));
    // Neutral parts are tints of ink black, so they sit in the same palette
    mats.tire.color.set(isDark ? '#2c3f52' : '#011627');
    mats.soft.color.set(isDark ? '#41566b' : '#1d3142');
    mats.rim.color.set('#b3bdc6');
    mats.metal.color.set(isDark ? '#b3bdc6' : '#8593a0');
    mats.spoke.color.set(isDark ? '#8593a0' : '#66747f');
    hemi.intensity = isDark ? 1.0 : 1.2;
    shadow.visible = !isDark;
    render();
  }
  new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

  // Keep the exploded bike in frame on both wide and tall screens
  function resize() {
    const { width, height } = sticky.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    // Frame the exploded bike (about 8.8 x 6 units), aiming slightly high to clear the header
    camera.position.set(0, 0.4, Math.max(4.4 / (tan * camera.aspect), 3.0 / tan));
    camera.lookAt(0, 0.1, 0);
    camera.updateProjectionMatrix();
    updateScene();
    render();
  }
  new ResizeObserver(resize).observe(sticky);

  // Mouse parallax
  const target = { x: 0, y: 0 };
  window.addEventListener('pointermove', (e) => {
    target.x = (e.clientX / window.innerWidth - 0.5) * 0.4;
    target.y = (e.clientY / window.innerHeight - 0.5) * 0.2;
  }, { passive: true });

  function render() {
    renderer.render(scene, camera);
    updateLabels();
  }

  // ---------- Loop ----------
  let running = false;
  let last = 0;
  let time = 0;

  function frameLoop(now) {
    if (!running) return;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    time += dt;
    readScroll();
    // Side view when assembled, turning to a three-quarter view as it explodes
    const yaw = -0.25 - 0.55 * ease(explode) + Math.sin(time * 0.35) * 0.08 + target.x;
    root.rotation.y += (yaw - root.rotation.y) * 0.06;
    root.rotation.x += ((0.1 + 0.12 * explode + target.y) - root.rotation.x) * 0.06;
    rearWheel.spinner.rotation.z -= dt * 0.6;
    frontWheel.spinner.rotation.z -= dt * 0.6;
    crankset.spinner.rotation.z -= dt * 0.35;
    updateScene();
    render();
    requestAnimationFrame(frameLoop);
  }

  function start() {
    if (running || reduceMotion) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(frameLoop);
  }
  function stop() { running = false; }

  let onScreen = false;
  new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting;
    onScreen && !document.hidden ? start() : stop();
  }).observe(band);
  document.addEventListener('visibilitychange', () => {
    onScreen && !document.hidden ? start() : stop();
  });
  window.addEventListener('scroll', () => {
    readScroll();
    if (!running) { updateScene(); render(); }
  }, { passive: true });

  root.rotation.set(0.1, reduceMotion ? -0.8 : -0.25, 0);
  readScroll();
  resize();
  applyTheme();
}
