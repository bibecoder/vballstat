import { COURT_ZONES, evalLabel } from '../scouting/codes.js';

// Court-zone visualizer: plots the target zone of every located action
// (serve/set/attack "LocationN" in the rally notation) from the most
// recently committed rally, on the standard DataVolley 3x3 target grid.
const SKILL_COLOR = {
  S: '#4fb3ff', // serve
  E: '#c084fc', // set
  A: '#ff5470', // attack
  R: '#35d07f',
  B: '#f2c94c',
  D: '#e39a4f',
  F: '#8b95ac',
};

export function mountVisualizerPanel(root, { rallyCommitter, roster }) {
  root.innerHTML = `
    <div class="panel-header">Court Visualizer <span class="viz-caption">last committed rally</span></div>
    <svg class="court-svg" viewBox="0 0 300 300" role="img" aria-label="Volleyball court target-zone diagram">
      <rect x="2" y="2" width="296" height="296" fill="none" stroke="var(--panel-border)" stroke-width="2"/>
      <line x1="2" y1="2" x2="298" y2="2" stroke="var(--accent)" stroke-width="4"/>
      ${gridLines()}
      ${zoneLabels()}
      <g class="court-markers"></g>
    </svg>
    <div class="viz-legend"></div>
    <div class="viz-empty">Net at top. Commit a rally with a <code>LocationN</code> zone to see it plotted.</div>
  `;

  const markersLayer = root.querySelector('.court-markers');
  const legend = root.querySelector('.viz-legend');
  const empty = root.querySelector('.viz-empty');

  function zoneCenter(zone) {
    for (let r = 0; r < 3; r++) {
      const c = COURT_ZONES[r].indexOf(zone);
      if (c !== -1) return { x: c * 100 + 50, y: r * 100 + 50 };
    }
    return null;
  }

  function render(actions) {
    const located = actions.filter((a) => a.zone);
    markersLayer.innerHTML = located
      .map((a, i) => {
        const p = zoneCenter(a.zone);
        if (!p) return '';
        const color = SKILL_COLOR[a.skill] || '#8b95ac';
        const label = `${a.team === 'home' ? roster.teamName('home') : roster.teamName('away')} #${a.playerNumber} ${a.skillName} — ${evalLabel(a.skill, a.evaluation)} (zone ${a.zone})`;
        // Slight offset so multiple markers in the same zone don't fully overlap.
        const dx = (i % 3) * 8 - 8;
        const dy = Math.floor(i / 3) * 8 - 8;
        return `<g class="court-marker">
          <circle cx="${p.x + dx}" cy="${p.y + dy}" r="9" fill="${color}" stroke="#0e1117" stroke-width="1.5" opacity="0.9">
            <title>${escapeXml(label)}</title>
          </circle>
          <text x="${p.x + dx}" y="${p.y + dy + 3}" text-anchor="middle" font-size="8" fill="#0e1117" font-weight="700" pointer-events="none">${a.playerNumber}</text>
        </g>`;
      })
      .join('');

    empty.style.display = located.length ? 'none' : 'block';

    const usedSkills = Array.from(new Set(located.map((a) => a.skill)));
    legend.innerHTML = usedSkills
      .map((s) => `<span class="viz-legend-item"><span class="viz-dot" style="background:${SKILL_COLOR[s]}"></span>${skillLabel(s)}</span>`)
      .join('');
  }

  rallyCommitter.onCommit((actions) => render(actions));
  render(rallyCommitter.lastCommitted);
}

function skillLabel(code) {
  return { S: 'Serve', R: 'Reception', E: 'Set', A: 'Attack', B: 'Block', D: 'Dig', F: 'Freeball' }[code] || code;
}

function gridLines() {
  let s = '';
  for (let i = 1; i < 3; i++) {
    s += `<line x1="${i * 100}" y1="0" x2="${i * 100}" y2="300" stroke="var(--panel-border)" stroke-width="1"/>`;
    s += `<line x1="0" y1="${i * 100}" x2="300" y2="${i * 100}" stroke="var(--panel-border)" stroke-width="1"/>`;
  }
  return s;
}

function zoneLabels() {
  let s = '';
  const rows = [
    [4, 3, 2],
    [7, 8, 9],
    [5, 6, 1],
  ];
  rows.forEach((row, r) => {
    row.forEach((zone, c) => {
      s += `<text x="${c * 100 + 8}" y="${r * 100 + 20}" font-size="13" fill="var(--text-dim)" font-family="Consolas, monospace">${zone}</text>`;
    });
  });
  return s;
}

function escapeXml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
