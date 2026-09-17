// Shared vocabulary for the DataVolley-style coding scheme.
// A committed action is: <team><player#><skill><evaluation>

export const TEAM_KEYS = { h: 'home', a: 'away' };

export const SKILLS = {
  S: { code: 'S', name: 'Serve' },
  R: { code: 'R', name: 'Reception' },
  E: { code: 'E', name: 'Set' },
  A: { code: 'A', name: 'Attack' },
  B: { code: 'B', name: 'Block' },
  D: { code: 'D', name: 'Dig' },
  F: { code: 'F', name: 'Freeball' },
};

export const SKILL_ORDER = ['S', 'R', 'E', 'A', 'B', 'D', 'F'];

// Evaluation meaning is skill-specific, as in real DataVolley scouting.
export const EVALUATIONS = ['#', '+', '!', '-', '/', '='];

const GENERIC_EVAL_LABEL = {
  '#': 'Perfect',
  '+': 'Positive',
  '!': 'Exclamation / OK',
  '-': 'Negative',
  '/': 'Poor',
  '=': 'Error',
};

// Per-skill human labels shown in legends/tooltips (falls back to generic).
const SKILL_EVAL_LABEL = {
  S: { '#': 'Ace', '=': 'Service error', '!': 'No attack for opponent' },
  R: { '#': 'Perfect pass', '=': 'Reception error (ace against)' },
  A: { '#': 'Kill', '/': 'Blocked', '=': 'Attack error' },
  B: { '#': 'Stuff block (point)', '=': 'Block error' },
  D: { '#': 'Perfect dig', '=': 'Dig error (ball down)' },
};

export function evalLabel(skillCode, evalChar) {
  return (SKILL_EVAL_LABEL[skillCode] && SKILL_EVAL_LABEL[skillCode][evalChar]) ||
    GENERIC_EVAL_LABEL[evalChar];
}

export function skillName(skillCode) {
  return SKILLS[skillCode] ? SKILLS[skillCode].name : skillCode;
}

// Standard DataVolley 3x3 target-zone grid (net at the top):
//   4 3 2
//   7 8 9
//   5 6 1
export const COURT_ZONES = [
  [4, 3, 2],
  [7, 8, 9],
  [5, 6, 1],
];

// Each zone is further split into four subzones (DataVolley convention),
// here mapped to the visual quadrant of the zone's cell:
//   a b
//   c d
export const SUBZONES = ['a', 'b', 'c', 'd'];
export const SUBZONE_LABEL = { a: 'near/left', b: 'near/right', c: 'far/left', d: 'far/right' };

// Formats a zone segment the same way it's typed/parsed: "3a>5b", "5", or "".
export function formatZoneSegment(fromZone, fromSubzone, zone, subzone) {
  const from = fromZone ? `${fromZone}${fromSubzone || ''}>` : '';
  const to = zone ? `${zone}${subzone || ''}` : '';
  return from + to;
}

// Builds the compact code exactly as it would be typed, in the same
// left-to-right order as both the keyboard coder and the rally line:
// <Team><Player#><Skill>[Zone segment]<Eval>, e.g. "H13S3>5a+".
export function buildActionCode(team, playerNumber, skill, evaluation, fromZone, fromSubzone, zone, subzone) {
  const teamLetter = team === 'home' ? 'H' : 'A';
  return `${teamLetter}${playerNumber}${skill}${formatZoneSegment(fromZone, fromSubzone, zone, subzone)}${evaluation}`;
}
