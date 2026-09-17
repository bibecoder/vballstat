import { evalLabel } from '../scouting/codes.js';
import { RALLY_EXAMPLE } from '../scouting/rallyParser.js';

// The "typebox" workflow: type the whole rally as one line while
// replaying it from memory (or pausing the video), see it parse live as
// chips, then commit the whole point in one shot.
export function mountRallyPanel(root, { rallyCommitter, roster }) {
  root.innerHTML = `
    <div class="panel-header">Rally Line Input</div>
    <p class="rally-hint">Type the whole point, then press <kbd>Enter</kbd>. Actions can be separated by
      <code>;</code> or spaces; end with <code>Point H</code> / <code>Point A</code> to award the point.</p>
    <input type="text" class="rally-input" placeholder="${RALLY_EXAMPLE}" autocomplete="off" spellcheck="false" />
    <div class="rally-preview" data-empty="Nothing parsed yet — start typing…"></div>
    <div class="rally-errors"></div>
    <div class="rally-actions">
      <button class="rally-example">Fill example</button>
      <button class="rally-commit btn-primary">Commit rally</button>
    </div>
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
        const zone = a.zone ? ` @${a.zone}` : '';
        return `<span class="rally-chip eval-${evalClass(a.evaluation)}" title="${escapeHtml(evalLabel(a.skill, a.evaluation))}">
          ${escapeHtml(team)} #${a.playerNumber} ${a.skillName}${zone} ${a.evaluation}
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

  roster.onChange(renderPreview);
  renderPreview();
}

function evalClass(char) {
  return { '#': 'perfect', '+': 'positive', '!': 'ok', '-': 'negative', '/': 'poor', '=': 'error' }[char] || '';
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
