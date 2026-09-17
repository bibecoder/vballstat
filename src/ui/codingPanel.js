import { SKILLS, SKILL_ORDER, EVALUATIONS, evalLabel, formatZoneSegment } from '../scouting/codes.js';
import { formatTimecode } from '../video/videoSource.js';
import { exportDVW, importDVW } from '../scouting/dvwFormat.js';

export function mountCodingPanel(root, { actionCoder, actionLog, roster, videoSource, scoreboard }) {
  root.innerHTML = `
    <div class="panel-header">Live Coding</div>

    <div class="buffer-display">
      <span class="buffer-team">_</span>
      <span class="buffer-number">__</span>
      <span class="buffer-skill">_</span>
      <span class="buffer-zone"></span>
      <span class="buffer-hint"></span>
    </div>
    <div class="suggest-row" hidden>
      <span class="suggest-label">Likely next:</span>
      <span class="suggest-chips"></span>
    </div>

    <div class="legend">
      <div class="legend-group">
        <strong>Team</strong>
        <span><kbd>H</kbd> Home</span>
        <span><kbd>A</kbd> Away</span>
      </div>
      <div class="legend-group">
        <strong>Skill</strong>
        ${SKILL_ORDER.map((s) => `<span><kbd>${s}</kbd> ${SKILLS[s].name}</span>`).join('')}
      </div>
      <div class="legend-group">
        <strong>Zone (optional)</strong>
        <span><kbd>1-9</kbd> target zone</span>
        <span><kbd>a-d</kbd> quadrant</span>
        <span><kbd>&gt;</kbd> from&gt;to trajectory</span>
      </div>
      <div class="legend-group">
        <strong>Evaluation</strong>
        ${EVALUATIONS.map((e) => `<span><kbd>${e}</kbd> ${evalLabel('*', e) || e}</span>`).join('')}
      </div>
      <div class="legend-group">
        <strong>Control</strong>
        <span><kbd>Backspace</kbd> step back</span>
        <span><kbd>Esc</kbd> clear</span>
        <span><kbd>Ctrl+Z</kbd> undo last</span>
      </div>
    </div>

    <div class="log-header">
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

  const bufferTeam = root.querySelector('.buffer-team');
  const bufferNumber = root.querySelector('.buffer-number');
  const bufferSkill = root.querySelector('.buffer-skill');
  const bufferZone = root.querySelector('.buffer-zone');
  const bufferHint = root.querySelector('.buffer-hint');
  const suggestRow = root.querySelector('.suggest-row');
  const suggestChips = root.querySelector('.suggest-chips');
  const tbody = root.querySelector('.log-table tbody');

  function renderBuffer(state) {
    bufferTeam.textContent = state.team ? (state.team === 'home' ? 'H' : 'A') : '_';
    bufferTeam.classList.toggle('filled', !!state.team);

    bufferNumber.textContent = state.numberBuffer ? state.numberBuffer.padStart(2, '_') : '__';
    bufferNumber.classList.toggle('filled', state.numberBuffer.length > 0);

    bufferSkill.textContent = state.skill || '_';
    bufferSkill.classList.toggle('filled', !!state.skill);

    const zoneSeg = formatZoneSegment(state.fromZone, state.fromSubzone, state.zoneDigits, state.subzone);
    bufferZone.textContent = zoneSeg;
    bufferZone.classList.toggle('filled', zoneSeg.length > 0);

    if (!state.team) bufferHint.textContent = 'Press H or A to start coding an action…';
    else if (!state.numberBuffer) bufferHint.textContent = 'Type player number, or click a suggested player / roster row…';
    else if (!state.skill) bufferHint.textContent = 'Press a skill key (S R E A B D F)…';
    else bufferHint.textContent = 'Optional: zone digit(s), a-d quadrant, > for trajectory — or click the court. Then an evaluation key (# + ! - / =) to commit…';

    renderSuggestions(state);
  }

  function renderSuggestions(state) {
    if (!state.team || state.numberBuffer) {
      suggestRow.hidden = true;
      return;
    }
    const counts = new Map();
    actionLog.list().forEach((a) => {
      if (a.team !== state.team) return;
      counts.set(a.playerNumber, (counts.get(a.playerNumber) || 0) + 1);
    });
    const top = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    if (top.length === 0) {
      suggestRow.hidden = true;
      return;
    }
    suggestRow.hidden = false;
    suggestChips.innerHTML = top
      .map(([number]) => `<button class="suggest-chip" data-number="${number}">#${number} ${roster.displayName(state.team, number)}</button>`)
      .join('');
    suggestChips.querySelectorAll('.suggest-chip').forEach((btn) => {
      btn.addEventListener('click', () => actionCoder.selectPlayer(state.team, Number(btn.dataset.number)));
    });
  }

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

  actionCoder.onChange(renderBuffer);
  actionLog.onChange(renderLog);
  actionLog.onChange(() => renderSuggestions(actionCoder.state()));
  roster.onChange(() => renderSuggestions(actionCoder.state()));
  renderBuffer(actionCoder.state());
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
