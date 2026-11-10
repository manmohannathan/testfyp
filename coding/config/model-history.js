// Creative concepts requested by the project author, not verified historical reconstructions.
// Existing models are reused; only four new alternatives add website assets.
const lang=(en,ms)=>({en,ms});
const conceptSource='Original imagined Blender design for this prototype; not a historical survey or photographic reconstruction.';
const suppliedSource='Existing model supplied with the project; retained without architectural changes.';
export const MODEL_HISTORY = {
  umslic: {
    then: {
      model:'assets/models/history/umslic/then/model.gltf', conceptual:true,
      label:lang('Then · imagined early campus','Dulu · konsep kampus awal'),
      description:lang('An imagined low-rise campus with a two-storey administration block, teaching wings, a covered entrance and garden courts. This is an alternative design concept, not evidence that UMSKAL previously looked like this.','Kampus rendah rekaan dengan blok pentadbiran dua tingkat, sayap pengajaran, pintu masuk berbumbung dan taman. Ini konsep alternatif, bukan bukti rupa UMSKAL pada masa dahulu.'),
      source:conceptSource
    },
    now: {
      model:'assets/models/umskal_.gltf',
      label:lang('Now · supplied UMSKAL model','Kini · model UMSKAL sedia ada'),
      description:lang('Your supplied campus model, including the tall main building and surrounding campus. Notice the vertical form and expanded site layout compared with the imagined early-campus concept.','Model kampus anda dengan bangunan utama tinggi dan kawasan sekitarnya. Perhatikan bentuk menegak dan susun atur tapak berbanding konsep kampus awal rekaan.'),
      source:suppliedSource
    }
  },
  labuanclocktower: {
    then: {
      model:'assets/models/history/labuanclocktower/then/model.gltf', conceptual:true,
      label:lang('Then · imagined town-hall setting','Dulu · konsep latar dewan bandar'),
      description:lang('A newly modelled clock tower joined to two municipal-hall wings, with a veranda and civic forecourt. The arrangement and proportions are imagined; this is not a replica of the original 1906 building.','Menara jam baharu dengan dua sayap dewan, serambi dan halaman. Susunan dan perkadaran direka; ini bukan replika bangunan asal 1906.'),
      source:conceptSource
    },
    now: {
      model:'assets/models/Labuan_Clock_Tower.gltf',
      label:lang('Now · supplied Clock Tower model','Kini · model Menara Jam sedia ada'),
      description:lang('Your supplied freestanding tower and landscaped base. Switch back to see how the imagined attached hall changes the silhouette and the public space around it.','Model menara berdiri sendiri dan tapak berlandskap anda. Tukar semula untuk melihat perubahan bentuk dan ruang awam dalam konsep dewan yang bersambung.'),
      source:suppliedSource
    }
  },
  lisc: {
    then: {
      model:'assets/models/history/lisc/then/model.gltf', conceptual:true,
      label:lang('Then · imagined timber waterfront','Dulu · konsep pesisir berjeti kayu'),
      description:lang('A coastal concept with timber stores, raised jetties, roofed shelters and small boats. It illustrates a different type of waterfront use; it is not a verified earlier layout of this site.','Konsep pesisir dengan stor kayu, jeti, pondok berbumbung dan bot kecil. Ia menggambarkan kegunaan pesisir yang berbeza, bukan susun atur lama tapak yang disahkan.'),
      source:conceptSource
    },
    now: {
      model:'assets/models/lisc.gltf',
      label:lang('Now · supplied Sea Sports Complex','Kini · model Kompleks Sukan Laut'),
      description:lang('Your supplied complex with its large halls, fountain, promenade and coastal setting. A separate 3D object replaces the timber-waterfront concept when you select this version.','Model kompleks anda dengan dewan besar, air pancut, persiaran dan latar pesisir. Objek 3D berasingan menggantikan konsep jeti kayu apabila versi ini dipilih.'),
      source:suppliedSource
    }
  },
  surrenderpoint: {
    then: {
      model:'assets/models/labuan_surrender_point.gltf',
      label:lang('Then · supplied earlier memorial','Dulu · model tugu terdahulu'),
      description:lang('Your supplied earlier-design memorial with its entrance arch, circular enclosure and interpretive structure. Its geometry is retained as the starting point of this concept study.','Model tugu terdahulu anda dengan gerbang, kawasan bulat dan struktur penerangan. Geometri ini dikekalkan sebagai asas kajian konsep.'),
      source:suppliedSource
    },
    now: {
      model:'assets/models/history/surrenderpoint/now/model.gltf', conceptual:true,
      label:lang('Now · imagined memorial redesign','Kini · konsep reka bentuk tugu'),
      description:lang('An original contemporary proposal with a curved remembrance wall, bronze details, a central stone, reflecting water and a processional path. This is NOT a model of the actual 2024 replacement memorial.','Cadangan kontemporari rekaan dengan dinding peringatan melengkung, butiran gangsa, batu pusat, kolam dan laluan upacara. Ini BUKAN model tugu pengganti sebenar tahun 2024.'),
      source:conceptSource
    }
  }
};

export function historyReady(history) {
  const valid = version => typeof version?.model === 'string' && version.model.trim()
    && (typeof version.label === 'string' ? version.label.trim() : version.label?.en?.trim());
  if (!valid(history?.then) || !valid(history?.now)) return false;
  const canonical = path => new URL(path, globalThis.location?.href || 'https://local.invalid/').href;
  return canonical(history.then.model) !== canonical(history.now.model);
}
