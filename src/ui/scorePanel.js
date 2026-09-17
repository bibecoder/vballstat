// Manual scoreboard for on-screen context while coding. This prototype
// does not infer points from rally outcomes automatically (that needs a
// full rotation/rally-state engine); the analyst bumps it by hand, same
// as a secondary scoreboard clicker alongside DataVolley in practice.

const STORAGE_KEY = 'vballstat.score.v1';

export function mountScorePanel(root, { roster }) {
  let score = load();

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : { home: 0, away: 0, set: 1 };
    } catch (e) {
      return { home: 0, away: 0, set: 1 };
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(score));
    } catch (e) {}
  }

  function render() {
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
    root.querySelector('[data-action="home-plus"]').addEventListener('click', () => bump('home', 1));
    root.querySelector('[data-action="home-minus"]').addEventListener('click', () => bump('home', -1));
    root.querySelector('[data-action="away-plus"]').addEventListener('click', () => bump('away', 1));
    root.querySelector('[data-action="away-minus"]').addEventListener('click', () => bump('away', -1));
    root.querySelector('[data-action="new-set"]').addEventListener('click', () => {
      score = { home: 0, away: 0, set: score.set + 1 };
      save();
      render();
    });
    root.querySelector('[data-action="reset-score"]').addEventListener('click', () => {
      score = { home: 0, away: 0, set: 1 };
      save();
      render();
    });
  }

  function bump(team, delta) {
    score[team] = Math.max(0, score[team] + delta);
    save();
    render();
  }

  roster.onChange(render);
  render();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
