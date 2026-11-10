export function createNarration({getActive,getSession,getLanguage,getDetail,t,feedback,$}) {
const audioCache = new Map(); let currentAudio = null, audioRequest = 0;
function getAudio() {
  const src = getActive()?.target.audio?.[getLanguage()];
  if (!src) return null;
  if (!audioCache.has(src)) {
    const a = new Audio(src);
    a.preload = 'none';
    a.addEventListener('ended', () => {
      if (currentAudio === a) updateAudio();
    });
    audioCache.set(src, a);
  }
  return audioCache.get(src);
}

function pauseAudio(reset = false) {
  audioRequest++;
  if (currentAudio) {
    currentAudio.pause();
    if (reset) currentAudio.currentTime = 0;
  }
  updateAudio();
}

function updateAudio() {
  const available = !!getActive()?.target.audio?.[getLanguage()];
  const playing = currentAudio && !currentAudio.paused;
  const resumed = currentAudio && currentAudio.currentTime > 0 && !currentAudio.ended;
  $('narrator-btn').disabled = !available || !getActive()?.model;
  $('narrator-btn').textContent = t(playing ? 'pause' : resumed ? 'resume' : 'audio');
  $('audio-note').textContent = getActive() && !available ? t('noAudio') : getActive()?.audioBlocked ? t('autoAudio') : '';
  $('audio-unlock').hidden = !getActive()?.audioBlocked || !available;
}

async function toggleAudio() {
  const audio = getAudio();
  if (!audio) return;
  if (!audio.paused) {
    pauseAudio();
    return;
  }
  const request = ++audioRequest;
  currentAudio = audio;
  try {
    await audio.play();
    if (getActive()) getActive().audioBlocked = false;
    if (request !== audioRequest) {
      audio.pause();
      return;
    }
    updateAudio();
  } catch {
    if (request === audioRequest) {
      updateAudio();
      if (getActive()) getActive().audioBlocked = true;
      updateAudio();
      feedback(t('autoAudio'));
    }
  }
}

// Automatic narration runs once per landmark/language in each session.
// Marker reacquisition never restarts a recording the visitor has already heard.
function autoNarrate(entry) {
  if (getActive() !== entry || !entry.model || entry.animating || document.hidden ||
      (getSession()?.mode === 'ar' && !entry.tracked) || getDetail() || $('journal-dialog').open) return;
  if (!entry.target.audio?.[getLanguage()] || entry.narrated.has(getLanguage())) return;
  entry.narrated.add(getLanguage());
  toggleAudio();
}

return {pauseAudio,updateAudio,toggleAudio,autoNarrate,resetAudio: () => { currentAudio = null; }};
}
