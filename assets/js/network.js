// Neural network band: nodes start scattered across the screen and assemble
// into a rotating sphere as you scroll through the section. Signals then run
// along the connections. Loaded as a module; the page works without it.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';

const band = document.getElementById('network');
const canvas = document.getElementById('networkCanvas');

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
  const sticky = band.querySelector('.network-sticky');
  const caption = band.querySelector('.network-caption');

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);

  // rig holds the sphere and its rings, so they can move aside for the caption
  const rig = new THREE.Group();
  scene.add(rig);
  const network = new THREE.Group();
  rig.add(network);

  // Round sprite texture for nodes
  const dot = document.createElement('canvas');
  dot.width = dot.height = 64;
  const g = dot.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.9)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const dotTexture = new THREE.CanvasTexture(dot);

  // Target positions on a Fibonacci sphere, and scattered start positions
  const NODE_COUNT = 170;
  const RADIUS = 2.3;
  const sphere = [];
  const scatter = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < NODE_COUNT; i++) {
    const y = 1 - (i / (NODE_COUNT - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const theta = golden * i;
    const jitter = 1 + (Math.random() - 0.5) * 0.12;
    sphere.push(new THREE.Vector3(Math.cos(theta) * r, y, Math.sin(theta) * r).multiplyScalar(RADIUS * jitter));
    scatter.push(new THREE.Vector3(
      (Math.random() - 0.5) * 18,
      (Math.random() - 0.5) * 10,
      (Math.random() - 0.5) * 8 - 1
    ));
  }
  const current = sphere.map((v) => v.clone());

  const nodePositions = new Float32Array(NODE_COUNT * 3);
  const nodeGeo = new THREE.BufferGeometry();
  nodeGeo.setAttribute('position', new THREE.BufferAttribute(nodePositions, 3));
  const nodeMat = new THREE.PointsMaterial({
    size: 0.12, map: dotTexture, transparent: true, depthWrite: false, sizeAttenuation: true
  });
  network.add(new THREE.Points(nodeGeo, nodeMat));

  // Connections between nodes that are neighbours on the finished sphere
  const edges = [];
  const neighbours = sphere.map(() => []);
  for (let i = 0; i < NODE_COUNT; i++) {
    for (let j = i + 1; j < NODE_COUNT; j++) {
      if (sphere[i].distanceTo(sphere[j]) < 0.75) {
        neighbours[i].push(edges.length); neighbours[j].push(edges.length);
        edges.push([i, j]);
      }
    }
  }
  const edgePositions = new Float32Array(edges.length * 6);
  const edgeGeo = new THREE.BufferGeometry();
  edgeGeo.setAttribute('position', new THREE.BufferAttribute(edgePositions, 3));
  const edgeMat = new THREE.LineBasicMaterial({ transparent: true, depthWrite: false });
  network.add(new THREE.LineSegments(edgeGeo, edgeMat));

  // Inner core: a slowly counter-rotating wireframe
  const coreMat = new THREE.MeshBasicMaterial({ wireframe: true, transparent: true, depthWrite: false });
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.95, 1), coreMat);
  network.add(core);

  // Orbit rings
  const ringMat = new THREE.MeshBasicMaterial({ transparent: true, side: THREE.DoubleSide, depthWrite: false });
  const rings = [
    { tilt: [1.2, 0.3, 0], radius: 2.75, speed: 0.25 },
    { tilt: [-0.9, 0.8, 0.4], radius: 2.95, speed: -0.18 }
  ].map(({ tilt, radius, speed }) => {
    const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.008, 8, 180), ringMat);
    mesh.rotation.set(...tilt);
    mesh.userData.speed = speed;
    rig.add(mesh);
    return mesh;
  });

  // Signals hopping from edge to edge
  const PULSE_COUNT = 22;
  const pulses = [];
  const pulsePositions = new Float32Array(PULSE_COUNT * 3);
  for (let i = 0; i < PULSE_COUNT; i++) {
    const edge = Math.floor(Math.random() * edges.length);
    pulses.push({ edge, from: edges[edge][0], t: Math.random(), speed: 0.6 + Math.random() * 0.9 });
  }
  const pulseGeo = new THREE.BufferGeometry();
  pulseGeo.setAttribute('position', new THREE.BufferAttribute(pulsePositions, 3));
  const pulseMat = new THREE.PointsMaterial({ size: 0.24, map: dotTexture, transparent: true, depthWrite: false });
  network.add(new THREE.Points(pulseGeo, pulseMat));

  const tmp = new THREE.Vector3();
  function updatePulses(dt) {
    pulses.forEach((p, i) => {
      p.t += dt * p.speed;
      if (p.t >= 1) {
        const [a, b] = edges[p.edge];
        const at = p.from === a ? b : a;
        const options = neighbours[at];
        p.edge = options[Math.floor(Math.random() * options.length)];
        p.from = at;
        p.t = 0;
      }
      const [a, b] = edges[p.edge];
      const to = p.from === a ? b : a;
      tmp.lerpVectors(current[p.from], current[to], p.t).toArray(pulsePositions, i * 3);
    });
    pulseGeo.attributes.position.needsUpdate = true;
  }

  // Scroll progress through the band: 0 when it enters, 1 when it leaves
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const clamp01 = (t) => Math.min(1, Math.max(0, t));
  let assembly = reduceMotion ? 1 : 0;
  let progress = reduceMotion ? 1 : 0;
  let captionT = reduceMotion ? 1 : 0;

  function readScroll() {
    if (reduceMotion) return;
    const rect = band.getBoundingClientRect();
    const total = rect.height;
    progress = clamp01((window.innerHeight - rect.top) / total);
    assembly = ease(clamp01((progress - 0.12) / 0.4));
    captionT = clamp01((progress - 0.5) / 0.12);
    if (caption) caption.style.setProperty('--caption', captionT.toFixed(3));
  }

  function updateGeometry() {
    for (let i = 0; i < NODE_COUNT; i++) {
      current[i].lerpVectors(scatter[i], sphere[i], assembly).toArray(nodePositions, i * 3);
    }
    edges.forEach(([a, b], k) => {
      current[a].toArray(edgePositions, k * 6);
      current[b].toArray(edgePositions, k * 6 + 3);
    });
    nodeGeo.attributes.position.needsUpdate = true;
    edgeGeo.attributes.position.needsUpdate = true;

    const settled = Math.pow(assembly, 3);
    edgeMat.opacity = theme.edgeOpacity * settled;
    coreMat.opacity = theme.coreOpacity * settled;
    ringMat.opacity = 0.4 * settled;
    pulseMat.opacity = settled;
    nodeMat.opacity = 0.35 + 0.65 * assembly;
    core.scale.setScalar(0.4 + 0.6 * settled);

    // Slide the sphere right (wide screens) or up (tall screens) to make room for the caption
    const t = ease(captionT);
    if (camera.aspect > 1) {
      const halfWidth = 3.3 * camera.aspect;
      rig.position.set(Math.max(0, Math.min(2.4, halfWidth - 3.1)) * t, 0, 0);
      rig.scale.setScalar(1 - 0.1 * t);
    } else {
      rig.position.set(0, 1.3 * t, 0);
      rig.scale.setScalar(1 - 0.2 * t);
    }
  }

  // Colours follow the site theme (light/dark toggle and system setting)
  const theme = { edgeOpacity: 0.3, coreOpacity: 0.3 };
  function applyTheme() {
    const css = getComputedStyle(document.documentElement);
    const color = (name, fallback) => new THREE.Color(css.getPropertyValue(name).trim() || fallback);
    const root = document.documentElement;
    const isDark = root.getAttribute('data-theme') === 'dark' ||
      (!root.getAttribute('data-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);

    nodeMat.color.copy(color('--accent', '#ff4433'));
    pulseMat.color.copy(color('--accent', '#ff4433'));
    coreMat.color.copy(color('--accent', '#ff4433'));
    edgeMat.color.copy(color('--accent-2', '#53dfc3'));
    ringMat.color.copy(color('--accent-3', '#ebd17a'));

    // Additive glow only reads on dark backgrounds
    const blending = isDark ? THREE.AdditiveBlending : THREE.NormalBlending;
    nodeMat.blending = pulseMat.blending = blending;
    nodeMat.needsUpdate = pulseMat.needsUpdate = true;
    theme.edgeOpacity = isDark ? 0.3 : 0.45;
    theme.coreOpacity = isDark ? 0.3 : 0.4;
    updateGeometry();
    render();
  }
  new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

  // Keep the whole sphere in frame on both wide and tall screens
  function resize() {
    const { width, height } = sticky.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    const fit = 3.3 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    camera.position.z = fit / Math.min(1, camera.aspect);
    camera.updateProjectionMatrix();
    updateGeometry();
    render();
  }
  new ResizeObserver(resize).observe(sticky);

  // Mouse parallax
  const target = { x: 0, y: 0 };
  window.addEventListener('pointermove', (e) => {
    target.x = (e.clientX / window.innerWidth - 0.5) * 0.5;
    target.y = (e.clientY / window.innerHeight - 0.5) * 0.5;
  }, { passive: true });

  function render() { renderer.render(scene, camera); }

  // Animate only while the band is on screen and the tab is visible
  let running = false;
  let last = 0;
  let spin = 0;

  function frame(now) {
    if (!running) return;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    readScroll();
    // Scrolling also turns the sphere, so it feels tied to the page
    spin += dt * 0.1;
    const scrollTurn = progress * Math.PI * 1.2;
    network.rotation.y += ((spin + scrollTurn + target.x) - network.rotation.y) * 0.06;
    network.rotation.x += ((0.25 + target.y) - network.rotation.x) * 0.06;
    rings.forEach((ring) => { ring.rotation.z += dt * ring.userData.speed; });
    core.rotation.y -= dt * 0.3;
    core.rotation.x += dt * 0.15;
    updateGeometry();
    updatePulses(dt);
    render();
    requestAnimationFrame(frame);
  }

  function start() {
    if (running || reduceMotion) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(frame);
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

  // Scroll drives the assembly directly, so it tracks the page even between frames
  window.addEventListener('scroll', () => {
    readScroll();
    if (!running) { updateGeometry(); render(); }
  }, { passive: true });

  network.rotation.x = 0.25;
  readScroll();
  updatePulses(0);
  resize();
  applyTheme();
}
