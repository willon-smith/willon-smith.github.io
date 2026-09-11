// Hero scene: a field of ~37k points displaced by layered noise, lifted by the
// cursor and spread by scroll. Custom GLSL, additive blending, one draw call.
import * as THREE from 'three';

const NOISE = `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);
  const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);
  vec3 l=1.0-g;
  vec3 i1=min(g.xyz,l.zxy);
  vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;
  vec3 x2=x0-i2+C.yyy;
  vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;
  vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);
  vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;
  vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);
  vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;
  vec4 s1=floor(b1)*2.0+1.0;
  vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);
  vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z);
  vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
  m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

const VERT = `
uniform float uTime;
uniform vec2 uMouse;
uniform float uMouseStrength;
uniform float uScroll;
uniform float uPixelRatio;
attribute float aRand;
varying float vH;
varying float vDepth;
varying float vGlow;
varying float vRand;
${NOISE}
void main(){
  vec3 p = position;
  float t = uTime * 0.16;
  float n = snoise(vec3(p.x*0.32, p.z*0.46, t)) * 0.55
          + snoise(vec3(p.x*0.85 + 3.1, p.z*1.05, t*1.7)) * 0.16
          + snoise(vec3(p.x*2.1, p.z*2.3, t*2.4)) * 0.045;
  float ridgeX = sin(t*0.9) * 4.5 + p.z * 0.4;
  float ridge = exp(-pow(p.x - ridgeX, 2.0) * 0.28) * 0.42;
  float d = distance(p.xz, uMouse);
  float m = exp(-d*d*0.45) * uMouseStrength;
  p.y = n + ridge + m * 1.1;
  p.y *= 1.0 + uScroll * 2.2;
  p.x *= 1.0 + uScroll * 0.9;
  p.z += uScroll * 2.5;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float size = (1.9 + aRand * 1.5 + m * 4.5 + smoothstep(0.2, 0.9, n + ridge) * 1.2) * uPixelRatio;
  gl_PointSize = size * (6.0 / max(-mv.z, 0.5));
  vH = n + ridge + m;
  vDepth = -mv.z;
  vGlow = m;
  vRand = aRand;
}`;

const FRAG = `
precision highp float;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uColorC;
uniform float uFade;
varying float vH;
varying float vDepth;
varying float vGlow;
varying float vRand;
void main(){
  vec2 c = gl_PointCoord - 0.5;
  float r = length(c);
  if (r > 0.5) discard;
  float a = smoothstep(0.5, 0.08, r);
  float h = clamp(vH * 0.95 + 0.42, 0.0, 1.0);
  vec3 col = mix(uColorC, uColorB, h);
  col = mix(col, uColorA, smoothstep(0.58, 1.0, h) * 0.95 + vGlow * 0.9);
  float fog = smoothstep(16.0, 4.0, vDepth);
  float alpha = a * (0.28 + 0.72 * h) * fog * uFade * (0.55 + 0.45 * vRand);
  gl_FragColor = vec4(col, alpha);
}`;

export function initScene(canvas, { reduce = false, mobile = false } = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'high-performance' });
  } catch (e) {
    canvas.style.display = 'none';
    return { setScroll() {}, setFade() {}, pause() {}, resume() {}, dispose() {} };
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.75));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 60);
  const camBase = new THREE.Vector3(0, 2.35, 6.6);
  camera.position.copy(camBase);
  camera.lookAt(0, 0.25, -0.5);

  const W = mobile ? 150 : 250, H = mobile ? 90 : 150, SX = 18, SZ = 10;
  const count = W * H;
  const pos = new Float32Array(count * 3);
  const rnd = new Float32Array(count);
  let k = 0;
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      pos[k * 3] = (i / (W - 1) - 0.5) * SX;
      pos[k * 3 + 1] = 0;
      pos[k * 3 + 2] = (j / (H - 1) - 0.5) * SZ;
      rnd[k] = Math.random();
      k++;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aRand', new THREE.BufferAttribute(rnd, 1));

  const uniforms = {
    uTime: { value: 0 },
    uMouse: { value: new THREE.Vector2(99, 99) },
    uMouseStrength: { value: 0 },
    uScroll: { value: 0 },
    uPixelRatio: { value: renderer.getPixelRatio() },
    uFade: { value: 1 },
    uColorA: { value: new THREE.Color('#f2b56b') },
    uColorB: { value: new THREE.Color('#7cc4ff') },
    uColorC: { value: new THREE.Color('#5b4fd6') },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, vertexShader: VERT, fragmentShader: FRAG,
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, mat);
  points.rotation.y = -0.12;
  scene.add(points);

  // pointer → world position on the y=0 plane
  const ray = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const ndc = new THREE.Vector2();
  const hit = new THREE.Vector3();
  const target = new THREE.Vector2(99, 99);
  let targetStrength = 0;
  let idleTimer = 0;
  const parallax = { x: 0, y: 0, tx: 0, ty: 0 };

  function onMove(e) {
    const x = (e.clientX / window.innerWidth) * 2 - 1;
    const y = -(e.clientY / window.innerHeight) * 2 + 1;
    ndc.set(x, y);
    ray.setFromCamera(ndc, camera);
    if (ray.ray.intersectPlane(plane, hit)) target.set(hit.x, hit.z);
    targetStrength = 1;
    parallax.tx = x; parallax.ty = y;
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { targetStrength = 0; }, 1800);
  }
  if (!reduce) window.addEventListener('pointermove', onMove, { passive: true });

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < 700 ? 60 : 48;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  let running = false, raf = 0, start = performance.now();
  function frame(now) {
    if (!running) return;
    const t = (now - start) / 1000;
    uniforms.uTime.value = t;
    uniforms.uMouse.value.lerp(target, 0.08);
    uniforms.uMouseStrength.value += (targetStrength - uniforms.uMouseStrength.value) * 0.06;
    parallax.x += (parallax.tx - parallax.x) * 0.04;
    parallax.y += (parallax.ty - parallax.y) * 0.04;
    const s = uniforms.uScroll.value;
    camera.position.x = camBase.x + parallax.x * 0.35;
    camera.position.y = camBase.y + parallax.y * 0.18 + s * 3.2;
    camera.position.z = camBase.z + s * 2.0;
    camera.lookAt(0, 0.25 + s * 1.2, -0.5);
    points.rotation.y = -0.12 + Math.sin(t * 0.05) * 0.04;
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }
  function resume() { if (running) return; running = true; raf = requestAnimationFrame(frame); }
  function pause() { running = false; cancelAnimationFrame(raf); }

  if (reduce) {
    uniforms.uTime.value = 7.3;
    renderer.render(scene, camera);
  } else {
    resume();
  }
  document.addEventListener('visibilitychange', () => {
    if (reduce) return;
    if (document.hidden) pause(); else resume();
  });

  return {
    setScroll(p) { uniforms.uScroll.value = p; },
    setFade(f) { uniforms.uFade.value = f; },
    pause, resume,
    dispose() { pause(); geo.dispose(); mat.dispose(); renderer.dispose(); },
  };
}
