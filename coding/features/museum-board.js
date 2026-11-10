import { MUSEUM } from '../content/museum.js';
export function renderMuseum(container, id, language) {
  const board = MUSEUM[id];
  const node = (tag, className, text) => { const el = document.createElement(tag); el.className = className; el.textContent = text; return el; };
  const article = node('article', 'museum-board', '');
  const number = String(Object.keys(MUSEUM).indexOf(id) + 1).padStart(2, '0');
  article.append(node('div', 'museum-label', `THE LABUAN COLLECTION / ${number}`), node('p', 'museum-subtitle', board.subtitle), node('p', 'museum-lead', board.intro));
  const grid = node('div', 'museum-sections', '');
  for (const section of board.sections) {
    const block = node('section', 'museum-section', '');
    block.append(node('h3', '', section.title), node('p', '', section.text)); grid.append(block);
  }
  article.append(grid, node('footer', 'museum-source', language === 'ms' ? 'Teks asal bahasa Inggeris daripada dokumen projek. Sahkan aturan lawatan dengan pihak lokasi.' : 'Text from the supplied project documents. Confirm current visiting arrangements with the venue.'));
  container.append(article);
}
