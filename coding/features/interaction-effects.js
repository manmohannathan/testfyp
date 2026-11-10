import { INTERACTIVE } from '../content/interactive.js';

// All additions are small procedural geometry. Original model geometry is reused unchanged.
export function createInteractionEffects({THREE,reducedMotion}) {
  const removeChildren = group => {
    for(const child of [...group.children]) {child.traverse(n=>{n.geometry?.dispose();for(const m of [n.material].flat())m?.dispose();});group.remove(child);}
  };
  function prepare(e) {
    if(e.fx)return;
    const root=new THREE.Group();e.normalized.add(root);
    const materials=[];e.model.traverse(n=>{if(n.isMesh)for(const m of [n.material].flat())materials.push({node:n,m,opacity:m.opacity,transparent:m.transparent,depthWrite:m.depthWrite});});
    const unit=e.modelBox.getSize(new THREE.Vector3()).length();
    const cue=new THREE.Group();const ring=new THREE.Mesh(new THREE.RingGeometry(unit*.014,unit*.018,28),new THREE.MeshBasicMaterial({color:0xe8b24d,side:THREE.DoubleSide,depthTest:false,transparent:true}));cue.add(ring);cue.renderOrder=10;cue.visible=false;root.add(cue);
    const hand=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-unit*.006,0,.01),new THREE.Vector3(),new THREE.Vector3(0,unit*.012,.01)]),new THREE.LineBasicMaterial({color:0xffffff,depthTest:false}));cue.add(hand);hand.visible=false;
    const route=new THREE.Group();root.add(route);
    e.fx={root,materials,unit,cue,ring,hand,route,mode:null,selected:-1,spread:0,progress:0,playing:false,last:0,routeIndex:0,arrived:false,routePoints:[],label:''};
  }
  function restoreMaterials(e){for(const {m,opacity,transparent,depthWrite} of e.fx.materials){m.opacity=opacity;m.transparent=transparent;m.depthWrite=depthWrite;}}
  function reset(e){
    if(!e?.fx)return;
    const f=e.fx;restoreMaterials(e);e.model.visible=true;f.mode=null;f.selected=-1;f.label='';f.cue.visible=false;f.route.visible=false;f.playing=false;f.spread=0;
    if(f.floors)f.floors.visible=false;
    e.parts.forEach(p=>p.anchor.position.copy(p.position));
    e.floorBands?.forEach(b=>{b.fill.visible=false;b.outline.visible=true;});
  }
  function inspect(e,index){
    if(!e?.model)return;prepare(e);const f=e.fx;f.selected=index;
    if(index<0){f.cue.visible=false;if(f.mode==='inspect')restoreMaterials(e);return;}
    const matches=e.parts[index]?.meshes||[];
    if(f.mode==='inspect'&&!e.towerBox){for(const item of f.materials){const dim=!matches.includes(item.node);item.m.opacity=item.opacity*(dim?.22:1);item.m.transparent=dim||item.transparent;item.m.depthWrite=dim?false:item.depthWrite;}}
    f.cue.visible=true;f.hand.visible=e.target.id==='labuanclocktower'&&index===0;f.cue.position.copy(e.parts[index].anchor.position);
  }
  function floors(e){
    const f=e.fx;if(f.floors)return;
    const group=new THREE.Group(),b=e.towerBox,size=b.getSize(new THREE.Vector3()),step=size.y/13;
    f.slabs=[];
    for(let i=0;i<13;i++){
      const mesh=new THREE.Mesh(new THREE.BoxGeometry(size.x,step*.65,size.z),new THREE.MeshStandardMaterial({color:i%2?0xe6e9d9:0x528575,roughness:.8}));
      mesh.userData.floorIndex=i;mesh.position.set((b.min.x+b.max.x)/2,b.min.y+(i+.5)*step,(b.min.z+b.max.z)/2);
      const outline=new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry),new THREE.LineBasicMaterial({color:0x244a3a}));mesh.add(outline);group.add(mesh);f.slabs.push(mesh);
    }
    f.floors=group;f.root.add(group);
  }
  function route(e,index){
    const f=e.fx;removeChildren(f.route);f.route.visible=true;f.routeIndex=index;f.progress=0;f.playing=!reducedMotion.matches;f.arrived=false;
    const definition=INTERACTIVE[e.target.id].routes[index];f.label=definition.name;const box=e.modelBox,size=box.getSize(new THREE.Vector3());let destination;
    if(definition.point!==undefined)destination=e.parts[definition.point].position.clone();
    else {
      const bounds=new THREE.Box3();e.model.traverse(n=>{if(definition.match.some(prefix=>n.name.startsWith(prefix)))bounds.expandByObject(n);});
      destination=bounds.isEmpty()?box.getCenter(new THREE.Vector3()):e.normalized.worldToLocal(bounds.getCenter(new THREE.Vector3()));
    }
    // A teaching overlay only: these paths do not assert walkable surveyed routes.
    const y=box.min.y+Math.max(.3,size.y*.015);destination.y=y;
    const start=new THREE.Vector3(box.min.x+size.x*.12,y,box.max.z-size.z*.05);
    f.routePoints=[start,new THREE.Vector3(start.x,y,start.z-size.z*.18),new THREE.Vector3(destination.x,y,start.z-size.z*.18),destination];
    const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(f.routePoints),new THREE.LineDashedMaterial({color:0xffb53b,dashSize:f.unit*.012,gapSize:f.unit*.007,depthTest:false}));line.computeLineDistances();line.renderOrder=9;f.route.add(line);
    const visitor=new THREE.Group(),radius=f.unit*.009;
    const head=new THREE.Mesh(new THREE.SphereGeometry(radius,10,8),new THREE.MeshBasicMaterial({color:0xffca6b,depthTest:false}));head.position.y=radius*3;
    const body=new THREE.Mesh(new THREE.CylinderGeometry(radius*.7,radius,radius*2,8),new THREE.MeshBasicMaterial({color:0x245d47,depthTest:false}));body.position.y=radius*1.3;
    visitor.add(body,head);visitor.position.copy(start);f.route.add(visitor);f.visitor=visitor;
    const stop=new THREE.Mesh(new THREE.RingGeometry(radius*1.6,radius*2.3,24),new THREE.MeshBasicMaterial({color:0xffb53b,side:THREE.DoubleSide,depthTest:false}));stop.rotation.x=-Math.PI/2;stop.position.copy(destination);f.route.add(stop);
    f.lengths=f.routePoints.slice(1).map((p,i)=>p.distanceTo(f.routePoints[i]));f.length=f.lengths.reduce((a,b)=>a+b,0)||1;
  }
  function setMode(e,mode,data={}){
    if(!e?.model)return;prepare(e);reset(e);const f=e.fx;f.mode=mode;
    if(mode==='inspect')inspect(e,data.index??0);
    if(mode==='route')route(e,data.index||0);
    if(mode==='floors'&&e.towerBox){floors(e);f.floors.visible=true;e.model.visible=false;f.spread=data.spread??.35;}
  }
  function tick(e,now,camera,visible){
    if(!e.fx)return;const f=e.fx,dt=f.last?Math.min(.1,(now-f.last)/1000):0;f.last=now;
    if(f.mode==='floors'){
      const step=e.focusSize.y/13;
      f.slabs.forEach((mesh,i)=>{
        mesh.position.y=e.towerBox.min.y+(i+.5)*step+i*step*f.spread*1.5;
        mesh.material.emissive.setHex(i===f.selected?0xc28c27:0x000000);mesh.material.emissiveIntensity=.6;
        e.parts[i].anchor.position.set(e.parts[i].position.x,mesh.position.y,e.parts[i].position.z);
      });
      e.floorBands.forEach(b=>{b.fill.visible=false;b.outline.visible=false;});
    }
    if(f.selected>=0&&visible){
      f.cue.position.copy(e.parts[f.selected].anchor.position);
      f.cue.quaternion.copy(e.normalized.getWorldQuaternion(new THREE.Quaternion()).invert()).multiply(camera.getWorldQuaternion(new THREE.Quaternion()));
      const pulse=reducedMotion.matches?1:1+Math.sin(now*.004)*.15;f.ring.scale.setScalar(pulse);f.hand.rotation.z=reducedMotion.matches?0:-now*.001;
      if(e.floorBands&&f.mode!=='floors')e.floorBands[f.selected].fill.material.opacity=.22+(reducedMotion.matches?.08:(Math.sin(now*.004)+1)*.07);
    }
    if(f.mode==='route'){
      if(visible&&!document.hidden&&f.playing)f.progress=Math.min(1,f.progress+dt/9);
      let distance=f.progress*f.length,segment=0;
      while(segment<f.lengths.length-1&&distance>f.lengths[segment])distance-=f.lengths[segment++];
      f.visitor.position.copy(f.routePoints[segment]).lerp(f.routePoints[segment+1],Math.min(1,distance/(f.lengths[segment]||1)));
      if(f.progress===1){f.playing=false;f.arrived=true;}
    }
  }
  return {prepare,reset,inspect,setMode,tick};
}
