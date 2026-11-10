import landmark0 from './landmarks/umskal.js';
import landmark1 from './landmarks/clock-tower.js';
import landmark2 from './landmarks/surrender-point.js';
import landmark3 from './landmarks/sea-sport-complex.js';
import { MEDIA } from '../config/media.js';
export const TARGETS = [landmark0,landmark1,landmark2,landmark3].map(target => ({...target, ...MEDIA[target.id]}));
