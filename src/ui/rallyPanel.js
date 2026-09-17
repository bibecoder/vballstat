import { SKILLS, SKILL_ORDER, EVALUATIONS, evalLabel, formatZoneSegment } from '../scouting/codes.js';
import { RALLY_EXAMPLE } from '../scouting/rallyParser.js';

// The sole manual text-entry workflow now that the keystroke-by-keystroke
// buffer is gone: type the whole rally as one line while replaying it
// from memory (or pausing the video), see it parse live as chips, then
// commit the whole point in one shot. Roster clicks and court clicks
// (see rosterPanel.js / visualizerPanel.js) assist by inserting a token
// at the cursor via the returned insertAtCursor API, rather than filling
// a separate buffer.
export function mountRallyPanel(root, { rallyCommitter, roster }) {
  root.innerHTML = `
    <div class="panel-header">Rally Line Input</div>
    <p class="rally-hint"><code>Team</code><code>Player#</code><code>Skill</code><code>[From&gt;]Zone[Subzone]</code><code>Eval</code>
      — e.g. <code>H13S3&gt;5a+</code> (serve from zone 3 to zone 5, near-left quadrant). Separate actions with <code>;</code> or spaces; end with <code>Point H</code> / <code>Point A</code>.
      Click a roster player or a court zone to insert it at the cursor.</p>
    <input type="text" class="rally-input" placeholder="${RALLY_EXAMPLE}" autocomplete="off" spellcheck="false" />
    <div class="rally-preview" data-empty="Nothing parsed yet — start typing…"></div>
    <div class="rally-errors"></div>
    <div class="rally-actions">
      <button class="rally-example">Fill example</button>
      <button class="rally-commit btn-primary">Commit rally</button>
    </div>

    <details class="legend-details">
      <summary>Show code reference</summary>
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
          <span><kbd>Enter</kbd> commit rally</span>
          <span><kbd>Ctrl+Z</kbd> undo last</span>
        </div>
      </div>
    </details>
  `;

  const input = root.querySelector('.rally-input');
  const preview = root.querySelector('.rally-preview');
  const errorsEl = root.querySelector('.rally-errors');
  const commitBtn = root.querySelector('.rally-commit');

  function renderPreview() {
    const line = input.value;
    if (!line.trim()) {
      preview.innerHTML = `<span class="rally-empty">${preview.dataset.empty}</span>`;
      errorsEl.innerHTML = '';
      commitBtn.disabled = true;
      return;
    }

    const parsed = rallyCommitter.preview(line);

    preview.innerHTML = parsed.actions
      .map((a) => {
        const team = a.team === 'home' ? roster.teamName('home') : roster.teamName('away');
        const zoneSeg = formatZoneSegment(a.fromZone, a.fromSubzone, a.zone, a.subzone);
        return `<span class="rally-chip eval-${evalClass(a.evaluation)}" title="${escapeHtml(evalLabel(a.skill, a.evaluation))}">
          ${escapeHtml(team)} #${a.playerNumber} ${a.skillName}${zoneSeg ? ' @' + zoneSeg : ''} ${a.evaluation}
        </span>`;
      })
      .join('') + (parsed.pointTeam ? `<span class="rally-chip rally-point">Point → ${escapeHtml(roster.teamName(parsed.pointTeam))}</span>` : '');

    if (parsed.actions.length === 0 && !parsed.pointTeam) {
      preview.innerHTML = `<span class="rally-empty">${preview.dataset.empty}</span>`;
    }

    errorsEl.innerHTML = parsed.errors
      .map((e) => `<div class="rally-error">⚠ ${escapeHtml(e.message)}</div>`)
      .join('');

    commitBtn.disabled = parsed.errors.length > 0 || parsed.actions.length === 0;
  }

  input.addEventListener('input', renderPreview);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!commitBtn.disabled) doCommit();
    }
  });

  root.querySelector('.rally-example').addEventListener('click', () => {
    input.value = RALLY_EXAMPLE;
    renderPreview();
    input.focus();
  });

  commitBtn.addEventListener('click', doCommit);

  function doCommit() {
    const parsed = rallyCommitter.commit(input.value);
    if (parsed.errors.length === 0 && parsed.actions.length > 0) {
      input.value = '';
      renderPreview();
      input.focus();
    }
  }

  // Inserts text at the current caret position (replacing any selection),
  // used by roster-row clicks ("H13") and court-zone clicks ("5a").
  function insertAtCursor(text) {
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    input.value = input.value.slice(0, start) + text + input.value.slice(end);
    const caret = start + text.length;
    input.focus();
    input.setSelectionRange(caret, caret);
    renderPreview();
  }

  roster.onChange(renderPreview);
  renderPreview();

  return { insertAtCursor };
}

function evalClass(char) {
  return { '#': 'perfect', '+': 'positive', '!': 'ok', '-': 'negative', '/': 'poor', '=': 'error' }[char] || '';
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
