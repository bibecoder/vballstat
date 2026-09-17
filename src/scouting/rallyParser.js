import { SKILL_WORDS, EVAL_WORDS, skillName } from './codes.js';

// Parses a single-line rally transcription, the "typebox" workflow from
// DataVolley/VolleyStation: the analyst watches the whole point, then
// types every action as one line, e.g.
//
//   H13ServeLocation5Positive; A27ReceivePositive A32SetLocation4Negative;
//   H34BlockPositive; Point H
//
// Tokens are separated by ';' and/or whitespace interchangeably — both
// appear in real transcriptions depending on how the scout groups
// phases of the rally, so the tokenizer treats them the same way.
// Each action token is <Team><Player#><Skill>[Location<Zone>]<Evaluation>
// packed with no separators; "Point <Team>" (two words) closes the rally.

const SKILL_ALTERNATION = Object.keys(SKILL_WORDS)
  .sort((a, b) => b.length - a.length) // longest first: "Reception" before "Receive"
  .join('|');
const EVAL_ALTERNATION = Object.keys(EVAL_WORDS)
  .sort((a, b) => b.length - a.length)
  .join('|');

const ACTION_RE = new RegExp(
  `^([HA])(\\d{1,2})(${SKILL_ALTERNATION})(?:Location(\\d{1,2}))?(${EVAL_ALTERNATION})$`,
  'i'
);

function matchCanonical(alternationMap, raw) {
  const key = Object.keys(alternationMap).find((k) => k.toLowerCase() === raw.toLowerCase());
  return key ? alternationMap[key] : null;
}

// Returns { actions: [{team, playerNumber, skill, skillName, evaluation, zone}],
//           pointTeam: 'home'|'away'|null, errors: [{token, message}] }
export function parseRallyLine(line) {
  const words = line.trim().split(/[;\s]+/).filter(Boolean);
  const actions = [];
  const errors = [];
  let pointTeam = null;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];

    if (/^point$/i.test(word)) {
      const teamWord = words[i + 1];
      if (teamWord && /^[HA]$/i.test(teamWord)) {
        pointTeam = teamWord.toUpperCase() === 'H' ? 'home' : 'away';
        i += 1;
      } else {
        errors.push({ token: word, message: '"Point" must be followed by H or A' });
      }
      continue;
    }

    const m = ACTION_RE.exec(word);
    if (!m) {
      errors.push({ token: word, message: `Could not parse "${word}" as <Team><Player><Skill>[Location#]<Evaluation>` });
      continue;
    }

    const [, teamLetter, playerStr, skillWord, zoneStr, evalWord] = m;
    const skillCode = matchCanonical(SKILL_WORDS, skillWord);
    const evalChar = matchCanonical(EVAL_WORDS, evalWord);

    actions.push({
      team: teamLetter.toUpperCase() === 'H' ? 'home' : 'away',
      playerNumber: parseInt(playerStr, 10),
      skill: skillCode,
      skillName: skillName(skillCode),
      evaluation: evalChar,
      zone: zoneStr ? parseInt(zoneStr, 10) : null,
      raw: word,
    });
  }

  return { actions, pointTeam, errors };
}

export const RALLY_EXAMPLE = 'H13ServeLocation5Positive; A27ReceivePositive A32SetLocation4Negative; H34BlockPositive; Point H';
