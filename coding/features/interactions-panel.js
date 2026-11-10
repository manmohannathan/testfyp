import { MODEL_HISTORY, historyReady } from '../config/model-history.js';
import { INTERACTIVE } from '../content/interactive.js';

export function createInteractions({container,stage,getActive,getSession,getLanguage,onOpen,setEffect,clearEffect,openPoint,onInfo,resize}) {
  const node=(tag,cls='',text='')=>{const n=document.createElement(tag);n.className=cls;n.textContent=text;return n;};
  const word=(en,ms)=>getLanguage()==='ms'?ms:en;
  const text=v=>typeof v==='string'?v:v?.[getLanguage()]||v?.en||'';
  const action=(label,fn,cls='')=>{const b=node('button',cls,label);b.type='button';b.addEventListener('click',fn);return b;};
  const launch=action('Interact',()=>open());launch.id='interact-btn';document.querySelector('.action-grid').append(launch);
  const panel=node('section','interactions-panel');panel.id='interactions-panel';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-labelledby','interactions-title');
  const head=node('header','interactions-header'),title=node('h2','','Interactive studio');title.id='interactions-title';const dismiss=action('×',()=>close(true),'quiet');
  head.append(title,dismiss);const tabs=node('nav','interaction-tabs');tabs.setAttribute('aria-label','Interaction modes');const viewScene=action('View scene ↗',()=>close(false),'interaction-view');const body=node('div','interaction-content');panel.append(head,tabs,viewScene,body);container.append(panel);
  const hud=node('div','interaction-hud');hud.hidden=true;const hudText=action('',()=>{onOpen();panel.hidden=false;launch.setAttribute('aria-expanded','true');render();},'interaction-hud-open');const stop=action('×',()=>close(true));hud.append(hudText,stop);stage.append(hud);
  const flip=action('⇄',()=>{const next=getActive()?.history?.key==='then'?'now':'then';setEffect('timeline',{key:next});if(!panel.hidden)render();});flip.id='era-switch';flip.hidden=true;hud.insertBefore(flip,stop);
  let mode=null,key='';
  const names=()=>({inspect:word('Inspect','Periksa'),timeline:word('Then & now','Dulu & kini'),route:word('Visitor route','Laluan lawatan'),floors:word('Open building','Buka bangunan')});
  function close(reset=true){panel.hidden=true;launch.setAttribute('aria-expanded','false');if(reset){mode=null;clearEffect();hud.hidden=true;resize();}}
  function selectMode(next){
    let e=getActive();if(!e?.model)return;e=getActive();clearEffect();if(next==='floors'&&!e.towerBox)next='inspect';mode=next;hud.hidden=false;panel.hidden=false;launch.setAttribute('aria-expanded','true');
    setEffect(mode,{index:0});if(mode==='floors')e.floorFocus=true;
    render();resize();
  }
  function open(){if(!getActive()?.model)return;onOpen();panel.hidden=false;launch.setAttribute('aria-expanded','true');selectMode('inspect');dismiss.focus({preventScroll:true});}
  function describe(message){body.append(node('p','interaction-description',message));}
  function note(message){body.append(node('p','interaction-note',message));}
  function render(){
    const e=getActive();if(!e?.model||!mode)return;const config=INTERACTIVE[e.target.id];
    flip.hidden=mode!=='timeline'||!historyReady(MODEL_HISTORY[e.target.id]);
    title.textContent=word('Interactive studio','Studio interaktif');dismiss.setAttribute('aria-label',word('Close interaction','Tutup interaksi'));
    viewScene.textContent=word('View scene ↗','Lihat model ↗');
    stop.setAttribute('aria-label',word('Return to normal model','Kembali ke model biasa'));tabs.replaceChildren();body.replaceChildren();
    for(const [name,label] of Object.entries(names())){
      if(name==='floors'&&!e.towerBox)continue;const b=action(label,()=>selectMode(name));b.dataset.mode=name;b.setAttribute('aria-pressed',String(mode===name));tabs.append(b);
    }
    hudText.textContent=mode==='floors'?word('13-floor study · illustrative','Kajian 13 aras · ilustrasi'):mode==='route'?word('Illustrative route · not navigation','Laluan ilustrasi · bukan navigasi'):mode==='timeline'?word('Then & Now · concept study','Dulu & Kini · kajian konsep'):names()[mode];
    if(mode==='inspect'){
      describe(word('Choose a feature. It lights up on the model, with a label and a closer look.','Pilih ciri. Ia diserlahkan pada model dengan label dan maklumat lanjut.'));
      const list=node('div','interaction-choices');e.target.points.forEach((point,i)=>{const b=action(`${i+1} · ${text(point.title)}`,()=>{setEffect('inspect',{index:i});close(false);});b.dataset.inspect=i;b.setAttribute('aria-pressed',String(i===e.fx.selected));list.append(b);});body.append(list);
      const chosen=Math.max(0,e.fx.selected);body.append(action(word('Read selected feature','Baca ciri dipilih'),()=>openPoint(chosen),'inspect-read'));
    }
    if(mode==='timeline'){
      const history=MODEL_HISTORY[e.target.id],ready=historyReady(history);
      describe(word('Switch between two different 3D designs. Rotate and zoom to inspect the changes.','Tukar antara dua reka bentuk 3D berbeza. Putar dan zum untuk melihat perubahan.'));
      body.append(node('p','concept-disclosure',word('Creative interpretation · not verified history. One version is an imagined design, not an authentic reconstruction.','Tafsiran kreatif · bukan sejarah yang disahkan. Satu versi ialah reka bentuk rekaan, bukan pembinaan semula yang sahih.')));
      const dates=node('div','timeline-dates');
      for(const key of ['then','now']){
        const label=key==='then'?word('Then','Dulu'):word('Now','Kini');
        const b=action(label,()=>{setEffect('timeline',{key});render();});b.dataset.era=key;b.disabled=!ready;b.setAttribute('aria-pressed',String(e.history?.key===key));dates.append(b);
      }
      body.append(dates);
      const status=node('p','timeline-status');status.id='timeline-status';status.setAttribute('role','status');body.append(status);
      if(!ready){
        status.textContent=word('Then & Now is waiting for two distinct, referenced model versions. The model shown is the existing project model; it is not an era preview.','Dulu & Kini menunggu dua versi model berbeza yang mempunyai rujukan. Model dipaparkan ialah model projek sedia ada; ia bukan pratonton era.');
      }else{
        const version=history[e.history?.key||'then'],card=node('article','timeline-card');
        card.append(node('h3','',text(version.label)),node('p','',text(version.description)));body.append(card);
        if(version.source)note(word('Model origin: ','Asal model: ')+version.source);
        body.append(action(word('Retry model','Cuba model semula'),()=>{setEffect('timeline',{key:e.history?.key||'then'});tick();},'timeline-retry'));
        tick();
      }
    }
    if(mode==='route'){
      describe(word('Choose a stop and follow the moving visitor on the model.','Pilih hentian dan ikuti pelawat bergerak pada model.'));
      const choices=node('div','interaction-choices');config.routes.forEach((item,i)=>{const b=action(text(item.name),()=>{setEffect('route',{index:i});render();});b.dataset.route=i;b.setAttribute('aria-pressed',String(i===e.fx.routeIndex));choices.append(b);});body.append(choices);
      const status=node('p','route-status');status.id='route-status';status.setAttribute('role','status');
      const play=action('',()=>{if(e.fx.progress===1)e.fx.progress=0;e.fx.playing=!e.fx.playing;e.fx.arrived=false;tick();});play.id='route-play';
      const restart=action(word('Restart','Mula semula'),()=>{e.fx.progress=0;e.fx.arrived=false;e.fx.playing=!matchMedia('(prefers-reduced-motion: reduce)').matches;tick();});
      const label=node('label','',word('Move the visitor','Gerakkan pelawat'));label.htmlFor='route-progress';const slider=node('input');slider.id='route-progress';slider.type='range';slider.min=0;slider.max=100;slider.step=1;slider.addEventListener('input',()=>{e.fx.progress=Number(slider.value)/100;e.fx.playing=false;e.fx.arrived=e.fx.progress===1;tick();});
      const row=node('div','row');row.append(play,restart);body.append(status,row,label,slider);
      body.append(action(word('Read about this stop','Baca tentang hentian'),()=>{const destination=config.routes[e.fx.routeIndex];if(destination.point!==undefined)openPoint(destination.point);else onInfo();},'route-info'));
      note(word('Illustrative paths between model features. They are not verified walking directions or accessible routes.','Laluan ilustrasi antara ciri model. Bukan panduan berjalan atau laluan akses yang disahkan.'));tick();
    }
    if(mode==='floors'){
      describe(word('Separate the 13 levels, then tap a slab or a floor number to open its gallery.','Pisahkan 13 aras, kemudian sentuh aras atau nombornya untuk membuka galeri.'));
      const label=node('label','',word('Floor separation','Pemisahan aras'));label.htmlFor='floor-spread';const slider=node('input');slider.id='floor-spread';slider.type='range';slider.min=0;slider.max=100;slider.value=Math.round(e.fx.spread*100);
      const value=node('output');value.htmlFor=slider.id;value.textContent=slider.value+'%';slider.addEventListener('input',()=>{e.fx.spread=Number(slider.value)/100;value.textContent=slider.value+'%';resize();});
      body.append(label,slider,value,action(word('Bring levels together','Rapatkan aras'),()=>{slider.value=0;e.fx.spread=0;value.textContent='0%';resize();}));
      const list=node('div','floor-study-picker');e.target.points.forEach((p,i)=>{const b=action(String(i+1),()=>openPoint(i));b.setAttribute('aria-label',text(p.title));list.append(b);});body.append(list);
      note(word('Conceptual floor study: 13 equal-height levels. No verified interior layouts or room uses are shown.','Kajian aras konseptual: 13 aras sama tinggi. Tiada pelan dalaman atau kegunaan bilik yang disahkan ditunjukkan.'));
      body.append(action(word('Return to original model','Kembali ke model asal'),()=>close(true)));
    }
  }
  function sync(){
    const e=getActive();launch.disabled=!e?.model;launch.textContent=word('Interact','Interaksi');
    const next=(e?.target.id||'')+'|'+getLanguage();if(key!==next){const changedTarget=key.split('|')[0]!==e?.target.id;key=(e?.target.id||'')+'|'+getLanguage();if(changedTarget&&mode)close(true);else if(mode)render();}
    hud.hidden=!mode||!!(e&&getSession()?.mode==='ar'&&!e.tracked);
    if(e&&getSession()?.mode==='ar'&&!e.tracked)panel.hidden=true;
  }
  function peek(index){
    panel.hidden=true;launch.setAttribute('aria-expanded','false');
    if(mode!=='floors'){clearEffect();mode='inspect';setEffect('inspect',{index});}
    hud.hidden=false;hudText.textContent=mode==='floors'?word('13-floor study · illustrative','Kajian 13 aras · ilustrasi'):word('Inspecting a feature','Memeriksa ciri');
  }
  function tick(){
    if(mode==='timeline'){
      const next=getActive()?.history?.key==='then'?word('Show Now','Lihat Kini'):word('Show Then','Lihat Dulu');flip.title=next;flip.setAttribute('aria-label',next);
    }
    if(mode==='timeline'&&!panel.hidden){
      const h=getActive()?.history,status=body.querySelector('#timeline-status'),retry=body.querySelector('.timeline-retry');
      if(retry)retry.hidden=h?.status!=='error';
      if(status&&h?.active)status.textContent=h.status==='loading'?word('Loading the selected model…','Memuatkan model dipilih…'):h.status==='error'?word('This version could not load. Retry, select the other version, or close to restore the project model.','Versi ini gagal dimuatkan. Cuba semula, pilih versi lain atau tutup untuk memulihkan model projek.'):word('Showing: ','Dipaparkan: ')+text(MODEL_HISTORY[getActive().target.id][h.key].label);
    }
    if(mode!=='route'||panel.hidden)return;const f=getActive()?.fx;if(!f)return;const slider=body.querySelector('#route-progress'),play=body.querySelector('#route-play'),status=body.querySelector('#route-status');
    if(slider&&document.activeElement!==slider)slider.value=Math.round(f.progress*100);
    if(play)play.textContent=f.playing?word('Pause','Jeda'):f.progress===1?word('Play again','Main semula'):word('Play','Main');
    if(status){const message=f.arrived?word('You reached the stop.','Anda telah tiba di hentian.'):word('Follow the amber path on the model.','Ikuti laluan kuning pada model.');if(status.textContent!==message)status.textContent=message;}
  }
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden){close(true);launch.focus();}});
  return {open,close,peek,sync,tick,get mode(){return mode;}};
}
