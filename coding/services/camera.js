// Default rear lens with a practical capture request. No saved lens choice or optical zoom.
export function createCameraService() {
  let stream = null, request = 0;
  function release() {
    request++;
    stream?.getTracks().forEach(track => track.stop());
    stream = null;
  }
  async function open(cancelled = () => false) {
    release();
    const ticket = request;
    let candidate;
    try {
      candidate = await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30,max:30}}});
    } catch(error) {
      if(error.name!=='OverconstrainedError')throw error;
      if(cancelled()||ticket!==request)throw new DOMException('Camera request cancelled','AbortError');
      candidate = await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:'environment'}});
    }
    if (cancelled() || ticket !== request) {
      candidate.getTracks().forEach(track => track.stop());
      throw new DOMException('Camera request cancelled','AbortError');
    }
    stream = candidate;
    const track=stream.getVideoTracks?.()[0];
    try {
      if(track?.getCapabilities?.().focusMode?.includes('continuous'))await track.applyConstraints({advanced:[{focusMode:'continuous'}]});
    } catch {} // Autofocus is optional; retain the working stream if unsupported.
    if(cancelled()||ticket!==request){candidate.getTracks().forEach(track=>track.stop());throw new DOMException('Camera request cancelled','AbortError');}
    return stream;
  }
  return {open,release};
}
