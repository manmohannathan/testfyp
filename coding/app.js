import { createInteractions } from './features/interactions-panel.js';
import { createStableAnchor, framingHint } from './features/tracking-stability.js';
import { TRACKING } from './config/tracking.js';
import { renderMuseum } from './features/museum-board.js';
import { createAIGuide } from './features/ai-guide.js';
// Imports and application state

import { createFloorDiscovery } from './features/floor-discovery.js';
import { createScene } from './features/scene.js';
import { createNarration } from './features/narration.js';
import { createStoryVideo } from './features/landmark-videos.js';
import { combineTargets } from './services/markers.js';
import { createCameraService } from './services/camera.js';

import { TARGETS } from './content/landmarks.js';
import { UI } from './content/translations.js';
import { STORAGE_KEY, sanitizeProgress } from './services/progress.js';

const THREE = window.MINDAR?.IMAGE?.THREE;

const $ = id => document.getElementById(id);

let language = 'en',
  progress = sanitizeProgress(null),
  storageOK = true;

try {
  progress = sanitizeProgress(JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'));
  language = localStorage.getItem('labuan-language') === 'ms' ? 'ms' : 'en';
  document.body.classList.toggle('theme-modern', localStorage.getItem('labuan-theme') === 'modern');
} catch {
  storageOK = false;
}

const text = value => typeof value === 'string' ? value : value?.[language] || value?.en || '';

const t = key => text(UI[key]);

const escape = s => String(s).replace(/[&<>"']/g, c => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
})[c]);

let session = null,
  generation = 0,
  active = null,
  detail = null,
  selection = -1,
  dialogKind = null;

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

// Shared interface helpers

function feedback(message) {
  $('feedback').textContent = message;
}

function setBusy(value) {
  $('start-ar').disabled = value;
  $('start-preview').disabled = value;
  document.querySelectorAll('[data-preview]').forEach(b => b.disabled = value);
}

function translate() {
  document.documentElement.lang = language;
  $('lang-select').value = language;
  $('landing-language').value = language;
  document.querySelectorAll('[data-i18n]').forEach(el => el.textContent = t(el.dataset.i18n));
  if (session) {
    $('mode-label').textContent = t(session.mode === 'ar' ? 'arMode' : 'previewMode');
    refresh();
    renderDetail();
  }
  if ($('journal-dialog').open) openDialog(dialogKind);
}

function refresh() {
  const available = !!active?.model;
  $('zoom-level').textContent = (active?.zoom || 1).toFixed(1) + '×';
  $('landmark-title').textContent = active ? active.target.id === 'labuanclocktower' ? t('clock') : active.target.name : t('waiting');
  $('collection-progress').textContent = active ? `${progress[active.target.id].seen.length} / ${active.target.points.length} ${t(active.target.floorDiscovery ? 'floors' : 'discoveries')}` : 'LABUAN LEGENDS';
  ['discover-btn', 'story-btn', 'info-btn', 'replay-btn', 'reset-view', 'zoom-in', 'zoom-out'].forEach(id => $(id).disabled = !available);
  $('tracking-status').textContent = session?.mode === 'preview' ? t(active?.failed ? 'modelError' : active?.model ? 'previewMode' : 'loading') : active?.tracked ? active.model ? t('ready') : active.failed ? t('modelError') : t('loading') : t('scan');
  $('scan-guide').hidden = session?.mode !== 'ar' || !!active?.tracked;
  for (const entry of session?.entries || []) for (let i = 0; i < entry.buttons.length; i++) {
    const done = progress[entry.target.id].seen.includes(entry.target.points[i].key);
    entry.buttons[i].classList.toggle('done', done);
    entry.buttons[i].textContent = entry.target.floorDiscovery ? `F${i + 1}` : String(i + 1);
    entry.buttons[i].setAttribute('aria-label', `${i + 1}. ${text(entry.target.points[i].title)}${done ? ' · ' + t('earned') : ''}`);
  }
  $('target-picker').replaceChildren();
  const choices = (session?.entries || []).filter(e => session.mode === 'preview' || e.tracked);
  if (choices.length > 1) for (const e of choices) {
    const b = document.createElement('button');
    b.textContent = e.target.id === 'labuanclocktower' ? t('clock') : e.target.name;
    b.setAttribute('aria-pressed', String(e === active));
    b.disabled = e.failed;
    b.addEventListener('click', () => setActive(e));
    $('target-picker').appendChild(b);
  }
  updateAudio();
  ai.sync();
  interactions.sync();
  floorUI.sync({ target: active?.target, language, seen: active ? progress[active.target.id].seen : [], visible: !!(!active?.history?.active && active?.model && (session?.mode === 'preview' || active.tracked)) });
}

// Audio narration

function setSheet(open) {
  if (open) floorUI.close(false);
  const ar = session?.mode === 'ar';
  document.body.classList.toggle('sheet-open', ar && open);
  $('controls').inert = ar && !open;
  $('sheet-toggle').setAttribute('aria-expanded', String(ar && open));
  if (ar && !open && detail === 'story') renderDetail();
}

// Progress and rewards

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    storageOK = false;
  }
}

function recordPoint(index) {
  if (!active) return;
  const data = progress[active.target.id],
    was = data.earned,
    key = active.target.points[index].key;
  if (!data.seen.includes(key)) data.seen.push(key);
  data.earned = data.seen.length === active.target.points.length;
  persist();
  refresh();
  if (data.earned && !was) celebrate(t('unlocked'));
}

function celebrate(message) {
  feedback(message);
  $('feedback').classList.remove('toast-celebrate');
  void $('feedback').offsetWidth;
  $('feedback').classList.add('toast-celebrate');
}

// Landmark selection and detail panels

function setActive(entry) {
  if (active === entry) return;
  interactions.close(true);
  floorUI.close(false);
  pauseAudio(true);
  ai.reset();
  active = entry;
  stopStoryVideo();
  detail = null;
  selection = -1;
  feedback('');
  for (const e of session.entries) {
    if (session.mode === 'preview') e.host.visible = e === entry;
    if (e.user) e.user.visible = e === entry;
    highlight(e, -1);
  }
  if (entry.model && !entry.revealed) reveal(entry);
  renderDetail();
  refresh();
  if (session) resize(session);
  autoNarrate(entry);
  if (!entry.model && !entry.loading && session) {
    const s = session;
    entry.loading = prepareModel(entry, s).catch(error => {
      if (session !== s) return;
      entry.failed = true;
      console.error('Model load:', entry.target.id, error);
      feedback(t('modelError'));
      refresh();
    });
  }
}

function selectPoint(index, record = true) {
  if (!active?.model) return;
  selection = index;
  highlight(active, index);
  if (record) recordPoint(index);
}

function openPoint(index) { floorUI.open(index); }

function renderDetail() {
  stopStoryVideo();
  $('detail-panel').hidden = !detail || !active;
  if (!detail || !active) return;
  const data = active.target,
    body = $('detail-body');
  body.replaceChildren();
  const heading = (k, title) => {
    $('detail-kicker').textContent = k;
    $('detail-title').textContent = title;
  };
  const p = message => {
    const el = document.createElement('p');
    el.textContent = message;
    body.appendChild(el);
  };
  const button = (label, fn, parent = body, primary = false) => {
    const b = document.createElement('button');
    b.textContent = label;
    if (primary) b.className = 'primary';
    b.addEventListener('click', fn);
    parent.appendChild(b);
    return b;
  };
  if (data.floorDiscovery && detail !== 'story') {
    const note = document.createElement('p');
    note.className = 'floor-demo-note';
    note.textContent = t('floorDemo');
    body.appendChild(note);
  }
  if (detail === 'discover' || detail === 'point') {
    heading(t('discover'), detail === 'point' ? text(data.points[selection].title) : t('choose'));
    p(detail === 'point' ? text(data.points[selection].text) : t('tap'));
    const list = document.createElement('div');
    list.className = 'discovery-list row';
    data.points.forEach((point, i) => {
      const b = button(`${progress[data.id].seen.includes(point.key) ? '✓' : i + 1} · ${text(point.title)}`, () => openPoint(i), list);
      b.setAttribute('aria-pressed', String(detail === 'point' && selection === i));
    });
    body.appendChild(list);
  } else if (detail === 'story') {
    heading(t('story'), data.fullName);
    addStoryVideo(body, data);
  }
}

// Passport, markers, and information dialogs

function openDialog(kind) {
  interactions.close(true);
  floorUI.close(false);
  ai.close(false);
  dialogKind = kind;
  const el = $('dialog-content');
  el.replaceChildren();
  if (kind === 'passport') {
    const count = TARGETS.filter(target => progress[target.id].earned).length;
    $('dialog-title').textContent = t('passport');
    el.innerHTML = `<p>${escape(t(count === TARGETS.length ? 'allDone' : 'passportHint'))}</p><div class="progress-track" role="progressbar" aria-label="${escape(t('passport'))}" aria-valuenow="${count}" aria-valuemin="0" aria-valuemax="${TARGETS.length}"><span style="width:${count / TARGETS.length * 100}%"></span></div><p class="small">${count} / ${TARGETS.length} ${escape(t('earned'))}</p><div class="stamps">${TARGETS.map(target => `<div class="stamp ${progress[target.id].earned ? 'earned' : ''}"><div class="seal" aria-hidden="true">${progress[target.id].earned ? '✓' : '○'}</div><h3>${escape(target.id === 'labuanclocktower' ? t('clock') : target.name)}</h3><p>${escape(t(progress[target.id].earned ? 'earned' : 'locked'))}</p></div>`).join('')}</div><p class="small">${escape(t(storageOK ? 'local' : 'sessionOnly'))}</p>`;
  } else if (kind === 'markers') {
    $('dialog-title').textContent = t('markers');
    el.innerHTML = `<p>${escape(t('markerHint'))}</p><div class="marker-grid">${TARGETS.filter(target => target.marker && target.image).map(target => `<figure><img src="${encodeURI(target.image)}" alt="${escape(target.name)} marker"><figcaption>${escape(target.name)}<a href="${encodeURI(target.image)}" target="_blank" rel="noopener">${escape(t('openImage'))}</a></figcaption></figure>`).join('')}</div>`;
  } else if (kind === 'info' && active) {
    $('dialog-title').textContent = active.target.fullName;
    renderMuseum(el, active.target.id, language);
  }
  pauseAudio();
  stopStoryVideo();
  if (!$('journal-dialog').open) $('journal-dialog').showModal();
}

// Session lifecycle

function cleanup(s) {
  if (!s || s.closed) return;
  s.closed = true;
  cameraService.release();
  s.observer?.disconnect();
  s.renderer?.setAnimationLoop(null);
  s.clearPointers?.();
  if (s.mind) {
    s.mind.controller?.stopProcessVideo();
    s.mind.controller?.worker?.terminate?.();
    s.mind.video?.srcObject?.getTracks().forEach(track => track.stop());
    s.mind.video?.remove();
    window.removeEventListener('resize', s.mind._onResize);
    s.mind.cssRenderer?.domElement.remove();
  }
  s.entries.forEach(e => {
    disposeModel(e.normalized || e.model);
    e.buttons.forEach(b => b.remove());
    e.featureLabel?.remove();
  });
  s.renderer?.dispose();
  s.renderer?.domElement.remove();
  if (s.targetURL) URL.revokeObjectURL(s.targetURL);
}

function exit() {
  interactions.close(true);
  ai.reset();
  floorUI.close(false);
  floorUI.sync({visible:false, language});
  generation++;
  pauseAudio(true);
  stopStoryVideo();
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  document.body.classList.remove('ar-mode', 'sheet-open');
  $('controls').inert = false;
  $('ar-dock').hidden = true;
  $('sheet-close').hidden = true;
  const old = session;
  session = null;
  active = null;
  cleanup(old);
  detail = null;
  $('hotspots').replaceChildren();
  $('ar-container').replaceChildren();
  $('experience').hidden = true;
  $('landing').hidden = false;
  setBusy(false);
  $('startup-status').textContent = '';
}

async function start(mode, initialTarget = 'umslic') {
  if (!THREE) {
    $('startup-status').textContent = 'The AR library could not load. Reload the page.';
    return;
  }
  if (mode === 'ar' && (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia)) {
    $('startup-status').textContent = t('secure');
    return;
  }
  setBusy(true);
  // Requested inside the Start gesture; viewport layout remains full-screen if unsupported.
  if (mode === 'ar') document.documentElement.requestFullscreen?.().catch(() => {});
  $('startup-status').textContent = t('loading');
  const token = ++generation;
  const s = {
    mode,
    entries: [],
    targets: mode === 'ar' ? TARGETS.filter(t => t.marker) : TARGETS,
    closed: false
  };
  session = s;
  active = null;
  try {
    if (mode === 'ar') {
      s.targetURL = await combineTargets(s.targets);
      if (token !== generation) {
        URL.revokeObjectURL(s.targetURL);
        return;
      }
      s.mind = new window.MINDAR.IMAGE.MindARThree({
        container: $('ar-container'),
        imageTargetSrc: s.targetURL,
        maxTrack: 1,
        uiLoading: 'no',
        uiScanning: 'no',
        uiError: 'no'
      });
      // Keep camera errors and cancellation observable; the bundled loader otherwise rejects without a reason.
      s.mind._startVideo = async () => {
        const stream = await cameraService.open(() => token !== generation);
        if (token !== generation) {
          stream.getTracks().forEach(track => track.stop());
          throw Error('Cancelled');
        }
        const video = document.createElement('video');
        video.autoplay = true;
        video.muted = true;
        video.playsInline = true;
        video.style.cssText = 'position:absolute;z-index:1';
        s.mind.video = video;
        $('ar-container').appendChild(video);
        video.srcObject = stream;
        await video.play();
        if (token !== generation) {
          stream.getTracks().forEach(track => track.stop());
          throw Error('Cancelled');
        }
        video.width = video.videoWidth;
        video.height = video.videoHeight;
      };
      s.renderer = s.mind.renderer;
      s.scene = s.mind.scene;
      s.camera = s.mind.camera;
      s.mind.cssRenderer.domElement.style.pointerEvents = 'none';
    } else {
      s.renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true
      });
      s.scene = new THREE.Scene();
      s.camera = new THREE.PerspectiveCamera(38, 1, .01, 100);
      s.camera.position.set(0, 1.1, 3);
      s.camera.lookAt(0, .42, 0);
      $('ar-container').appendChild(s.renderer.domElement);
    }
    s.renderer.setPixelRatio(Math.min(devicePixelRatio, mode === 'ar' ? TRACKING.arPixelRatio : 2));
    s.renderer.setClearColor(0, 0);
    s.renderer.outputEncoding = THREE.sRGBEncoding;
    s.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    s.renderer.toneMappingExposure = 1;
    s.scene.add(new THREE.HemisphereLight(0xffffff, 0xb6a78b, .9));
    const light = new THREE.DirectionalLight(0xfff6e8, .85);
    light.position.set(2, 4, 4);
    s.scene.add(light);
    for (let i = 0; i < s.targets.length; i++) {
      const anchor = mode === 'ar' ? s.mind.addAnchor(i) : null;
      const stability = anchor ? createStableAnchor(THREE,s.scene,anchor) : null;
      const entry = {
        target: s.targets[i],
        narrated: new Set(),
        host: stability?.host || new THREE.Group(),
        stability,
        anchor,
        model: null,
        buttons: [],
        tracked: false,
        revealed: false,
        failed: false
      };
      s.entries.push(entry);
      if (mode === 'preview') {
        s.scene.add(entry.host);
        entry.host.visible = i === 0;
      } else {
        anchor.onTargetFound = () => {
          if (session !== s) return;
          entry.tracked = true;
          if (!active || !active.tracked) setActive(entry);
          if (entry.model && !entry.revealed) reveal(entry);
          autoNarrate(entry);
          refresh();
        };
        anchor.onTargetLost = () => {
          if (session !== s) return;
          entry.tracked = false;
          entry.stability?.reset();
          if (active === entry) {
            pauseAudio();
            s.clearPointers?.();
            const other = s.entries.find(e => e !== entry && e.tracked);
            if (other) setActive(other);else {
              feedback(t('lost'));
              refresh();
            }
          }
        };
      }
    }
    document.body.classList.toggle('ar-mode', mode === 'ar');
    $('ar-dock').hidden = mode !== 'ar';
    $('sheet-close').hidden = mode !== 'ar';
    $('fullscreen-btn').hidden = mode !== 'ar' || !document.documentElement.requestFullscreen;
    setSheet(false);
    $('landing').hidden = true;
    $('experience').hidden = false;
    $('mode-label').textContent = t(mode === 'ar' ? 'arMode' : 'previewMode');
    feedback('');
    if (mode === 'preview') setActive(s.entries.find(e => e.target.id === initialTarget) || s.entries[0]);else refresh();
    s.observer = new ResizeObserver(() => resize(s));
    s.observer.observe($('stage'));
    resize(s);
    attachGestures(s);
    s.renderer.setAnimationLoop(time => {
      if (session === s) {
        for(const e of s.entries)e.stability?.tick(time,e.tracked);
        updateScene(s, time);interactions.tick();
        if(mode==='ar'&&(!s.hintAt||time-s.hintAt>250)){
          s.hintAt=time;
          const state=framingHint(THREE,active,s.camera,$('stage'));
          const label=t('scanHint_'+state);
          if($('scan-distance').textContent!==label)$('scan-distance').textContent=label;
        }
      }
    });
    // Preview locations load on selection, keeping the first view quick on phones.
    const results = await Promise.allSettled(s.entries.map(e =>
      e.loading || Promise.resolve()));
    if (token !== generation) return;
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        s.entries[i].failed = true;
        console.error('Model load:', s.entries[i].target.id, r.reason);
      }
    });
    if (results.every(r => r.status === 'rejected')) throw Error('All models failed to load. Check that all assets are uploaded.');
    if (mode === 'preview' && active.failed && s.entries.some(e => e.model)) setActive(s.entries.find(e => e.model));
    if (results.some(r => r.status === 'rejected')) feedback(t('modelError'));
    if (mode === 'ar') {
      $('tracking-status').textContent = t('camera');
      await s.mind.start();
      if (token !== generation) {
        s.mind.controller?.stopProcessVideo();
        s.mind.video?.srcObject?.getTracks().forEach(track => track.stop());
        return;
      }
      URL.revokeObjectURL(s.targetURL);
      s.targetURL = null;
      resize(s);
    }
    setBusy(false);
    refresh();
  } catch (error) {
    console.error('Labuan startup:', error);
    if (token !== generation) return;
    exit();
    $('startup-status').textContent = mode === 'ar' ? t('cameraError') : error?.message || t('modelError');
  }
}

const {pauseAudio,updateAudio,toggleAudio,autoNarrate,resetAudio} = createNarration({getActive:()=>active,getSession:()=>session,getLanguage:()=>language,getDetail:()=>detail||interactions.mode,t,feedback,$});
const {stopStoryVideo,addStoryVideo} = createStoryVideo({$,t,text,pauseAudio});
const {disposeModel,prepareModel,reveal,highlight,updateScene,zoom,attachGestures,resize,setEffect,clearEffect} = createScene({THREE,$,getSession:()=>session,getActive:()=>active,getSelection:()=>selection,reducedMotion,refresh,openPoint,autoNarrate,getLanguage:()=>language});
const cameraService = createCameraService();

// UMSKAL discovery: screen-space floor buttons and an accessible, swipeable gallery.
const floorUI = createFloorDiscovery({
  stage: $('stage'), container: $('experience'),
  onSelect(index) {
    ai.close(false); pauseAudio(); stopStoryVideo(); detail = null;
    setSheet(false); renderDetail();
    interactions.peek(index);
    selectPoint(index);
    if (active.target.floorDiscovery && session?.mode === 'preview') { active.floorFocus = true; resize(session); }
  },
  onClose() { selection = -1; highlight(active, -1); }
});

const ai = createAIGuide({ container: $('experience'), getTarget: () => active?.target, getLanguage: () => language, onOpen: () => { interactions.close(true);floorUI.close(false); pauseAudio(); stopStoryVideo(); detail = null; renderDetail(); setSheet(false); } });

const interactions=createInteractions({container:$('experience'),stage:$('stage'),getActive:()=>active,getSession:()=>session,getLanguage:()=>language,setEffect,clearEffect,openPoint,onInfo:()=>openDialog('info'),resize:()=>{if(session)resize(session);},onOpen:()=>{floorUI.close(false);ai.close(false);pauseAudio();stopStoryVideo();detail=null;renderDetail();setSheet(false);}});

// Event listeners and initialization

$('sheet-toggle').addEventListener('click', () => {const open=!document.body.classList.contains('sheet-open');if(open)interactions.close(true);setSheet(open);});
$('sheet-close').addEventListener('click', () => { setSheet(false); $('sheet-toggle').focus(); });
$('audio-unlock').addEventListener('click', toggleAudio);
$('fullscreen-btn').addEventListener('click', () => document.documentElement.requestFullscreen?.().catch(() => {}));
document.addEventListener('keydown', e => { if (e.key === 'Escape' && session?.mode === 'ar') setSheet(false); });

$('start-ar').addEventListener('click', () => start('ar'));

$('start-preview').addEventListener('click', () => start('preview'));

$('exit-btn').addEventListener('click', exit);

['passport-btn', 'landing-passport'].forEach(id => $(id).addEventListener('click', () => openDialog('passport')));

$('markers-btn').addEventListener('click', () => openDialog('markers'));

$('info-btn').addEventListener('click', () => openDialog('info'));

$('close-dialog').addEventListener('click', () => $('journal-dialog').close());

$('discover-btn').addEventListener('click', () => {
  interactions.close(true);
  ai.close(false); detail = null; renderDetail(); setSheet(false);
  if (active?.target.floorDiscovery && session?.mode === 'preview') { active.floorFocus = true; resize(session); }
  refresh(); floorUI.focus();
});

$('story-btn').addEventListener('click', () => {
  interactions.close(true);
  ai.close(false);
  floorUI.close(false);
  pauseAudio();
  setSheet(true);
  detail = 'story';
  renderDetail();
});

$('close-detail').addEventListener('click', () => {
  detail = null;
  selection = -1;
  highlight(active, -1);
  renderDetail();
});

$('replay-btn').addEventListener('click', () => reveal(active));

$('narrator-btn').addEventListener('click', toggleAudio);

$('zoom-in').addEventListener('click', () => zoom(active.zoom * 1.15));

$('zoom-out').addEventListener('click', () => zoom(active.zoom / 1.15));

$('reset-view').addEventListener('click', () => {
  interactions.close(true);
  floorUI.close(false);
  zoom(1);
  active.user.rotation.y = session.mode === 'preview' ? -.3 : THREE.MathUtils.degToRad(active.target.tabletop.yawDegrees);
  if (active.target.id === 'umslic' && session.mode === 'preview') {
    active.floorFocus = false;
    resize(session);
  }
});

function changeLanguage(e) {
  pauseAudio(true);
  resetAudio();
  language = e.target.value;
  try {
    localStorage.setItem('labuan-language', language);
  } catch {}
  translate();
  if (active) autoNarrate(active);
}
$('lang-select').addEventListener('change', changeLanguage);
$('landing-language').addEventListener('change', changeLanguage);
document.querySelectorAll('[data-preview]').forEach(button => button.addEventListener('click', () => start('preview', button.dataset.preview)));

$('theme-toggle-btn').addEventListener('click', () => {
  document.body.classList.toggle('theme-modern');
  try {
    localStorage.setItem('labuan-theme', document.body.classList.contains('theme-modern') ? 'modern' : 'vintage');
  } catch {}
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    pauseAudio();
    stopStoryVideo();
    session?.clearPointers?.();
  }
});

window.addEventListener('pagehide', exit);

translate();
