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

// Word vocabulary for the single-line rally notation (see rallyParser.js),
// e.g. "H13ServeLocation5Positive". Longest synonym first so greedy
// alternation in the parser regex prefers "Reception" over "Receive".
export const SKILL_WORDS = {
  Serve: 'S',
  Reception: 'R',
  Receive: 'R',
  Set: 'E',
  Attack: 'A',
  Spike: 'A',
  Block: 'B',
  Dig: 'D',
  Freeball: 'F',
  FreeBall: 'F',
};

export const EVAL_WORDS = {
  Perfect: '#',
  Positive: '+',
  Exclamation: '!',
  OK: '!',
  Negative: '-',
  Poor: '/',
  Error: '=',
};

// Standard DataVolley 3x3 target-zone grid (net at the top):
//   4 3 2
//   7 8 9
//   5 6 1
export const COURT_ZONES = [
  [4, 3, 2],
  [7, 8, 9],
  [5, 6, 1],
];
