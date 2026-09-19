import { parseRallyLine } from './rallyParser.js';
import { buildActionCode } from './codes.js';

// Bridges a parsed rally line into the same ActionLog + Scoreboard the
// keystroke-by-keystroke coder writes to, so both input styles feed one
// consistent play-by-play and stats table.
export class RallyCommitter {
  constructor({ roster, videoSource, actionLog, scoreboard }) {
    this.roster = roster;
    this.videoSource = videoSource;
    this.actionLog = actionLog;
    this.scoreboard = scoreboard;
    this._commitListeners = [];
  }

  // Fired once per successful commit, before any of its actions are
  // added to the log — lets a listener (the Court Visualizer) reset its
  // view of "the current rally" right as a new one starts, rather than
  // accumulating markers/trails across every rally in the match.
  onCommit(fn) {
    this._commitListeners.push(fn);
  }

  preview(line) {
    return parseRallyLine(line);
  }

  // Commits every parsed action (stamped with sequential offsets off the
  // current video time, since a rally line is typed after the point ends
  // and has no per-action keystroke timing of its own) and, if the line
  // ends in "HP"/"AP", awards that point. Returns the parse result so
  // the caller can surface errors without committing a partial rally.
  commit(line) {
    const parsed = parseRallyLine(line);
    if (parsed.errors.length > 0 || parsed.actions.length === 0) return parsed;

    this._commitListeners.forEach((fn) => fn());

    const baseTime = this.videoSource.currentTime();
    parsed.actions.forEach((a, i) => {
      this.actionLog.add({
        videoTime: baseTime + i * 0.01,
        wallClock: new Date().toISOString(),
        team: a.team,
        playerNumber: a.playerNumber,
        playerName: this.roster.displayName(a.team, a.playerNumber),
        skill: a.skill,
        skillName: a.skillName,
        evaluation: a.evaluation,
        zone: a.zone,
        subzone: a.subzone,
        fromZone: a.fromZone,
        fromSubzone: a.fromSubzone,
        code: buildActionCode(a.team, a.playerNumber, a.skill, a.evaluation, a.fromZone, a.fromSubzone, a.zone, a.subzone),
      });
    });

    if (parsed.pointTeam) {
      this.scoreboard.bump(parsed.pointTeam, 1);
    }

    return parsed;
  }
}
