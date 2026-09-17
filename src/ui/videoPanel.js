import { formatTimecode } from '../video/videoSource.js';

export function mountVideoPanel(root, { videoSource, videoEl }) {
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
    <div class="timecode">
      <span class="timecode-value">00:00.0</span>
      <span class="timecode-mode"></span>
    </div>
    <div class="video-label"></div>
  `;

  root.querySelector('.video-frame').appendChild(videoEl);
  videoEl.controls = false;
  videoEl.classList.add('video-el');

  const timecodeValue = root.querySelector('.timecode-value');
  const timecodeMode = root.querySelector('.timecode-mode');
  const videoLabel = root.querySelector('.video-label');
  const webcamOnly = root.querySelector('[data-webcam-only]');

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

  function render(status) {
    timecodeValue.textContent = formatTimecode(status.currentTime);
    timecodeMode.textContent = status.mode
      ? status.mode === 'webcam'
        ? status.clockRunning ? 'LIVE — clock running' : 'LIVE — clock paused'
        : 'FILE PLAYBACK'
      : 'no source';
    webcamOnly.style.display = status.mode === 'webcam' ? 'flex' : 'none';
    videoEl.controls = status.mode === 'file';
    videoLabel.textContent = status.label ? `Source: ${status.label}` : '';
  }

  videoSource.onChange(render);
  // Keep the timecode ticking smoothly during live playback/clock.
  setInterval(() => render(videoSource.status()), 100);
  render(videoSource.status());
}
