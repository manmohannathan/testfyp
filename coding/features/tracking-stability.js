import { TRACKING as config } from '../config/tracking.js';

// MindAR owns the raw anchor and projection. Only the visible model pose is filtered.
// Never change camera FOV, marker rotation, or the model's ground-plane offset here.
export function createStableAnchor(THREE,scene,anchor) {
  const host=new THREE.Group();host.matrixAutoUpdate=false;host.visible=false;scene.add(host);
  const p=new THREE.Vector3(),q=new THREE.Quaternion(),scale=new THREE.Vector3();
  const rawP=new THREE.Vector3(),rawQ=new THREE.Quaternion(),rawS=new THREE.Vector3();
  const pendingP=new THREE.Vector3(),pendingQ=new THREE.Quaternion();
  const previousRaw=new THREE.Matrix4();
  let initialized=false,readyAt=0,last=0,pending=false,hasRaw=false,previousObject=null;
  function reset(){initialized=false;hasRaw=false;previousObject=null;pending=false;last=0;host.visible=false;}
  function tick(now,tracked) {
    if(!tracked||!anchor.group.visible){reset();return;}
    const matrix=anchor.group.matrix;
    if(!matrix.elements.every(Number.isFinite)||Math.abs(matrix.determinant())<1e-12){reset();return;}
    matrix.decompose(rawP,rawQ,rawS);
    rawQ.normalize();
    if(rawS.x<=0||rawS.y<=0||rawS.z<=0){reset();return;}
    const fresh=!hasRaw||matrix!==previousObject||!matrix.equals(previousRaw);
    if(fresh){previousRaw.copy(matrix);previousObject=matrix;hasRaw=true;}
    const unit=Math.max(1e-6,Math.abs(rawS.x));
    const distance=initialized?p.distanceTo(rawP)/unit:0,angle=initialized?q.angleTo(rawQ):0;
    if(initialized&&(distance>config.jumpWidths||angle>config.jumpRadians)){
      // Reject an isolated bad pose. Two distinct, consistent estimates confirm a move.
      if(!fresh||!pending||pendingP.distanceTo(rawP)/unit>config.confirmWidths||pendingQ.angleTo(rawQ)>config.confirmRadians){
        if(fresh){pendingP.copy(rawP);pendingQ.copy(rawQ);pending=true;}
        host.visible=false;last=now;return;
      }
      initialized=false;
    }
    pending=false;
    if(!initialized){
      p.copy(rawP);q.copy(rawQ);scale.copy(rawS);readyAt=now+config.acquireMs;initialized=true;
    }else{
      const dt=Math.max(0,Math.min(.05,(now-last)/1000));
      const motion=Math.min(1,Math.max(distance*5,angle*2));
      const blend=1-Math.exp(-(config.baseResponse+config.motionResponse*motion)*dt);
      p.lerp(rawP,blend);q.slerp(rawQ,blend);scale.copy(rawS);
    }
    last=now;host.matrix.compose(p,q,scale);host.matrixWorldNeedsUpdate=true;host.visible=now>=readyAt;
  }
  return {host,tick,reset};
}

export function framingHint(THREE,entry,camera,stage) {
  if(!entry?.tracked||!entry.anchor?.group.visible)return 'scan';
  // These final markers are square. Perspective projection gives framing, not physical distance.
  const corners=[[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]].map(([x,y])=>new THREE.Vector3(x,y,0).applyMatrix4(entry.anchor.group.matrix).project(camera));
  if(corners.some(p=>!Number.isFinite(p.x)||p.z<-1||p.z>1))return 'scan';
  const xs=corners.map(p=>(p.x+1)*stage.clientWidth/2),ys=corners.map(p=>(1-p.y)*stage.clientHeight/2);
  const w=(Math.max(...xs)-Math.min(...xs))/stage.clientWidth,h=(Math.max(...ys)-Math.min(...ys))/stage.clientHeight;
  if(Math.min(...xs)<10||Math.max(...xs)>stage.clientWidth-10||Math.min(...ys)<10||Math.max(...ys)>stage.clientHeight-10||Math.max(w,h)>.85)return 'back';
  if(Math.max(w,h)<.25)return 'closer';
  return entry.stability?.host.visible?'steady':'settling';
}
