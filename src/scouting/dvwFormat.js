import { skillName } from './codes.js';

// A DataVolley-*style* (.dvw) export/import.
//
// IMPORTANT — honesty about fidelity: DataVolley's real .dvw format is a
// proprietary, tilde-delimited binary-adjacent text format whose exact
// row-level grammar isn't publicly specified byte-for-byte. This module
// reuses the REAL, documented section names (the openvolley project's
// `datavolley` R package and others key off these same bracketed
// headers: [3MATCH], [3TEAMS], [3PLAYERS-H/-V], [3SET], [3VIDEO],
// [3SCOUT], …) so a section-aware tool can at least recognise the file's
// shape, but the [3SCOUT] row encoding below is OUR OWN simplified,
// semicolon-delimited scheme — not a byte-identical reproduction of
// commercial DataVolley/VolleyStation output. It reliably round-trips
// files this app itself exported; a real .dvw from other software will
// not import correctly. Getting full binary-exact compatibility would
// require the official spec.

function csvField(v) {
  const s = String(v ?? '');
  return /[;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function exportDVW({ roster, actionLog, scoreboard, videoSource }) {
  const lines = [];
  lines.push('[3DATAVOLLEYSCOUT]');
  lines.push('generator;vballstat prototype (simplified DataVolley-style export — see file header comment in source)');
  lines.push('');

  lines.push('[3MATCH]');
  lines.push(`date;${new Date().toISOString().slice(0, 10)}`);
  lines.push(`home_team;${csvField(roster.teamName('home'))}`);
  lines.push(`away_team;${csvField(roster.teamName('away'))}`);
  lines.push('');

  lines.push('[3TEAMS]');
  lines.push(`home;${csvField(roster.teamName('home'))}`);
  lines.push(`away;${csvField(roster.teamName('away'))}`);
  lines.push('');

  lines.push('[3PLAYERS-H]');
  roster.players('home').forEach((p) => lines.push(`${p.number};${csvField(p.name)}`));
  lines.push('');

  lines.push('[3PLAYERS-V]');
  roster.players('away').forEach((p) => lines.push(`${p.number};${csvField(p.name)}`));
  lines.push('');

  lines.push('[3SET]');
  lines.push(`${scoreboard.score.set};${scoreboard.score.home};${scoreboard.score.away}`);
  lines.push('');

  lines.push('[3VIDEO]');
  lines.push(`source;${csvField(videoSource.status().label || '')}`);
  lines.push('');

  lines.push('[3SCOUT]');
  lines.push('code;team;player_number;player_name;skill;evaluation;zone;subzone;from_zone;from_subzone;video_time;wall_clock');
  actionLog.list().forEach((a) => {
    lines.push(
      [
        a.code,
        a.team,
        a.playerNumber,
        csvField(a.playerName),
        a.skill,
        a.evaluation,
        a.zone ?? '',
        a.subzone ?? '',
        a.fromZone ?? '',
        a.fromSubzone ?? '',
        a.videoTime.toFixed(2),
        a.wallClock,
      ].join(';')
    );
  });

  return lines.join('\n') + '\n';
}

function parseSection(text, name) {
  const re = new RegExp(`\\[${name}\\]\\n([\\s\\S]*?)(?=\\n\\[|$)`);
  const m = re.exec(text);
  if (!m) return [];
  return m[1].split('\n').map((l) => l.trim()).filter(Boolean);
}

function unquote(field) {
  if (field.startsWith('"') && field.endsWith('"')) {
    return field.slice(1, -1).replace(/""/g, '"');
  }
  return field;
}

// Returns { roster: {home:{name,players},away:{name,players}}, actions: [...],
//           score: {home,away,set}, errors: [string] }
export function importDVW(text) {
  const errors = [];

  const roster = {
    home: { name: 'Home', players: [] },
    away: { name: 'Away', players: [] },
  };
  parseSection(text, '3TEAMS').forEach((line) => {
    const [side, name] = line.split(';').map(unquote);
    if (side === 'home' || side === 'away') roster[side].name = name || roster[side].name;
  });
  parseSection(text, '3PLAYERS-H').forEach((line) => {
    const [num, name] = line.split(';').map(unquote);
    const number = parseInt(num, 10);
    if (Number.isInteger(number)) roster.home.players.push({ number, name: name || `#${number}` });
  });
  parseSection(text, '3PLAYERS-V').forEach((line) => {
    const [num, name] = line.split(';').map(unquote);
    const number = parseInt(num, 10);
    if (Number.isInteger(number)) roster.away.players.push({ number, name: name || `#${number}` });
  });

  let score = null;
  const setLines = parseSection(text, '3SET');
  if (setLines.length > 0) {
    const [set, home, away] = setLines[setLines.length - 1].split(';').map(Number);
    if (Number.isFinite(home) && Number.isFinite(away)) {
      score = { set: Number.isFinite(set) ? set : 1, home, away };
    }
  }

  const scoutLines = parseSection(text, '3SCOUT');
  const actions = [];
  scoutLines.slice(1).forEach((line, i) => {
    // Skip the header row (index 0); tolerate either our own column order
    // or a shorter/reordered file by validating field count loosely.
    const fields = line.split(';').map(unquote);
    if (fields.length < 11) {
      errors.push(`Row ${i + 1}: expected at least 11 fields, got ${fields.length} ("${line.slice(0, 60)}")`);
      return;
    }
    const [code, team, playerNumberStr, playerName, skill, evaluation, zoneStr, subzone, fromZoneStr, fromSubzone, videoTimeStr, wallClock] = fields;
    const playerNumber = parseInt(playerNumberStr, 10);
    const videoTime = parseFloat(videoTimeStr);
    if (!(team === 'home' || team === 'away') || !Number.isInteger(playerNumber) || !skill || !evaluation) {
      errors.push(`Row ${i + 1}: could not parse core fields ("${line.slice(0, 60)}")`);
      return;
    }
    actions.push({
      videoTime: Number.isFinite(videoTime) ? videoTime : 0,
      wallClock: wallClock || new Date().toISOString(),
      team,
      playerNumber,
      playerName: playerName || `#${playerNumber}`,
      skill,
      skillName: skillName(skill),
      evaluation,
      zone: zoneStr ? parseInt(zoneStr, 10) : null,
      subzone: subzone || null,
      fromZone: fromZoneStr ? parseInt(fromZoneStr, 10) : null,
      fromSubzone: fromSubzone || null,
      code: code || '',
    });
  });

  return { roster, actions, score, errors };
}
