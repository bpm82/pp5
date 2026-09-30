import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { SparkRenderer, SplatMesh } from '@sparkjsdev/spark';

async function readSpz(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Record download failed');
  const bytes = new Uint8Array(await response.arrayBuffer());
  // SPZ 4 has six independent Zstandard streams. Repack without changing points
  // into the SPZ 3 gzip layout accepted by Spark. Original files stay untouched.
  if (bytes[0] !== 0x4e) return bytes;
  const header = new DataView(bytes.buffer);
  if (header.getUint32(4, true) !== 4 || (bytes[14] & 2)) throw new Error('Unsupported SPZ extension');
  const { decompress } = await import('https://cdn.jsdelivr.net/npm/fzstd@0.1.1/esm/index.mjs');
  const count = header.getUint32(8, true), toc = header.getUint32(16, true);
  const expected = [count*9, count, count*3, count*3, count*4, count*((bytes[12]+1)**2-1)*3].filter(Boolean);
  if (bytes[15] !== expected.length) throw new Error('Invalid SPZ streams');
  const legacy = bytes.slice(0,16); new DataView(legacy.buffer).setUint32(4,3,true); legacy[15]=0;
  const parts = [legacy]; let offset = toc + bytes[15]*16;
  for (let i=0;i<bytes[15];i++) {
    const length = Number(header.getBigUint64(toc+i*16,true));
    if (Number(header.getBigUint64(toc+i*16+8,true)) !== expected[i] || offset+length>bytes.length) throw new Error('Invalid SPZ size');
    const part = decompress(bytes.subarray(offset,offset+length));
    if (part.length !== expected[i]) throw new Error('Invalid SPZ data');
    parts.push(part); offset += length;
  }
  return new Uint8Array(await new Response(new Blob(parts).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
}

// One active record at a time: closing the dialog releases its GPU resources.
export function createRecordViewer(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setClearColor(0x16221f);
  container.replaceChildren(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(48, 1, 0.01, 1000);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x73877e, 2.5));
  const light = new THREE.DirectionalLight(0xffffff, 2);
  light.position.set(3, 5, 4); scene.add(light);
  let object, spark, disposed = false;
  const startPosition = new THREE.Vector3();
  const target = new THREE.Vector3();
  function resize() {
    if (disposed || !container.clientWidth || !container.clientHeight) return;
    renderer.setSize(container.clientWidth, container.clientHeight);
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
  }
  const observer = new ResizeObserver(resize); observer.observe(container); resize();
  let pendingFrame = Promise.resolve(), rendering = false;
  renderer.setAnimationLoop(() => {
    if (disposed || rendering) return;
    controls.update(); rendering = true;
    pendingFrame = (async () => {
      if (spark) await spark.update({ scene, camera });
      if (!disposed) renderer.render(scene, camera);
    })().catch(error => { if (!disposed) console.warn('3D描画を更新できませんでした', error); })
      .finally(() => { rendering = false; });
  });
  function release(model) {
    if (model instanceof SplatMesh) { model.dispose(); return; }
    model?.traverse(child => {
      child.geometry?.dispose();
      for (const material of child.material ? (Array.isArray(child.material) ? child.material : [child.material]) : []) {
        for (const value of Object.values(material)) if (value?.isTexture) value.dispose();
        material.dispose();
      }
    });
  }
  return {
    async load(url) {
      let bounds;
      if (url.endsWith('.spz')) {
        const fileBytes = await readSpz(url);
        if (disposed) return;
        spark = new SparkRenderer({ renderer, autoUpdate: false }); scene.add(spark);
        const splat = new SplatMesh({ fileBytes, fileName: url, lod: false });
        try { await splat.initialized; } catch (error) { splat.dispose(); throw error; }
        if (disposed) { splat.dispose(); return; }
        object = splat;
        splat.rotation.x = 0;
        splat.updateMatrixWorld(true);
        // The scans include distant background splats. Frame the central 90%
        // without deleting or concealing any scan data.
        const axes = [[],[],[]];
        splat.forEachSplat((index, center) => {
          if (index % 8 === 0) { axes[0].push(center.x); axes[1].push(center.y); axes[2].push(center.z); }
        });
        axes.forEach(axis => axis.sort((a,b)=>a-b));
        bounds = new THREE.Box3(new THREE.Vector3(...axes.map(a=>a[Math.floor(a.length*.05)])), new THREE.Vector3(...axes.map(a=>a[Math.floor(a.length*.95)])));
        if (url.includes('Double_Ring')) {
          // Same framing before/after recovery; don't let the edited scan's
          // remaining background change the apparent size of the monument.
          bounds.set(new THREE.Vector3(-0.41,-1.55,-0.62),new THREE.Vector3(2.21,1.99,0.18));
          if (url.includes('_missing')) bounds.translate(new THREE.Vector3(-1.8,0,0));
        }
      } else {
        const gltf = await new GLTFLoader().loadAsync(url);
        if (disposed) { release(gltf.scene); return; }
        object = gltf.scene;
        bounds = new THREE.Box3().setFromObject(object);
      }
      scene.add(object);
      bounds.getCenter(target);
      const size = bounds.getSize(new THREE.Vector3());
      const radius = Math.max(size.x, size.y, size.z, 0.1) / 2;
      const fov = Math.min(THREE.MathUtils.degToRad(camera.fov), 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect));
      const distance = radius / Math.tan(fov / 2) * 1.15;
      camera.near = Math.max(radius / 1000, 0.001); camera.far = Math.max(distance * 100, 100);
      camera.updateProjectionMatrix();
      startPosition.copy(target).add(new THREE.Vector3(0, radius * 0.25, distance));
      controls.minDistance = radius * 0.12; controls.maxDistance = distance * 4;
      this.reset();
      container.dataset.loaded = 'true';
    },
    reset() { if (disposed) return; camera.position.copy(startPosition); controls.target.copy(target); controls.update(); },
    resize,
    dispose() {
      if (disposed) return;
      disposed = true; observer.disconnect(); renderer.setAnimationLoop(null); controls.dispose();
      // Let the in-flight depth readback/sort finish before terminating its worker.
      pendingFrame.finally(() => { release(object); spark?.dispose(); renderer.dispose(); renderer.forceContextLoss(); });
      container.replaceChildren(); delete container.dataset.loaded;
    }
  };
}
