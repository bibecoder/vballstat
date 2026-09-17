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
