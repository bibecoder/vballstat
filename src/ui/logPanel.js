import { evalLabel } from '../scouting/codes.js';
import { formatTimecode } from '../video/videoSource.js';
import { exportDVW, importDVW } from '../scouting/dvwFormat.js';

// Play-by-play log: every committed action (however it was entered —
// Rally Line Input or a court click) plus undo and the CSV/JSON/DVW
// export/import controls. No keyboard buffer of its own; Rally Line
// Input sits directly underneath this panel.
export function mountLogPanel(root, { actionLog, roster, videoSource, scoreboard }) {
  root.innerHTML = `
    <div class="panel-header">
      <span>Play-by-play</span>
      <span class="log-actions">
        <button data-action="undo">Undo last</button>
        <button data-action="export-csv">Export CSV</button>
        <button data-action="export-json">Export JSON</button>
        <button data-action="export-dvw">Export DVW</button>
        <label class="file-btn">
          Import DVW
          <input type="file" accept=".dvw,text/plain" data-action="import-dvw" hidden />
        </label>
      </span>
    </div>
    <div class="log-table-wrap">
      <table class="log-table">
        <thead>
          <tr><th>#</th><th>Time</th><th>Team</th><th>Player</th><th>Skill</th><th>Eval</th><th>Code</th><th></th></tr>
        </thead>
        <tbody></tbody>
      </table>
    </div>
  `;

  const tbody = root.querySelector('.log-table tbody');

  function renderLog(actions) {
    tbody.innerHTML = actions
      .slice()
      .reverse()
      .map(
        (a, i) => `
      <tr data-id="${a.id}">
        <td>${actions.length - i}</td>
        <td>${formatTimecode(a.videoTime)}</td>
        <td>${a.team === 'home' ? roster.teamName('home') : roster.teamName('away')}</td>
        <td>#${a.playerNumber} ${a.playerName}</td>
        <td title="${evalLabel(a.skill, a.evaluation)}">${a.skillName}</td>
        <td class="eval-${evalClass(a.evaluation)}">${a.evaluation}</td>
        <td class="code-cell">${a.code}</td>
        <td><button class="row-remove" data-id="${a.id}">✕</button></td>
      </tr>`
      )
      .join('');

    tbody.querySelectorAll('.row-remove').forEach((btn) => {
      btn.addEventListener('click', () => actionLog.remove(Number(btn.dataset.id)));
    });
  }

  root.querySelector('[data-action="undo"]').addEventListener('click', () => actionLog.undoLast());
  root.querySelector('[data-action="export-csv"]').addEventListener('click', () => download('scouting-log.csv', actionLog.toCSV(videoSource.status().label), 'text/csv'));
  root.querySelector('[data-action="export-json"]').addEventListener('click', () => download('scouting-log.json', actionLog.toJSON(videoSource.status().label), 'application/json'));
  root.querySelector('[data-action="export-dvw"]').addEventListener('click', () => {
    download('scouting-log.dvw', exportDVW({ roster, actionLog, scoreboard, videoSource }), 'text/plain');
  });
  root.querySelector('[data-action="import-dvw"]').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    const result = importDVW(text);
    if (result.errors.length && result.actions.length === 0) {
      alert(`Could not import that file:\n${result.errors.join('\n')}`);
      return;
    }
    roster.replaceAll(result.roster);
    actionLog.replaceAll(result.actions);
    if (result.score) scoreboard.setScore(result.score);
    if (result.errors.length) {
      alert(`Imported with ${result.errors.length} row(s) skipped (unrecognized format):\n${result.errors.slice(0, 5).join('\n')}`);
    }
    e.target.value = '';
  });

  actionLog.onChange(renderLog);
  renderLog(actionLog.list());
}

function evalClass(char) {
  return { '#': 'perfect', '+': 'positive', '!': 'ok', '-': 'negative', '/': 'poor', '=': 'error' }[char] || '';
}

function download(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
