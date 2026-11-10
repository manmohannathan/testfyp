import { VIEWER_ZOOM } from '../config/viewer.js';
import { createModelHistory } from './model-history.js';
import { MODEL_HISTORY } from '../config/model-history.js';
import { createInteractionEffects } from './interaction-effects.js';
import { loadGLTF } from '../../libs/loader.js';
export function createScene({THREE,$,getSession,getActive,getSelection,reducedMotion,refresh,openPoint,autoNarrate,getLanguage}) {
const effects=createInteractionEffects({THREE,reducedMotion});
const history=createModelHistory({THREE,getSession,disposeModel});
function highlight(entry, index) {
  if (!entry?.model) return;
  entry.floorBands?.forEach((band, i) => {
    band.fill.visible = i === index;
    band.outline.material.opacity = i === index ? 1 : .18;
  });
  const matches = index >= 0 ? entry.parts[index]?.meshes : [];
  entry.model.traverse(node => {
    if (!node.isMesh) return;
    for (const m of [node.material].flat()) {
      if (!m?.emissive) continue;
      m.emissive.copy(m.userData.originalEmissive);
      m.emissiveIntensity = m.userData.originalIntensity;
      if (matches?.includes(node)) {
        m.emissive.setHex(0xc99428);
        m.emissiveIntensity = .5;
      }
    }
  });
  effects.inspect(entry,index);
}

function disposeModel(root) {
  const geometry = new Set(),
    materials = new Set(),
    textures = new Set();
  root?.traverse(n => {
    if (n.geometry) geometry.add(n.geometry);
    for (const m of [n.material].flat()) {
      if (!m) continue;
      materials.add(m);
      for (const v of Object.values(m)) if (v?.isTexture) textures.add(v);
    }
  });
  textures.forEach(t => t.dispose());
  materials.forEach(m => m.dispose());
  geometry.forEach(g => g.dispose());
}

async function prepareModel(entry, s) {
  const {
    scene: model
  } = await loadGLTF(entry.target.model);
  if (getSession() !== s) {
    disposeModel(model);
    return;
  }
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model),
    size = bounds.getSize(new THREE.Vector3()),
    center = bounds.getCenter(new THREE.Vector3());
  if (!Number.isFinite(size.length()) || size.length() === 0) throw Error('Empty landmark model');
  entry.model = model;
  const offset = new THREE.Vector3(center.x, bounds.min.y, center.z);
  entry.modelBox=bounds.clone().translate(offset.clone().negate());
  let towerBounds = null;
  if (entry.target.floorDiscovery) {
    towerBounds = new THREE.Box3();
    model.traverse(node => {
      if (entry.target.floorDiscovery.boundsNames.includes(node.name)) towerBounds.expandByObject(node);
    });
    if (towerBounds.isEmpty()) throw Error('Main tower geometry not found for floor discovery.');
    entry.floorFocus = false;
    entry.towerBox = towerBounds.clone().translate(offset.clone().negate());
    entry.focusLocal = towerBounds.getCenter(new THREE.Vector3()).sub(offset);
    entry.focusSize = towerBounds.getSize(new THREE.Vector3());
  }
  entry.parts = entry.target.points.map(point => {
    if (towerBounds) {
      const step = (towerBounds.max.y - towerBounds.min.y) / entry.target.floorDiscovery.count;
      // The export has continuous facade meshes, not individually surveyed floors.
      // Thirteen equal-height demo bands are explicitly labelled approximate in the UI.
      return {position:new THREE.Vector3(towerBounds.max.x + 1.5, towerBounds.min.y + (point.floor - .5) * step, towerBounds.max.z + .7).sub(offset), meshes:[]};
    }
    const box = new THREE.Box3(),
      meshes = [];
    model.traverse(node => {
      if (point.match.some(prefix => node.name.startsWith(prefix))) {
        box.expandByObject(node);
        node.traverse(child => {
          if (child.isMesh && !meshes.includes(child)) meshes.push(child);
        });
      }
    });
    const pos = (box.isEmpty() ? bounds : box).getCenter(new THREE.Vector3());
    return {
      position: pos.sub(new THREE.Vector3(center.x, bounds.min.y, center.z)),
      meshes
    };
  });
  model.position.set(-center.x, -bounds.min.y, -center.z);
  entry.normalized = new THREE.Group();
  const fit = (s.mode === 'ar' ? entry.target.tabletop.size : VIEWER_ZOOM[entry.target.id]?.previewSize || 1.55) / Math.max(size.x, size.y, size.z);
  entry.normalized.scale.setScalar(fit);
  entry.previewHeight = size.y * fit;
  entry.normalized.add(model);
  if (towerBounds) {
    const step = entry.focusSize.y / entry.target.floorDiscovery.count;
    entry.floorBands = entry.target.points.map((point, i) => {
      const geometry = new THREE.BoxGeometry(entry.focusSize.x + .8, step * .82, entry.focusSize.z + .8);
      const material = new THREE.MeshBasicMaterial({color:0xdba537,transparent:true,opacity:.3,depthWrite:false});
      const fill = new THREE.Mesh(geometry,material);
      fill.position.set(entry.focusLocal.x, towerBounds.min.y - bounds.min.y + (i + .5) * step, entry.focusLocal.z);
      fill.visible = false;
      const outline = new THREE.LineSegments(new THREE.EdgesGeometry(geometry),new THREE.LineBasicMaterial({color:0xbd8e30,transparent:true,opacity:.18,depthWrite:false}));
      outline.position.copy(fill.position);
      entry.normalized.add(fill,outline);
      return {fill,outline};
    });
  }
  entry.revealGroup = new THREE.Group();
  entry.revealGroup.add(entry.normalized);
  entry.user = new THREE.Group();
  entry.user.add(entry.revealGroup);
  // MindAR's marker lies in local XY, with +Z pointing out of the printed face.
  // glTF models stand along +Y. Rotate their ground plane onto the marker plane.
  entry.tabletop = new THREE.Group();
  if (s.mode === 'ar') entry.tabletop.rotation.x = Math.PI / 2;
  entry.tabletop.add(entry.user);
  entry.host.add(entry.tabletop);
  entry.zoom = 1;
  if ($('zoom-level')) $('zoom-level').textContent = '1.0×';
  entry.user.rotation.y = s.mode === 'preview' ? -.3 : THREE.MathUtils.degToRad(entry.target.tabletop.yawDegrees);
  entry.user.visible = getActive() === entry;
  // The normalized model's lowest point is y=0: its base stays on the map.
  model.traverse(node => {
    if (!node.isMesh) return;
    for (const material of [node.material].flat()) {
      if (material.emissive) {
        material.userData.originalEmissive = material.emissive.clone();
        material.userData.originalIntensity = material.emissiveIntensity;
      }
    }
  });
  for (let i = 0; i < entry.parts.length; i++) {
    const p = new THREE.Object3D();
    p.position.copy(entry.parts[i].position);
    entry.normalized.add(p);
    entry.parts[i].anchor = p;
    const b = document.createElement('button');
    b.className = 'hotspot';
    if (entry.target.floorDiscovery) b.classList.add('floor-hotspot');
    b.type = 'button';
    b.hidden = true;
    b.textContent = i + 1;
    b.addEventListener('click', () => {
      if (getActive() !== entry) return;
      openPoint(i);
    });
    $('hotspots').appendChild(b);
    entry.buttons.push(b);
  }
  effects.prepare(entry);
  entry.featureLabel=document.createElement('div');entry.featureLabel.className='feature-label';entry.featureLabel.hidden=true;$('hotspots').append(entry.featureLabel);
  if (entry.tracked || s.mode === 'preview' && getActive() === entry) reveal(entry);
  refresh();
  if (getActive() === entry) resize(s);
}

function reveal(entry) {
  if (!entry?.model) return;
  entry.revealed = true;
  entry.revealStart = performance.now();
  entry.animating = !reducedMotion.matches;
  entry.revealGroup.scale.setScalar(entry.animating ? .02 : 1);
  entry.revealGroup.position.y = 0;
  autoNarrate(entry);
}

// Scene rendering and gestures

function updateScene(s, now) {
  for (const e of s.entries) {
    if (!e.model) continue;
    effects.tick(e,now,s.camera,e.host.visible&&(s.mode==='preview'||e.tracked));
    if (e.animating) {
      const t = Math.min(1, (now - e.revealStart) / 1300),
        ease = 1 - Math.pow(1 - t, 3);
      e.revealGroup.scale.setScalar(.02 + .98 * ease);
      e.revealGroup.position.y = 0;
      if (t === 1) { e.animating = false; autoNarrate(e); }
    }
  }
  s.scene.updateMatrixWorld(true);
  if (s.mode === 'preview' && getActive()?.floorFocus && getActive().focusLocal) {
    const focus=getActive().focusLocal.clone();
    const spread=getActive().fx?.mode==='floors'?getActive().fx.spread*1.5:0;
    focus.y+=getActive().focusSize.y/13*6*spread;
    const target = getActive().normalized.localToWorld(focus);
    const scale = getActive().normalized.getWorldScale(new THREE.Vector3()).x;
    const size = getActive().focusSize.clone().multiplyScalar(scale / getActive().zoom);
    size.y*=1+spread;
    const tangent = Math.tan(THREE.MathUtils.degToRad(s.camera.fov / 2));
    const distance = Math.max(size.y * .68 / tangent, size.x * .7 / tangent / s.camera.aspect) + size.z;
    s.camera.position.set(target.x, target.y + size.y * .08, target.z + distance);
    s.camera.lookAt(target);
  }
  s.camera.updateMatrixWorld(true);
  const rect = s.renderer.domElement.getBoundingClientRect(),
    stage = $('stage').getBoundingClientRect();
  // Keep projected taps outside fixed controls. The floor directory stays available.
  const occupied = [...$('stage').querySelectorAll('.view-tools,.interaction-hud,.stage-status,.scan-distance')]
    .filter(el => !el.hidden && getComputedStyle(el).visibility !== 'hidden' && getComputedStyle(el).display !== 'none')
    .map(el => { const r=el.getBoundingClientRect();return {left:r.left-stage.left,top:r.top-stage.top,right:r.right-stage.left,bottom:r.bottom-stage.top}; });
  const blocked = (x,y) => occupied.some(r=>x>=r.left-15&&x<=r.right+15&&y>=r.top-15&&y<=r.bottom+15);
  for (const e of s.entries) {
    const visible = e === getActive() && !!e.user?.visible && e.host.visible && (s.mode === 'preview' || e.tracked) && !e.animating;
    if(e.featureLabel){
      const f=e.fx,language=getLanguage(),text=v=>typeof v==='string'?v:v?.[language]||v?.en||'';
      const point=f?.mode==='route'?f.visitor.position.clone():f?.selected>=0?e.parts[f.selected].anchor.position.clone():e.modelBox.getCenter(new THREE.Vector3()).setY(e.modelBox.max.y);
      const label=e.history?.active?(e.history.status==='ready'?text(MODEL_HISTORY[e.target.id][e.history.key].label):''):f?.selected>=0?text(e.target.points[f.selected].title):text(f?.label);
      const v=e.normalized.localToWorld(point).project(s.camera);
      e.featureLabel.hidden=!visible||!label||v.z < -1||v.z>1;
      if(!e.featureLabel.hidden){
        e.featureLabel.textContent=label;
        const x=Math.max(98,Math.min(stage.width-98,(v.x+1)*rect.width/2+rect.left-stage.left));
        let y=Math.max(55,Math.min(stage.height-90,(1-v.y)*rect.height/2+rect.top-stage.top-38));
        for(const r of occupied)if(x+90>r.left&&x-90<r.right&&y>r.top&&y-50<r.bottom)y=r.bottom+58;
        e.featureLabel.style.left=x+'px';e.featureLabel.style.top=Math.min(stage.height-75,y)+'px';
      }
    }
    const placed = [];
    e.parts?.forEach((p, i) => {
      const b = e.buttons[i];
      // The floor picker exposes every level without 13 overlapping touch targets.
      if (!visible || e.history?.active) {
        b.hidden = true;
        return;
      }
      const v = p.anchor.getWorldPosition(new THREE.Vector3()).project(s.camera);
      let x = (v.x + 1) * rect.width / 2 + rect.left - stage.left,
        y = (1 - v.y) * rect.height / 2 + rect.top - stage.top;
      const behind = v.z < -1 || v.z > 1;
      if (behind || x < 22 || x > stage.width - 22 || y < 44 || y > stage.height - 60) {
        b.hidden = true;
        return;
      }
      // Separate nearby touch targets; the discovery list remains an alternative.
      if (e.target.floorDiscovery) {
        if(blocked(x,y)){b.hidden=true;return;}
        b.hidden = false; b.style.left = x + 'px'; b.style.top = y + 'px';
        const neighbor = e.parts[i === 12 ? 11 : i + 1].anchor.getWorldPosition(new THREE.Vector3()).project(s.camera);
        const gap = Math.hypot((v.x-neighbor.x)*rect.width/2,(v.y-neighbor.y)*rect.height/2);
        b.classList.toggle('compact-dot', gap < 26);
        // Small dots stay at their true projected floor height; the 44px rail is the accessible alternative.
        b.style.setProperty('--dot-hit', Math.max(8,Math.min(28,gap*.9))+'px');
        return;
      }
      const candidates = [[x, y], [x + 52, y], [x - 52, y], [x, y - 52], [x, y + 52]];
      const free = candidates.find(([cx, cy]) => cx >= 22 && cx <= stage.width - 22 && cy >= 44 && cy <= stage.height - 60 && !blocked(cx,cy) && placed.every(old => Math.hypot(cx - old.x, cy - old.y) >= 48));
      b.hidden = !free;
      if (free) {
        [x, y] = free;
        b.style.left = x + 'px';
        b.style.top = y + 'px';
        placed.push({
          x,
          y
        });
      }
    });
  }
  s.renderer.render(s.scene, s.camera);
}

function zoom(value) {
  if (!getActive()?.user) return;
  if (!Number.isFinite(value)) return;
  const limits = VIEWER_ZOOM[getActive().target.id] || {min:.55,max:2.3};
  getActive().zoom = Math.min(limits.max, Math.max(limits.min, value));
  getActive().user.scale.setScalar(getActive().zoom);
  const readout = $('zoom-level');
  if (readout) readout.textContent = getActive().zoom.toFixed(1) + '×';
}

function attachGestures(s) {
  const surface = s.renderer.domElement,
    pointers = new Map();
  let lastDistance = 0, tap = null;
  const raycaster = new THREE.Raycaster();
  const point = e => ({
    x: e.clientX,
    y: e.clientY
  });
  const distance = () => {
    const a = [...pointers.values()];
    return a.length < 2 ? 0 : Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
  };
  surface.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (!getActive()?.user || s.mode === 'ar' && !getActive().tracked) return;
    surface.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, point(e));
    tap = pointers.size === 1 ? { x:e.clientX, y:e.clientY, id:e.pointerId, entry:getActive() } : null;
    lastDistance = distance();
  });
  surface.addEventListener('pointermove', e => {
    if (!pointers.has(e.pointerId) || !getActive()?.user) return;
    if (tap && Math.hypot(e.clientX-tap.x,e.clientY-tap.y)>7) tap=null;
    const prev = pointers.get(e.pointerId);
    pointers.set(e.pointerId, point(e));
    if (pointers.size >= 2) {
      const d = distance();
      if (lastDistance > 0) zoom(getActive().zoom * d / lastDistance);
      lastDistance = d;
    } else {
      const delta=(e.clientX - prev.x)*.009;getActive().user.rotation.y+=delta;
    }
  });
  const release = e => {
    tap=null; pointers.delete(e.pointerId);
    lastDistance = distance();
  };
  surface.addEventListener('pointerup', e => {
    const entry=getActive();
    if (!entry?.history?.active && tap && tap.id===e.pointerId && tap.entry===entry && !entry.animating && (s.mode==='preview'||entry.tracked)) {
      const rect=surface.getBoundingClientRect();
      raycaster.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,1-(e.clientY-rect.top)/rect.height*2),s.camera);
      const isStudy=entry.fx?.mode==='floors';
      const hit=isStudy?raycaster.intersectObjects(entry.fx.slabs,false)[0]:raycaster.intersectObject(entry.model,true)[0];
      if(hit){
        let index=-1;
        if(isStudy)index=hit.object.userData.floorIndex;
        else if(entry.towerBox){
          const local=entry.normalized.worldToLocal(hit.point.clone()),box=entry.towerBox;
          // Glazing and facade trim sit just outside the structural shaft bounds.
          const facade = /^(Tower|Stepped tower)/i.test(hit.object.name);
          if((facade || (local.x>=box.min.x-.8&&local.x<=box.max.x+.8&&local.z>=box.min.z-.8&&local.z<=box.max.z+.8))&&local.y>=box.min.y&&local.y<=box.max.y){
            index=Math.min(12,Math.floor((local.y-box.min.y)/(box.max.y-box.min.y)*13));
          }
        }else index=entry.parts.findIndex(part=>part.meshes.includes(hit.object));
        if(index>=0){navigator.vibrate?.(15);openPoint(index);}
      }
    }
    tap=null;release(e);
  });
  surface.addEventListener('pointercancel', release);
  surface.addEventListener('lostpointercapture', release);
  surface.addEventListener('wheel', e => {
    if (!getActive()?.model) return;
    e.preventDefault();
    zoom(getActive().zoom * Math.exp(-e.deltaY * .001));
  }, {
    passive: false
  });
  // Model getSelection() is handled by explicit landmark buttons, so a drag never opens a card.
  s.clearPointers = () => {
    tap=null; pointers.clear();
    lastDistance = 0;
  };
}

function resize(s) {
  if (getSession() !== s) return;
  const width = $('stage').clientWidth,
    height = $('stage').clientHeight;
  if (!width || !height) return;
  if (s.mode === 'preview') {
    s.renderer.setSize(width, height);
    s.camera.aspect = width / height;
    const distance = Math.max(3.4, .95 / Math.tan(THREE.MathUtils.degToRad(s.camera.fov / 2)) / s.camera.aspect);
    const centerY = (getActive()?.previewHeight || 1.4) / 2;
    s.camera.position.set(0, centerY + 1.1, distance);
    s.camera.lookAt(0, centerY, 0);
    s.camera.updateProjectionMatrix();
  } else if (s.mind.controller && s.mind.video?.videoWidth) s.mind.resize();
}

function setEffect(mode,data){
  const e=getActive();if(!e)return;history.reset(e);effects.setMode(e,mode,data);
  if(mode==='inspect')highlight(e,data?.index??0);
  if(mode==='timeline')history.show(e,data?.key||'then');
  refresh();
}
function clearEffect(){for(const e of getSession()?.entries||[]){history.reset(e);effects.reset(e);highlight(e,-1);if(e.floorFocus)e.floorFocus=false;}refresh();}
return {disposeModel,prepareModel,reveal,highlight,updateScene,zoom,attachGestures,resize,setEffect,clearEffect};
}
