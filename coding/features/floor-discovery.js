import { DISCOVERY_GALLERIES } from '../config/discovery-gallery.js';
import { FLOOR_GALLERIES } from '../config/floor-gallery.js';

// Shared floor / numbered landmark discovery drawer.
export function createFloorDiscovery({ stage, container, onSelect, onClose }) {
  let state = null, selected = -1, photo = 0, railKey = '', returnFocus = null;
  const words = {
    floors: ['Floors', 'Aras'], close: ['Close discovery', 'Tutup penemuan'],
    prev: ['Previous image', 'Imej sebelumnya'], next: ['Next image', 'Imej seterusnya'],
    hint: ['Swipe images or use the arrows', 'Leret imej atau gunakan anak panah'],
    sample: ['Gallery preview · sample floor illustrations', 'Pratonton galeri · ilustrasi aras contoh'],
    missing: ['Image unavailable', 'Imej tidak tersedia'], empty: ['Floor photos coming soon', 'Foto aras akan datang'],
    info: ['About this floor', 'Tentang aras ini'], floor: ['Floor', 'Aras'], image: ['Image', 'Imej'],
    demo: ['Floor information is sample content.', 'Maklumat aras ialah kandungan contoh.']
  };
  const w = key => words[key][state?.language === 'ms' ? 1 : 0];
  const text = v => typeof v === 'string' ? v : v?.[state?.language] || v?.en || '';
  const el = (tag, className, value) => { const node = document.createElement(tag); if (className) node.className = className; if (value) node.textContent = value; return node; };
  const rail = el('nav', 'floor-rail'); rail.id = 'floor-rail'; rail.hidden = true;
  const railTitle = el('span', 'floor-rail-title');
  const list = el('div', 'floor-rail-list'); rail.append(railTitle, list); stage.append(rail);
  const panel = el('section', 'floor-gallery-panel'); panel.id = 'floor-gallery-panel'; panel.hidden = true;
  panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'false'); panel.setAttribute('aria-labelledby', 'floor-gallery-title');
  container.append(panel);

  function close(focus = true) {
    if (selected < 0) return;
    selected = -1; panel.hidden = true; panel.replaceChildren();
    onClose(); updateButtons();
    if (focus && returnFocus?.isConnected && !rail.hidden) returnFocus.focus({preventScroll:true});
  }
  function updateButtons() {
    [...list.children].forEach((button, position) => {
      const index = Number(button.dataset.index), point = state.target.points[index];
      button.setAttribute('aria-pressed', String(index === selected));
      button.classList.toggle('visited', state.seen.includes(point.key));
      button.setAttribute('aria-label', text(point.title));
    });
  }
  function drawGallery() {
    if (selected < 0 || !state?.visible) return;
    panel.replaceChildren(); panel.hidden = false;
    const point = state.target.points[selected];
    const header = el('div', 'floor-gallery-header');
    const title = el('h2', '', text(point.title)); title.id = 'floor-gallery-title';
    const dismiss = el('button', 'quiet', '×'); dismiss.type = 'button'; dismiss.id = 'floor-gallery-close'; dismiss.setAttribute('aria-label', w('close')); dismiss.addEventListener('click', () => close());
    header.append(title, dismiss); panel.append(header);
    const images = state.target.floorDiscovery ? FLOOR_GALLERIES[point.key] || [] : DISCOVERY_GALLERIES[state.target.id]?.[point.key] || [];
    photo = images.length ? Math.min(photo, images.length - 1) : 0;
    const carousel = el('div', 'floor-carousel'); carousel.setAttribute('role', 'region'); carousel.setAttribute('aria-roledescription', 'carousel'); carousel.setAttribute('aria-label', text(point.title));
    const viewport = el('div', 'floor-image-viewport'); viewport.tabIndex = 0;
    viewport.setAttribute('aria-label', w('hint'));
    const image = el('img'); image.draggable = false;
    const missing = el('div', 'floor-image-missing', w('missing')); missing.hidden = true;
    viewport.append(image, missing); carousel.append(viewport);
    const caption = el('p', 'floor-image-caption');
    const controls = el('div', 'floor-carousel-controls');
    const prev = el('button', '', '‹'), next = el('button', '', '›');
    prev.type = next.type = 'button'; prev.setAttribute('aria-label', w('prev')); next.setAttribute('aria-label', w('next'));
    const counter = el('span', 'floor-image-counter'); counter.setAttribute('aria-live', 'polite'); counter.setAttribute('aria-atomic', 'true');
    controls.append(prev, counter, next);
    const dots = el('div', 'floor-image-dots');
    const sample = el('p', 'floor-gallery-sample', w('sample'));
    function show(index) {
      if (!images.length) return;
      photo = (index + images.length) % images.length;
      const item = images[photo];
      image.hidden = false; missing.hidden = true;
      image.alt = `${text(point.title)} · ${text(item.caption) || `${w('image')} ${photo + 1}`}`;
      image.src = item.src;
      caption.textContent = text(item.caption);
      counter.textContent = `${photo + 1} / ${images.length}`;
      sample.hidden = !item.sample; sample.textContent = state.target.floorDiscovery ? w('sample') : (state.language === 'ms' ? 'Ilustrasi dan model 3D · bukan foto lokasi' : 'Illustrations and 3D model views · not location photographs');
      [...dots.children].forEach((b, i) => b.setAttribute('aria-pressed', String(i === photo)));
    }
    image.addEventListener('error', () => { image.hidden = true; missing.hidden = false; });
    images.forEach((_, i) => {
      const b = el('button', 'floor-image-dot'); b.type = 'button'; b.setAttribute('aria-label', `${w('image')} ${i + 1}`); b.addEventListener('click', () => show(i)); dots.append(b);
    });
    prev.disabled = next.disabled = images.length < 2;
    prev.addEventListener('click', () => show(photo - 1)); next.addEventListener('click', () => show(photo + 1));
    viewport.addEventListener('keydown', e => {
      if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      e.preventDefault(); show(photo + (e.key === 'ArrowLeft' ? -1 : 1));
    });
    let start = null;
    viewport.addEventListener('pointerdown', e => {
      if (e.isPrimary === false || e.button !== 0) return;
      start = { x: e.clientX, y: e.clientY, id: e.pointerId }; viewport.setPointerCapture(e.pointerId);
    });
    viewport.addEventListener('pointerup', e => {
      if (!start || e.pointerId !== start.id) return;
      const dx = e.clientX - start.x, dy = e.clientY - start.y; start = null;
      if (Math.abs(dx) > 35 && Math.abs(dx) > Math.abs(dy) * 1.2) show(photo + (dx < 0 ? 1 : -1));
    });
    viewport.addEventListener('pointercancel', () => { start = null; });
    carousel.append(caption, controls, dots, el('p', 'floor-swipe-hint', w('hint')), sample);
    panel.append(carousel);
    if (images.length) show(photo); else {
      image.hidden = true; missing.hidden = false; missing.textContent = w('empty');
      controls.hidden = dots.hidden = sample.hidden = true;
    }
    const about = el('div', 'floor-gallery-about');
    about.append(el('h3', '', state.target.floorDiscovery ? w('info') : (state.language === 'ms' ? 'Kisah di sebaliknya' : 'A closer look')), el('p', '', text(point.text)));
    if (state.target.floorDiscovery) about.append(el('p', 'floor-gallery-sample', w('demo')));
    else about.append(el('p','floor-gallery-sample', state.language === 'ms' ? 'Teks bahasa Inggeris daripada dokumen projek.' : 'From the supplied project information.')); 
    if (state.target.id === 'surrenderpoint') about.append(el('p','floor-gallery-sample', 'The project model depicts an earlier memorial design. The supplied information describes the memorial reopened in 2024.'));
    panel.append(about);
  }
  function open(index, focus = true) {
    if (!state?.visible || !state.target.points[index]) return;
    navigator.vibrate?.(15);
    selected = index; photo = 0;
    returnFocus = list.querySelector(`[data-floor="${index + 1}"]`);
    onSelect(index); drawGallery(); panel.scrollTop = 0; updateButtons();
    if (focus) panel.querySelector('#floor-gallery-close')?.focus({preventScroll:true});
  }
  function sync(next) {
    const changedLanguage = state?.language !== next.language;
    if (state?.target?.id !== next.target?.id || !next.visible) close(false);
    state = next; rail.hidden = !next.visible;
    if (!next.visible) return;
    const label = next.target.floorDiscovery ? w('floors') : (next.language === 'ms' ? 'Terokai' : 'Discover');
    rail.setAttribute('aria-label', label); railTitle.textContent = label; rail.classList.toggle('point-rail', !next.target.floorDiscovery);
    const key = next.target.id + next.language;
    if (railKey !== key) {
      list.replaceChildren(); railKey = key;
      const indexes = next.target.points.map((_, i) => i);
      if (next.target.floorDiscovery) indexes.reverse();
      indexes.forEach(index => {
        const b = el('button', '', String(index + 1)); b.type = 'button'; b.dataset.floor = index + 1; b.dataset.index = index;
        b.setAttribute('aria-controls', 'floor-gallery-panel'); b.addEventListener('click', () => open(index)); list.append(b);
      });
    }
    updateButtons();
    if (selected >= 0) returnFocus = list.querySelector(`[data-floor="${selected + 1}"]`);
    if (changedLanguage && selected >= 0) drawGallery();
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && selected >= 0) { e.preventDefault(); close(); } });
  return { sync, open, close, focus: () => list.firstElementChild?.focus({preventScroll:true}) };
}
