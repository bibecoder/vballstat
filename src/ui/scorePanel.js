// Renders the shared Scoreboard model. Points can come from the manual
// +/- buttons here, or automatically from a parsed rally line's
// "Point H" / "Point A" (see rallyPanel.js) — both go through the same
// Scoreboard instance so the two stay in sync.

export function mountScorePanel(root, { roster, scoreboard }) {
  function render() {
    const score = scoreboard.score;
    root.innerHTML = `
      <div class="panel-header">Scoreboard <span class="set-label">Set ${score.set}</span></div>
      <div class="score-row">
        <div class="score-team">
          <div class="score-name">${escapeHtml(roster.teamName('home'))}</div>
          <div class="score-value">${score.home}</div>
          <div class="score-buttons">
            <button data-action="home-minus">−</button>
            <button data-action="home-plus">+</button>
          </div>
        </div>
        <div class="score-team">
          <div class="score-name">${escapeHtml(roster.teamName('away'))}</div>
          <div class="score-value">${score.away}</div>
          <div class="score-buttons">
            <button data-action="away-minus">−</button>
            <button data-action="away-plus">+</button>
          </div>
        </div>
      </div>
      <div class="set-buttons">
        <button data-action="new-set">New set</button>
        <button data-action="reset-score">Reset match</button>
      </div>
    `;
    root.querySelector('[data-action="home-plus"]').addEventListener('click', () => scoreboard.bump('home', 1));
    root.querySelector('[data-action="home-minus"]').addEventListener('click', () => scoreboard.bump('home', -1));
    root.querySelector('[data-action="away-plus"]').addEventListener('click', () => scoreboard.bump('away', 1));
    root.querySelector('[data-action="away-minus"]').addEventListener('click', () => scoreboard.bump('away', -1));
    root.querySelector('[data-action="new-set"]').addEventListener('click', () => scoreboard.newSet());
    root.querySelector('[data-action="reset-score"]').addEventListener('click', () => {
      if (confirm('Reset the scoreboard? This does not touch the action log.')) scoreboard.reset();
    });
  }

  roster.onChange(render);
  scoreboard.onChange(render);
  render();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
