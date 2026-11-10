import { TARGETS } from '../content/landmarks.js';
export const STORAGE_KEY = 'labuan-legends-journal-v1';
// Keep discovered points; retired quiz results no longer unlock stamps.
export function sanitizeProgress(value) {
  return Object.fromEntries(TARGETS.map(target => {
    const raw = value?.[target.id];
    const seen = Array.isArray(raw?.seen) ? [...new Set(raw.seen.filter(key => target.points.some(p => p.key === key)))] : [];
    return [target.id, {seen, version: target.progressVersion || null, earned: seen.length === target.points.length}];
  }));
}
