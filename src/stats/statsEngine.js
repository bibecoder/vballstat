import { SKILL_ORDER, EVALUATIONS, skillName } from '../scouting/codes.js';

// Aggregates the flat action log into the nested per-team / per-player /
// per-skill breakdown a DataVolley-style stats table shows, recomputed
// from scratch after every commit (the log is small enough per set that
// this is cheap, and it keeps the engine trivially correct).

function emptyCounts() {
  const c = {};
  EVALUATIONS.forEach((e) => (c[e] = 0));
  c.total = 0;
  return c;
}

function addToCounts(counts, evaluation) {
  counts[evaluation] += 1;
  counts.total += 1;
}

// Standard efficiency metrics. Meaning of '#' / '=' is skill-specific
// (ace vs. kill vs. stuff-block, etc.) but the arithmetic is uniform.
export function deriveMetrics(counts) {
  const total = counts.total;
  const pct = (n) => (total > 0 ? (n / total) * 100 : 0);
  return {
    total,
    perfectPct: pct(counts['#']),
    positivePct: pct(counts['#'] + counts['+']),
    errorPct: pct(counts['=']),
    efficiency: total > 0 ? ((counts['#'] - counts['=']) / total) * 100 : 0,
  };
}

export class StatsEngine {
  compute(actions, roster) {
    const teams = {
      home: this._computeTeam(actions, 'home', roster),
      away: this._computeTeam(actions, 'away', roster),
    };
    return teams;
  }

  _computeTeam(actions, teamKey, roster) {
    const teamActions = actions.filter((a) => a.team === teamKey);

    // Union of rostered players and anyone who appears in the log but
    // isn't on the sheet (real scouting shouldn't silently drop them).
    const numbers = new Set(roster.players(teamKey).map((p) => p.number));
    teamActions.forEach((a) => numbers.add(a.playerNumber));

    const players = Array.from(numbers)
      .sort((a, b) => a - b)
      .map((number) => this._computePlayer(teamActions, number, roster.displayName(teamKey, number)));

    const teamTotals = this._skillBreakdown(teamActions);

    return {
      name: roster.teamName(teamKey),
      players,
      totals: teamTotals,
    };
  }

  _computePlayer(teamActions, number, name) {
    const playerActions = teamActions.filter((a) => a.playerNumber === number);
    return {
      number,
      name,
      skills: this._skillBreakdown(playerActions),
      totalActions: playerActions.length,
    };
  }

  _skillBreakdown(actions) {
    const bySkill = {};
    SKILL_ORDER.forEach((s) => (bySkill[s] = emptyCounts()));
    actions.forEach((a) => addToCounts(bySkill[a.skill], a.evaluation));

    const metrics = {};
    SKILL_ORDER.forEach((s) => (metrics[s] = deriveMetrics(bySkill[s])));

    return { counts: bySkill, metrics };
  }
}

export { SKILL_ORDER, skillName };
