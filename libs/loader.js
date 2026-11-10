// Lightweight glTF loader for the Three.js build bundled inside MindAR.
// This avoids requiring an extra three.js-r132 download on Netlify.
const THREE = window.MINDAR.IMAGE.THREE;

const TYPE_SIZE = {
  SCALAR: 1,
  VEC2: 2,
  VEC3: 3,
  VEC4: 4,
  MAT2: 4,
  MAT3: 9,
  MAT4: 16
};

const COMPONENT = {
  5120: Int8Array,
  5121: Uint8Array,
  5122: Int16Array,
  5123: Uint16Array,
  5125: Uint32Array,
  5126: Float32Array
};

const componentBytes = (componentType) => {
  const C = COMPONENT[componentType];
  return C ? C.BYTES_PER_ELEMENT : 0;
};

const readAccessor = (gltf, buffers, accessorIndex) => {
  const accessor = gltf.accessors[accessorIndex];
  const count = accessor.count;
  const components = TYPE_SIZE[accessor.type];
  const Ctor = COMPONENT[accessor.componentType];
  if (!Ctor || !components) throw new Error(`Unsupported glTF accessor: ${accessorIndex}`);

  const output = new Ctor(count * components);

  if (accessor.bufferView === undefined) {
    return { array: output, components, normalized: !!accessor.normalized };
  }

  const view = gltf.bufferViews[accessor.bufferView];
  const buffer = buffers[view.buffer];
  const stride = view.byteStride || components * Ctor.BYTES_PER_ELEMENT;
  const baseOffset = (view.byteOffset || 0) + (accessor.byteOffset || 0);
  const bytesPerElement = Ctor.BYTES_PER_ELEMENT;

  if (stride === components * bytesPerElement) {
    const source = new Ctor(buffer, baseOffset, count * components);
    output.set(source);
  } else {
    const sourceBytes = new Uint8Array(buffer);
    const targetBytes = new Uint8Array(output.buffer);
    const itemBytes = components * bytesPerElement;
    for (let i = 0; i < count; i++) {
      const start = baseOffset + i * stride;
      targetBytes.set(sourceBytes.subarray(start, start + itemBytes), i * itemBytes);
    }
  }

  return { array: output, components, normalized: !!accessor.normalized };
};

const loadImageTexture = (uri, baseUrl) => new Promise((resolve, reject) => {
  const loader = new THREE.TextureLoader();
  const url = new URL(uri, baseUrl).href;
  loader.load(url, texture => {
    texture.flipY = false;
    texture.needsUpdate = true;
    resolve(texture);
  }, undefined, reject);
});

const createMaterial = (gltf, materialIndex, textures) => {
  const def = (gltf.materials && gltf.materials[materialIndex]) || {};
  const pbr = def.pbrMetallicRoughness || {};
  const material = new THREE.MeshStandardMaterial({
    color: pbr.baseColorFactor ? new THREE.Color(
      pbr.baseColorFactor[0] || 0,
      pbr.baseColorFactor[1] || 0,
      pbr.baseColorFactor[2] || 0
    ) : 0xffffff,
    metalness: pbr.metallicFactor !== undefined ? pbr.metallicFactor : 0,
    roughness: pbr.roughnessFactor !== undefined ? pbr.roughnessFactor : 1,
    side: def.doubleSided ? THREE.DoubleSide : THREE.FrontSide,
    transparent: def.alphaMode === 'BLEND',
    opacity: pbr.baseColorFactor ? (pbr.baseColorFactor[3] !== undefined ? pbr.baseColorFactor[3] : 1) : 1
  });

  if (pbr.baseColorTexture) {
    material.map = textures[pbr.baseColorTexture.index] || null;
    material.needsUpdate = true;
  }
  return material;
};

const applyNodeTransform = (object, node) => {
  if (node.matrix) {
    object.applyMatrix4(new THREE.Matrix4().fromArray(node.matrix));
    return;
  }
  if (node.translation) object.position.fromArray(node.translation);
  if (node.rotation) object.quaternion.fromArray(node.rotation);
  if (node.scale) object.scale.fromArray(node.scale);
};

export const loadGLTF = async (path) => {
  const baseUrl = new URL(path, window.location.href);
  baseUrl.pathname = baseUrl.pathname.substring(0, baseUrl.pathname.lastIndexOf('/') + 1);

  const response = await fetch(path);
  if (!response.ok) throw new Error(`Unable to load glTF (${response.status}): ${path}`);
  const gltf = await response.json();

  const buffers = [];
  for (const bufferDef of gltf.buffers || []) {
    const bufferUrl = new URL(bufferDef.uri, baseUrl).href;
    const res = await fetch(bufferUrl);
    if (!res.ok) throw new Error(`Unable to load glTF buffer (${res.status}): ${bufferDef.uri}`);
    buffers.push(await res.arrayBuffer());
  }

  const textures = [];
  for (const texDef of gltf.textures || []) {
    const imageDef = gltf.images[texDef.source];
    if (imageDef && imageDef.uri) {
      textures.push(await loadImageTexture(imageDef.uri, baseUrl));
    } else {
      textures.push(null);
    }
  }

  const meshes = [];
  for (const meshDef of gltf.meshes || []) {
    const group = new THREE.Group();
    group.name = meshDef.name || '';

    for (const primitive of meshDef.primitives || []) {
      const geometry = new THREE.BufferGeometry();

      for (const [semantic, accessorIndex] of Object.entries(primitive.attributes || {})) {
        const data = readAccessor(gltf, buffers, accessorIndex);
        const attributeName = {
          POSITION: 'position',
          NORMAL: 'normal',
          TANGENT: 'tangent',
          TEXCOORD_0: 'uv',
          TEXCOORD_1: 'uv1',
          COLOR_0: 'color'
        }[semantic];
        if (attributeName) {
          geometry.setAttribute(attributeName, new THREE.BufferAttribute(data.array, data.components, data.normalized));
        }
      }

      if (primitive.indices !== undefined) {
        const indices = readAccessor(gltf, buffers, primitive.indices);
        geometry.setIndex(new THREE.BufferAttribute(indices.array, 1, false));
      }

      geometry.computeBoundingSphere();
      if (!geometry.getAttribute('normal')) geometry.computeVertexNormals();

      const material = createMaterial(gltf, primitive.material, textures);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = meshDef.name || '';
      group.add(mesh);
    }
    meshes.push(group);
  }

  const nodes = [];
  for (const nodeDef of gltf.nodes || []) {
    const object = new THREE.Group();
    object.name = nodeDef.name || '';
    applyNodeTransform(object, nodeDef);
    if (nodeDef.mesh !== undefined) object.add(meshes[nodeDef.mesh].clone(true));
    nodes.push(object);
  }

  for (let i = 0; i < (gltf.nodes || []).length; i++) {
    for (const child of gltf.nodes[i].children || []) nodes[i].add(nodes[child]);
  }

  const scene = new THREE.Group();
  const sceneDef = (gltf.scenes || [])[gltf.scene || 0];
  for (const nodeIndex of (sceneDef && sceneDef.nodes) || []) scene.add(nodes[nodeIndex]);

  scene.traverse(node => { if (node.isMesh) node.material = node.material.clone(); });

  return { scene, scenes: [scene], parser: null, asset: gltf.asset || {} };
};

export const loadAudio = (path) => new Promise((resolve, reject) => {
  const loader = new THREE.AudioLoader();
  loader.load(path, resolve, undefined, reject);
});

export const loadVideo = (path) => new Promise((resolve) => {
  const video = document.createElement('video');
  video.addEventListener('loadedmetadata', () => {
    video.setAttribute('playsinline', '');
    resolve(video);
  });
  video.src = path;
});

export const loadTexture = (path) => new Promise((resolve, reject) => {
  new THREE.TextureLoader().load(path, resolve, undefined, reject);
});

export const loadTextures = (paths) => Promise.all(paths.map(loadTexture));
