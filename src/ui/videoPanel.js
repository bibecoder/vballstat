import { formatTimecode, parseYouTubeId } from '../video/videoSource.js';

// A video a coach can point the app at as reference footage without
// downloading it first — "Load reference clip" loads this one directly;
// the URL/ID field above it accepts any other YouTube link the same way.
const REFERENCE_YOUTUBE_ID = 'wcmy4t1WINw';

export function mountVideoPanel(root, { videoSource, videoEl, youtubeContainerEl }) {
  root.innerHTML = `
    <div class="panel-header">Live Video Feed</div>
    <div class="video-frame"></div>
    <div class="video-controls">
      <button data-action="webcam">Use Webcam (live)</button>
      <label class="file-btn">
        Load Video File
        <input type="file" accept="video/*" data-action="file" hidden />
      </label>
      <div class="clock-controls" data-webcam-only>
        <button data-action="start-clock">▶ Start match clock</button>
        <button data-action="pause-clock">⏸ Pause</button>
        <button data-action="reset-clock">⟲ Reset</button>
      </div>
    </div>
    <div class="youtube-controls">
      <input type="text" class="youtube-url" placeholder="Paste a YouTube link" />
      <button data-action="youtube-load">Load YouTube</button>
      <button data-action="youtube-reference">Load reference clip</button>
    </div>
    <div class="video-error" data-youtube-error hidden></div>
    <div class="timecode">
      <span class="timecode-value">00:00.0</span>
      <span class="timecode-mode"></span>
    </div>
    <div class="video-label"></div>
  `;

  const videoFrame = root.querySelector('.video-frame');
  videoFrame.appendChild(videoEl);
  videoEl.controls = false;
  videoEl.classList.add('video-el');
  videoFrame.appendChild(youtubeContainerEl);
  youtubeContainerEl.classList.add('youtube-frame');
  youtubeContainerEl.hidden = true;

  const timecodeValue = root.querySelector('.timecode-value');
  const timecodeMode = root.querySelector('.timecode-mode');
  const videoLabel = root.querySelector('.video-label');
  const webcamOnly = root.querySelector('[data-webcam-only]');
  const youtubeUrlInput = root.querySelector('.youtube-url');
  const youtubeError = root.querySelector('[data-youtube-error]');
  const youtubeLoadBtn = root.querySelector('[data-action="youtube-load"]');
  const youtubeReferenceBtn = root.querySelector('[data-action="youtube-reference"]');

  root.querySelector('[data-action="webcam"]').addEventListener('click', async () => {
    try {
      await videoSource.useWebcam();
    } catch (err) {
      alert('Could not access webcam: ' + err.message);
    }
  });

  root.querySelector('[data-action="file"]').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      videoSource.useFile(file);
      videoEl.controls = true; // scrub/play like reviewing a recorded match
    }
  });

  root.querySelector('[data-action="start-clock"]').addEventListener('click', () => videoSource.startClock());
  root.querySelector('[data-action="pause-clock"]').addEventListener('click', () => videoSource.pauseClock());
  root.querySelector('[data-action="reset-clock"]').addEventListener('click', () => videoSource.resetClock());

  async function loadYouTube(videoId, label) {
    youtubeError.hidden = true;
    youtubeLoadBtn.disabled = true;
    youtubeReferenceBtn.disabled = true;
    try {
      await videoSource.useYouTube(videoId, label);
    } catch (err) {
      youtubeError.hidden = false;
      youtubeError.textContent = 'Could not load that YouTube video: ' + err.message;
    } finally {
      youtubeLoadBtn.disabled = false;
      youtubeReferenceBtn.disabled = false;
    }
  }

  youtubeLoadBtn.addEventListener('click', () => {
    const id = parseYouTubeId(youtubeUrlInput.value);
    if (!id) {
      youtubeError.hidden = false;
      youtubeError.textContent = 'Could not read a video ID from that link.';
      return;
    }
    loadYouTube(id);
  });

  youtubeReferenceBtn.addEventListener('click', () => {
    youtubeUrlInput.value = `https://www.youtube.com/watch?v=${REFERENCE_YOUTUBE_ID}`;
    loadYouTube(REFERENCE_YOUTUBE_ID, `YouTube reference clip (${REFERENCE_YOUTUBE_ID})`);
  });

  function render(status) {
    timecodeValue.textContent = formatTimecode(status.currentTime);
    timecodeMode.textContent = status.mode
      ? status.mode === 'webcam'
        ? status.clockRunning ? 'LIVE — clock running' : 'LIVE — clock paused'
        : status.mode === 'youtube'
        ? status.clockRunning ? 'YOUTUBE — playing' : 'YOUTUBE — paused'
        : 'FILE PLAYBACK'
      : 'no source';
    webcamOnly.style.display = status.mode === 'webcam' ? 'flex' : 'none';
    videoEl.controls = status.mode === 'file';
    videoEl.hidden = status.mode === 'youtube';
    youtubeContainerEl.hidden = status.mode !== 'youtube';
    videoLabel.textContent = status.label ? `Source: ${status.label}` : '';
  }

  videoSource.onChange(render);
  // Keep the timecode ticking smoothly during live playback/clock.
  setInterval(() => render(videoSource.status()), 100);
  render(videoSource.status());
}
