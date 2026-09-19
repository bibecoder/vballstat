// Unified "live video feed" abstraction over three sources:
//   - a real live webcam feed (getUserMedia), clocked by an internal timer
//   - a loaded local video file, clocked by the <video> element's own currentTime
//   - an embedded YouTube video (game film shared as a link rather than a
//     file), clocked by the YouTube IFrame Player's own currentTime
//
// Whichever is active, the rest of the app only ever calls currentTime()
// to timestamp an action — exactly the role the video transport clock
// plays in DataVolley/VolleyStation scouting.

export class VideoSource {
  constructor(videoEl, youtubeContainerEl) {
    this.videoEl = videoEl;
    this.youtubeContainerEl = youtubeContainerEl;
    this.mode = null; // 'webcam' | 'file' | 'youtube'
    this.stream = null;
    this.label = null; // human-readable reference: filename, video title, or 'webcam (live)'
    this.ytPlayer = null;

    // Manual match clock used for the webcam (live) case.
    this._clockRunning = false;
    this._clockStartedAt = 0; // performance.now() at last start
    this._clockAccumulated = 0; // seconds banked from previous start/stop spans

    this._listeners = [];
  }

  onChange(fn) {
    this._listeners.push(fn);
  }

  _emit() {
    this._listeners.forEach((fn) => fn(this.status()));
  }

  async useWebcam() {
    this.stop();
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    this.stream = stream;
    this.videoEl.srcObject = stream;
    this.videoEl.muted = true;
    await this.videoEl.play();
    this.mode = 'webcam';
    this.label = 'webcam (live)';
    this._clockRunning = false;
    this._clockAccumulated = 0;
    this._emit();
  }

  useFile(file) {
    this.stop();
    const url = URL.createObjectURL(file);
    this.videoEl.srcObject = null;
    this.videoEl.src = url;
    this.videoEl.muted = false;
    this.mode = 'file';
    this.label = file.name;
    this._emit();
  }

  // Embeds game film shared as a YouTube link rather than a local file,
  // via YouTube's own IFrame Player API (loaded on demand) so the app
  // can still read a real playback clock (getCurrentTime()) from it,
  // the same way it reads .currentTime off the native <video> element
  // for a local file.
  useYouTube(videoId, label) {
    this.stop();
    return loadYouTubeIframeAPI().then(
      () =>
        new Promise((resolve, reject) => {
          this.youtubeContainerEl.innerHTML = '';
          const mount = document.createElement('div');
          this.youtubeContainerEl.appendChild(mount);
          this.ytPlayer = new window.YT.Player(mount, {
            videoId,
            width: '100%',
            height: '100%',
            playerVars: { playsinline: 1, rel: 0 },
            events: {
              onReady: () => {
                this.mode = 'youtube';
                this.label = label || `YouTube video ${videoId}`;
                this._emit();
                resolve();
              },
              onError: (e) => reject(new Error(`YouTube player error (code ${e.data})`)),
            },
          });
        })
    );
  }

  // --- manual match clock (webcam / live mode only) ---
  startClock() {
    if (this.mode !== 'webcam' || this._clockRunning) return;
    this._clockRunning = true;
    this._clockStartedAt = performance.now();
    this._emit();
  }

  pauseClock() {
    if (this.mode !== 'webcam' || !this._clockRunning) return;
    this._clockAccumulated += (performance.now() - this._clockStartedAt) / 1000;
    this._clockRunning = false;
    this._emit();
  }

  resetClock() {
    this._clockRunning = false;
    this._clockAccumulated = 0;
    this._emit();
  }

  stop() {
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    if (this.ytPlayer) {
      this.ytPlayer.destroy();
      this.ytPlayer = null;
      if (this.youtubeContainerEl) this.youtubeContainerEl.innerHTML = '';
    }
    this.mode = null;
    this.label = null;
    this._clockRunning = false;
    this._clockAccumulated = 0;
  }

  // Seconds elapsed on whichever clock is authoritative right now.
  currentTime() {
    if (this.mode === 'file') {
      return this.videoEl.currentTime || 0;
    }
    if (this.mode === 'youtube') {
      return (this.ytPlayer && this.ytPlayer.getCurrentTime && this.ytPlayer.getCurrentTime()) || 0;
    }
    if (this.mode === 'webcam') {
      const live = this._clockRunning ? (performance.now() - this._clockStartedAt) / 1000 : 0;
      return this._clockAccumulated + live;
    }
    return 0;
  }

  status() {
    let clockRunning;
    if (this.mode === 'file') clockRunning = !this.videoEl.paused;
    else if (this.mode === 'youtube') clockRunning = !!this.ytPlayer && this.ytPlayer.getPlayerState() === window.YT.PlayerState.PLAYING;
    else clockRunning = this._clockRunning;
    return {
      mode: this.mode,
      label: this.label,
      clockRunning,
      currentTime: this.currentTime(),
    };
  }
}

export function formatTimecode(totalSeconds) {
  const s = Math.max(0, totalSeconds);
  const mm = Math.floor(s / 60).toString().padStart(2, '0');
  const ss = Math.floor(s % 60).toString().padStart(2, '0');
  const ms = Math.floor((s % 1) * 10);
  return `${mm}:${ss}.${ms}`;
}

// Pulls the 11-character video ID out of whatever shape of YouTube
// link/ID someone pastes: a full watch URL, a youtu.be short link, an
// existing /embed/ URL, or the bare ID itself.
export function parseYouTubeId(input) {
  const s = (input || '').trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  try {
    const url = new URL(s);
    if (url.hostname.includes('youtu.be')) {
      return url.pathname.slice(1).split('/')[0] || null;
    }
    if (url.hostname.includes('youtube.com')) {
      if (url.searchParams.get('v')) return url.searchParams.get('v');
      const match = url.pathname.match(/\/(embed|shorts)\/([\w-]{11})/);
      if (match) return match[2];
    }
  } catch {
    // not a URL at all — fall through to "no match"
  }
  return null;
}

// Lazily injects YouTube's IFrame Player API script (once) and resolves
// once window.YT.Player is actually available — the API loads
// asynchronously and calls a global onYouTubeIframeAPIReady when ready.
let ytApiPromise = null;
function loadYouTubeIframeAPI() {
  if (window.YT && window.YT.Player) return Promise.resolve();
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (previous) previous();
      resolve();
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(script);
  });
  return ytApiPromise;
}
