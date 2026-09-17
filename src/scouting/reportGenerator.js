import { SKILL_ORDER, SKILLS } from './codes.js';

const MIN_ATTEMPTS_FOR_LEADERBOARD = 2;

// Builds a readable match report from the same nested stats the Live
// Stats table renders, plus the scoreboard — a openvolley `volleyreport`
// -style summary instead of a raw CSV/JSON dump.
export function generateReport({ statsEngine, actionLog, roster, scoreboard }) {
  const stats = statsEngine.compute(actionLog.list(), roster);
  const score = scoreboard.score;

  const teams = ['home', 'away'].map((teamKey) => {
    const team = stats[teamKey];
    const summary = SKILL_ORDER.filter((s) => team.totals.counts[s].total > 0).map((s) => ({
      skill: SKILLS[s].name,
      attempts: team.totals.metrics[s].total,
      efficiency: team.totals.metrics[s].efficiency,
    }));
    return { name: team.name, summary };
  });

  // Top performer per skill (best efficiency, minimum attempts), across both teams.
  const topPerformers = SKILL_ORDER.map((skillCode) => {
    let best = null;
    ['home', 'away'].forEach((teamKey) => {
      stats[teamKey].players.forEach((p) => {
        const m = p.skills.metrics[skillCode];
        if (m.total < MIN_ATTEMPTS_FOR_LEADERBOARD) return;
        if (!best || m.efficiency > best.efficiency) {
          best = { team: stats[teamKey].name, name: p.name, number: p.number, efficiency: m.efficiency, attempts: m.total };
        }
      });
    });
    return best ? { skill: SKILLS[skillCode].name, ...best } : null;
  }).filter(Boolean);

  // Error leaders: most total evaluation errors ('=') across all skills.
  const errorCounts = [];
  ['home', 'away'].forEach((teamKey) => {
    stats[teamKey].players.forEach((p) => {
      const errors = SKILL_ORDER.reduce((sum, s) => sum + p.skills.counts[s]['='], 0);
      if (errors > 0) errorCounts.push({ team: stats[teamKey].name, name: p.name, number: p.number, errors });
    });
  });
  errorCounts.sort((a, b) => b.errors - a.errors);

  return {
    score,
    teams,
    topPerformers,
    errorLeaders: errorCounts.slice(0, 5),
  };
}

export function reportToText(report) {
  const lines = [];
  lines.push('MATCH REPORT');
  lines.push(`Set ${report.score.set} — ${report.teams[0].name} ${report.score.home} : ${report.score.away} ${report.teams[1].name}`);
  lines.push('');

  report.teams.forEach((team) => {
    lines.push(`${team.name.toUpperCase()}`);
    if (team.summary.length === 0) {
      lines.push('  no attempts yet');
    } else {
      team.summary.forEach((s) => {
        lines.push(`  ${s.skill.padEnd(10)} ${String(s.attempts).padStart(3)} att   eff ${s.efficiency.toFixed(0)}%`);
      });
    }
    lines.push('');
  });

  lines.push(`TOP PERFORMERS (min ${MIN_ATTEMPTS_FOR_LEADERBOARD} attempts)`);
  if (report.topPerformers.length === 0) {
    lines.push('  not enough data yet');
  } else {
    report.topPerformers.forEach((p) => {
      lines.push(`  ${p.skill.padEnd(10)} #${p.number} ${p.name} (${p.team}) — ${p.efficiency.toFixed(0)}% eff over ${p.attempts} att`);
    });
  }
  lines.push('');

  lines.push('ERROR LEADERS');
  if (report.errorLeaders.length === 0) {
    lines.push('  none yet');
  } else {
    report.errorLeaders.forEach((p) => {
      lines.push(`  #${p.number} ${p.name} (${p.team}) — ${p.errors} error(s)`);
    });
  }

  return lines.join('\n');
}
