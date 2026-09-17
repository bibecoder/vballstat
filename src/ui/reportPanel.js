import { generateReport, reportToText } from '../scouting/reportGenerator.js';

export function mountReportPanel(root, { statsEngine, actionLog, roster, scoreboard }) {
  root.innerHTML = `
    <div class="panel-header">Match Report
      <span class="log-actions"><button data-action="download">Download .txt</button></span>
    </div>
    <div class="report-body"></div>
  `;

  const body = root.querySelector('.report-body');

  function render() {
    const report = generateReport({ statsEngine, actionLog, roster, scoreboard });

    const teamsHtml = report.teams
      .map(
        (team) => `
        <div class="report-team">
          <h4>${escapeHtml(team.name)}</h4>
          ${
            team.summary.length === 0
              ? '<p class="report-empty">no attempts yet</p>'
              : `<table class="report-table"><tbody>
                  ${team.summary
                    .map(
                      (s) => `<tr><td>${escapeHtml(s.skill)}</td><td>${s.attempts} att</td>
                        <td class="${s.efficiency >= 0 ? 'eff-pos' : 'eff-neg'}">${s.efficiency.toFixed(0)}% eff</td></tr>`
                    )
                    .join('')}
                </tbody></table>`
          }
        </div>`
      )
      .join('');

    const topHtml = report.topPerformers.length
      ? `<ul class="report-list">${report.topPerformers
          .map((p) => `<li><strong>${escapeHtml(p.skill)}</strong> — #${p.number} ${escapeHtml(p.name)} (${escapeHtml(p.team)}) · ${p.efficiency.toFixed(0)}% eff / ${p.attempts} att</li>`)
          .join('')}</ul>`
      : '<p class="report-empty">not enough data yet</p>';

    const errHtml = report.errorLeaders.length
      ? `<ul class="report-list">${report.errorLeaders
          .map((p) => `<li>#${p.number} ${escapeHtml(p.name)} (${escapeHtml(p.team)}) — ${p.errors} error(s)</li>`)
          .join('')}</ul>`
      : '<p class="report-empty">none yet</p>';

    body.innerHTML = `
      <div class="report-score">Set ${report.score.set} — ${escapeHtml(report.teams[0].name)} <strong>${report.score.home}</strong> : <strong>${report.score.away}</strong> ${escapeHtml(report.teams[1].name)}</div>
      <div class="report-teams">${teamsHtml}</div>
      <h4>Top performers</h4>
      ${topHtml}
      <h4>Error leaders</h4>
      ${errHtml}
    `;
  }

  root.querySelector('[data-action="download"]').addEventListener('click', () => {
    const text = reportToText(generateReport({ statsEngine, actionLog, roster, scoreboard }));
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'match-report.txt';
    a.click();
    URL.revokeObjectURL(url);
  });

  actionLog.onChange(render);
  roster.onChange(render);
  scoreboard.onChange(render);
  render();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
