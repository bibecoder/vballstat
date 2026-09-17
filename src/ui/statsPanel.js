import { SKILL_ORDER, SKILLS } from '../scouting/codes.js';

// Renders the live-updating DataVolley-style stats table: per team,
// per player, attempts + efficiency metrics for every skill that has
// at least one recorded attempt (plus a team totals row).

export function mountStatsPanel(root, { statsEngine, actionLog, roster }) {
  root.innerHTML = `
    <div class="panel-header">Live Stats</div>
    <div class="stats-scroll"></div>
  `;
  const container = root.querySelector('.stats-scroll');

  function render() {
    const stats = statsEngine.compute(actionLog.list(), roster);
    container.innerHTML = renderTeam(stats.home) + renderTeam(stats.away);
  }

  actionLog.onChange(render);
  roster.onChange(render);
  render();
}

function usedSkills(breakdown) {
  return SKILL_ORDER.filter((s) => breakdown.counts[s].total > 0);
}

function renderTeam(team) {
  const rows = team.players
    .map((p) => renderPlayerRow(p))
    .join('');

  return `
    <table class="stats-table">
      <caption>${escapeHtml(team.name)}</caption>
      <thead>
        <tr>
          <th>#</th><th>Player</th><th>Skill</th><th>Att</th>
          <th>#</th><th>+</th><th>!</th><th>-</th><th>/</th><th>=</th>
          <th>Perfect%</th><th>Positive%</th><th>Error%</th><th>Eff%</th>
        </tr>
      </thead>
      <tbody>${rows}${renderTotalsRow(team)}</tbody>
    </table>
  `;
}

function renderPlayerRow(player) {
  const skills = usedSkills(player.skills);
  if (skills.length === 0) {
    return `
      <tr class="player-row player-row-empty">
        <td>${player.number}</td><td>${escapeHtml(player.name)}</td>
        <td colspan="12" class="no-attempts">no attempts yet</td>
      </tr>`;
  }
  return skills
    .map((skillCode, i) => {
      const c = player.skills.counts[skillCode];
      const m = player.skills.metrics[skillCode];
      return `
      <tr class="player-row">
        ${i === 0 ? `<td rowspan="${skills.length}">${player.number}</td><td rowspan="${skills.length}">${escapeHtml(player.name)}</td>` : ''}
        <td>${SKILLS[skillCode].name}</td>
        <td>${m.total}</td>
        <td>${c['#']}</td><td>${c['+']}</td><td>${c['!']}</td><td>${c['-']}</td><td>${c['/']}</td><td>${c['=']}</td>
        <td>${fmt(m.perfectPct)}</td>
        <td>${fmt(m.positivePct)}</td>
        <td>${fmt(m.errorPct)}</td>
        <td class="${m.efficiency >= 0 ? 'eff-pos' : 'eff-neg'}">${fmt(m.efficiency)}</td>
      </tr>`;
    })
    .join('');
}

function renderTotalsRow(team) {
  const skills = usedSkills(team.totals);
  if (skills.length === 0) {
    return `<tr class="team-totals-row"><td colspan="14">no attempts yet</td></tr>`;
  }
  return skills
    .map((skillCode, i) => {
      const c = team.totals.counts[skillCode];
      const m = team.totals.metrics[skillCode];
      return `
      <tr class="team-totals-row">
        ${i === 0 ? `<td colspan="2" rowspan="${skills.length}">TEAM TOTAL</td>` : ''}
        <td>${SKILLS[skillCode].name}</td>
        <td>${m.total}</td>
        <td>${c['#']}</td><td>${c['+']}</td><td>${c['!']}</td><td>${c['-']}</td><td>${c['/']}</td><td>${c['=']}</td>
        <td>${fmt(m.perfectPct)}</td>
        <td>${fmt(m.positivePct)}</td>
        <td>${fmt(m.errorPct)}</td>
        <td class="${m.efficiency >= 0 ? 'eff-pos' : 'eff-neg'}">${fmt(m.efficiency)}</td>
      </tr>`;
    })
    .join('');
}

function fmt(n) {
  return `${n.toFixed(0)}%`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
