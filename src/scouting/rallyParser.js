import { SKILL_ORDER, EVALUATIONS, skillName } from './codes.js';

// Parses a single-line rally transcription, the "typebox" workflow from
// DataVolley/VolleyStation: the analyst watches the whole point, then
// types every action as one line, using the exact same codes as the
// Live Coding keyboard panel — team key, player number, skill letter,
// evaluation symbol — with an optional zone segment inserted before the
// evaluation symbol:
//
//   <Zone><Subzone?>              e.g. "5" or "5a"              (target only)
//   <FromZone><Subzone?>>ZoneSeg  e.g. "3>5" or "3a>5b"          (origin>target, DataVolley trajectory)
//
//   H13S5+; A27R+ A32E4-3a>5b; H34B+; Point H
//
// Tokens are separated by ';' and/or whitespace interchangeably — both
// appear in real transcriptions depending on how the scout groups
// phases of the rally, so the tokenizer treats them the same way.
// "Point <Team>" (two words) closes the rally.

const SKILL_ALTERNATION = SKILL_ORDER.join('|');
const EVAL_ALTERNATION = EVALUATIONS.map((e) => `\\${e}`).join('|');

const ACTION_RE = new RegExp(
  `^([HA])(\\d{1,2})(${SKILL_ALTERNATION})(?:(\\d{1,2})([a-dA-D])?>)?(\\d{0,2})([a-dA-D])?(${EVAL_ALTERNATION})$`,
  'i'
);

// Returns { actions: [{team, playerNumber, skill, skillName, evaluation,
//           zone, subzone, fromZone, fromSubzone}], pointTeam: 'home'|'away'|null,
//           errors: [{token, message}] }
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
      errors.push({ token: word, message: `Could not parse "${word}" as <Team><Player#><Skill>[From>][Zone][Subzone]<Eval>` });
      continue;
    }

    const [, teamLetter, playerStr, skillLetter, fromZoneStr, fromSubzone, zoneStr, subzone, evalChar] = m;
    const skillCode = skillLetter.toUpperCase();

    actions.push({
      team: teamLetter.toUpperCase() === 'H' ? 'home' : 'away',
      playerNumber: parseInt(playerStr, 10),
      skill: skillCode,
      skillName: skillName(skillCode),
      evaluation: evalChar,
      zone: zoneStr ? parseInt(zoneStr, 10) : null,
      subzone: subzone ? subzone.toLowerCase() : null,
      fromZone: fromZoneStr ? parseInt(fromZoneStr, 10) : null,
      fromSubzone: fromSubzone ? fromSubzone.toLowerCase() : null,
      raw: word,
    });
  }

  return { actions, pointTeam, errors };
}

export const RALLY_EXAMPLE = 'H13S3>5a+; A27R+ A32E4-; H34B+; Point H';
