// Combines the supplied single-image MindAR v2 files without modifying them.
export async function combineTargets(targets) {
  const header = new Uint8Array([0x82, 0xa1, 0x76, 0x02, 0xa8, 0x64, 0x61, 0x74, 0x61, 0x4c, 0x69, 0x73, 0x74, 0x91]);
  if (!targets.length) throw Error('No AR markers configured.');
  if (new Set(targets.map(t => t.marker)).size !== targets.length) throw Error('Each location needs a unique marker file.');
  if (targets.length > 15) throw Error('Recompile targets together for more than 15 markers.');
  const parts = await Promise.all(targets.map(async target => {
    const response = await fetch(target.marker);
    if (!response.ok) throw Error('Marker file unavailable: ' + target.marker);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!header.every((v, i) => bytes[i] === v)) throw Error('Unsupported marker format: ' + target.marker);
    return bytes.subarray(header.length);
  }));
  const combined = new Uint8Array(header.length + parts.reduce((n, p) => n + p.length, 0));
  combined.set(header);
  combined[13] = 0x90 + parts.length;
  let offset = header.length;
  for (const p of parts) {
    combined.set(p, offset);
    offset += p.length;
  }
  return URL.createObjectURL(new Blob([combined]));
}

