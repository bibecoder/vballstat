import { SKILLS, SKILL_ORDER, EVALUATIONS, evalLabel } from '../scouting/codes.js';
import { formatTimecode } from '../video/videoSource.js';

export function mountCodingPanel(root, { actionCoder, actionLog, roster, videoSource }) {
  root.innerHTML = `
    <div class="panel-header">Live Coding</div>

    <div class="buffer-display">
      <span class="buffer-team">_</span>
      <span class="buffer-number">__</span>
      <span class="buffer-skill">_</span>
      <span class="buffer-hint"></span>
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
  const bufferHint = root.querySelector('.buffer-hint');
  const tbody = root.querySelector('.log-table tbody');

  function renderBuffer(state) {
    bufferTeam.textContent = state.team ? (state.team === 'home' ? 'H' : 'A') : '_';
    bufferTeam.classList.toggle('filled', !!state.team);

    bufferNumber.textContent = state.numberBuffer ? state.numberBuffer.padStart(2, '_') : '__';
    bufferNumber.classList.toggle('filled', state.numberBuffer.length > 0);

    bufferSkill.textContent = state.skill || '_';
    bufferSkill.classList.toggle('filled', !!state.skill);

    if (!state.team) bufferHint.textContent = 'Press H or A to start coding an action…';
    else if (!state.numberBuffer) bufferHint.textContent = 'Type player number…';
    else if (!state.skill) bufferHint.textContent = 'Press a skill key (S R E A B D F)…';
    else bufferHint.textContent = 'Press an evaluation key (# + ! - / =) to commit…';
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
  root.querySelector('[data-action="export-csv"]').addEventListener('click', () => download('scouting-log.csv', actionLog.toCSV(), 'text/csv'));
  root.querySelector('[data-action="export-json"]').addEventListener('click', () => download('scouting-log.json', actionLog.toJSON(), 'application/json'));

  actionCoder.onChange(renderBuffer);
  actionLog.onChange(renderLog);
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
