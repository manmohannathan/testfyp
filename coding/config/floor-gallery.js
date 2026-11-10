// Replace these placeholder paths with your real floor photographs.
// Add/remove entries freely. Each floor can have a different number of photos.
// Paths are relative to index.html. Captions can be English/Malay objects.
export const FLOOR_GALLERIES = Object.fromEntries(
  Array.from({ length: 13 }, (_, i) => [`floor-${String(i + 1).padStart(2, '0')}`, [
    { src: './assets/floors/sample-overview.svg', sample: true,
      caption: { en: 'Overview · sample illustration', ms: 'Gambaran umum · ilustrasi contoh' } },
    { src: './assets/floors/sample-learning.svg', sample: true,
      caption: { en: 'Learning space · sample illustration', ms: 'Ruang belajar · ilustrasi contoh' } },
    { src: './assets/floors/sample-meeting.svg', sample: true,
      caption: { en: 'Discussion space · sample illustration', ms: 'Ruang perbincangan · ilustrasi contoh' } }
  ]])
);

// Example: replace ONLY Floor 1's gallery by uncommenting and editing this block.
// FLOOR_GALLERIES['floor-01'] = [
//   { src: './assets/floors/floor-01-entrance.jpg', caption: { en: 'Entrance', ms: 'Pintu masuk' } },
//   { src: './assets/floors/floor-01-reception.jpg', caption: { en: 'Reception', ms: 'Kaunter sambutan' } }
// ];
