// Unified "live video feed" abstraction over two sources:
//   - a real live webcam feed (getUserMedia), clocked by an internal timer
//   - a loaded local video file, clocked by the <video> element's own currentTime
//
// Whichever is active, the rest of the app only ever calls currentTime()
// to timestamp an action — exactly the role the video transport clock
// plays in DataVolley/VolleyStation scouting.

export class VideoSource {
  constructor(videoEl) {
    this.videoEl = videoEl;
    this.mode = null; // 'webcam' | 'file'
    this.stream = null;

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
    this._emit();
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
    this.mode = null;
    this._clockRunning = false;
    this._clockAccumulated = 0;
  }

  // Seconds elapsed on whichever clock is authoritative right now.
  currentTime() {
    if (this.mode === 'file') {
      return this.videoEl.currentTime || 0;
    }
    if (this.mode === 'webcam') {
      const live = this._clockRunning ? (performance.now() - this._clockStartedAt) / 1000 : 0;
      return this._clockAccumulated + live;
    }
    return 0;
  }

  status() {
    return {
      mode: this.mode,
      clockRunning: this.mode === 'file' ? !this.videoEl.paused : this._clockRunning,
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
