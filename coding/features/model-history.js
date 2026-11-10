import { loadGLTF } from '../../libs/loader.js';
import { MODEL_HISTORY, historyReady } from '../config/model-history.js';

// The two eras share one marker and the user's rotation/zoom. Assets load on demand.
export function createModelHistory({THREE, getSession, disposeModel}) {
  function state(entry) {
    return entry.history ||= {token:0, active:false, key:null, status:'idle', cache:new Map()};
  }
  function reset(entry) {
    const h=entry?.history;if(!h)return;
    h.token++;h.active=false;h.key=null;h.status='idle';
    h.cache.forEach(root=>root.visible=false);
    if(entry.model)entry.model.visible=true;
    entry.floorBands?.forEach(b=>{b.fill.visible=false;b.outline.visible=true;});
  }
  async function show(entry,key) {
    const config=MODEL_HISTORY[entry.target.id];
    if(!historyReady(config)||!['then','now'].includes(key))return false;
    const s=getSession(),h=state(entry),token=++h.token,version=config[key];
    h.active=true;h.key=key;h.status='loading';
    entry.model.visible=false;entry.floorFocus=false;
    entry.floorBands?.forEach(b=>{b.fill.visible=false;b.outline.visible=false;});
    h.cache.forEach(root=>root.visible=false);
    try {
      let root=h.cache.get(key);
      if(!root){
        const {scene:model}=await loadGLTF(version.model);
        if(getSession()!==s||s.closed||token!==h.token){disposeModel(model);return false;}
        root=new THREE.Group();root.add(model);
        const rotation=version.rotation||[0,0,0];
        model.rotation.set(...rotation.map(THREE.MathUtils.degToRad));
        model.scale.setScalar(Number.isFinite(version.scale)&&version.scale>0?version.scale:1);
        root.updateMatrixWorld(true);
        const box=new THREE.Box3().setFromObject(root),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
        if(box.isEmpty()||!Number.isFinite(size.length())||size.length()===0){disposeModel(root);throw Error('Empty era model');}
        // Keep original units and shared scale; never resize each era independently.
        model.position.sub(new THREE.Vector3(center.x,box.min.y,center.z));
        root.visible=false;entry.normalized.add(root);h.cache.set(key,root);
      }
      if(token!==h.token||getSession()!==s)return false;
      root.visible=true;h.status='ready';return true;
    } catch(error) {
      if(token===h.token&&getSession()===s){h.status='error';console.error('Era model failed:',entry.target.id,key,error);}
      return false;
    }
  }
  return {show,reset};
}
