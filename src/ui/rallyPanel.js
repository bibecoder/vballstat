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
    <p class="rally-hint"><code>Team</code><code>Player#</code><code>Skill</code><code>[From&gt;/-]Zone[Subzone]</code><code>Eval</code>
      — e.g. <code>H13S6-8a+</code> (serve: started at position 6, landed at zone 8, near-left quadrant) or <code>H7A3&gt;2a#</code> (attack from zone 3 to zone 2, near-left). Separate actions with <code>;</code> or spaces; end with <code>HP</code> / <code>AP</code> to award the point.
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
          <span><kbd>&gt;</kbd> from&gt;to (attack, etc.)</span>
          <span><kbd>-</kbd> start-end (serve)</span>
        </div>
        <div class="legend-group">
          <strong>Evaluation</strong>
          ${EVALUATIONS.map((e) => `<span><kbd>${e}</kbd> ${evalLabel('*', e) || e}</span>`).join('')}
        </div>
        <div class="legend-group">
          <strong>Control</strong>
          <span><kbd>HP</kbd> / <kbd>AP</kbd> award point</span>
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
        const zoneSeg = formatZoneSegment(a.fromZone, a.fromSubzone, a.zone, a.subzone, a.skill);
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

  // Sniffs the skill letter of the token currently being typed (the
  // word the cursor sits in, using the same ';'/whitespace tokenizer as
  // rallyParser.js) so a court drag/click-pair can pick the right
  // separator — "-" for a serve's start-end, ">" for everything else's
  // from>to — without the court needing to track skill state itself.
  function currentSkillAtCursor() {
    const pos = input.selectionStart ?? input.value.length;
    const before = input.value.slice(0, pos);
    const tokenStart = Math.max(before.lastIndexOf(';'), before.lastIndexOf(' ')) + 1;
    const token = before.slice(tokenStart);
    const m = /^[HA]\d{1,2}([SREABDF])/i.exec(token);
    return m ? m[1].toUpperCase() : null;
  }

  // Inserts a full origin+target zone segment at the cursor, used by a
  // court drag or click-to-start/click-to-end gesture (see
  // visualizerPanel.js) — the two-point counterpart to insertAtCursor's
  // single-zone click.
  function insertZonePair(fromZone, fromSubzone, zone, subzone) {
    insertAtCursor(formatZoneSegment(fromZone, fromSubzone, zone, subzone, currentSkillAtCursor()));
  }

  roster.onChange(renderPreview);
  renderPreview();

  return { insertAtCursor, insertZonePair };
}

function evalClass(char) {
  return { '#': 'perfect', '+': 'positive', '!': 'ok', '-': 'negative', '/': 'poor', '=': 'error' }[char] || '';
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
