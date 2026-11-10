export function youtubeEmbed(raw) {
  const url = new URL(raw); const host = url.hostname.replace(/^www\./, '');
  if (!['youtube.com','m.youtube.com','youtu.be','youtube-nocookie.com'].includes(host)) return null;
  const id = host === 'youtu.be' ? url.pathname.slice(1) : url.searchParams.get('v') || url.pathname.match(/^\/embed\/([^/]+)/)?.[1];
  if (!/^[\w-]{11}$/.test(id || '')) return null;
  const time = url.searchParams.get('start') || url.searchParams.get('t') || '0';
  const match = time.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  const seconds = /^\d+$/.test(time) ? Number(time) : match ? Number(match[1] || 0)*3600 + Number(match[2] || 0)*60 + Number(match[3] || 0) : 0;
  return `https://www.youtube-nocookie.com/embed/${id}?start=${seconds}&rel=0`;
}
export function createStoryVideo({$,t,pauseAudio}) {
  function stopStoryVideo() {
    $('detail-body').querySelectorAll('iframe').forEach(frame => frame.replaceWith(frame.storyPlayButton));
  }
  function addStoryVideo(body, data) {
    (data.videos || []).forEach((video, index) => {
      const section = document.createElement('section'); section.className = 'story-video';
      const title = document.createElement('h4'); title.textContent = `${String(index+1).padStart(2,'0')} / ${video.title}`;
      const play = document.createElement('button'); play.className = 'video-poster'; play.textContent = `▶  ${t('watchVideo')}`;
      const link = document.createElement('a'); link.href = video.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = t('openVideo');
      section.append(title, play, link); body.append(section);
      play.addEventListener('click', () => {
        const embed = youtubeEmbed(video.url); if (!embed) return;
        stopStoryVideo(); pauseAudio();
        const frame = document.createElement('iframe'); frame.title = video.title; frame.src = embed;
        frame.allow = 'fullscreen; picture-in-picture'; frame.allowFullscreen = true;
        frame.referrerPolicy = 'strict-origin-when-cross-origin'; frame.storyPlayButton = play; play.replaceWith(frame);
      });
    });
  }
  return { stopStoryVideo, addStoryVideo };
}
