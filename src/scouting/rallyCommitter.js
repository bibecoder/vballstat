import { parseRallyLine } from './rallyParser.js';

// Bridges a parsed rally line into the same ActionLog + Scoreboard the
// keystroke-by-keystroke coder writes to, so both input styles feed one
// consistent play-by-play and stats table.
export class RallyCommitter {
  constructor({ roster, videoSource, actionLog, scoreboard }) {
    this.roster = roster;
    this.videoSource = videoSource;
    this.actionLog = actionLog;
    this.scoreboard = scoreboard;
    this.lastCommitted = []; // actions from the most recent commit, for the visualizer
    this._listeners = [];
  }

  onCommit(fn) {
    this._listeners.push(fn);
  }

  preview(line) {
    return parseRallyLine(line);
  }

  // Commits every parsed action (stamped with sequential offsets off the
  // current video time, since a rally line is typed after the point ends
  // and has no per-action keystroke timing of its own) and, if the line
  // ends in "Point <Team>", awards that point. Returns the parse result
  // so the caller can surface errors without committing a partial rally.
  commit(line) {
    const parsed = parseRallyLine(line);
    if (parsed.errors.length > 0 || parsed.actions.length === 0) return parsed;

    const baseTime = this.videoSource.currentTime();
    const committed = parsed.actions.map((a, i) => {
      const action = {
        videoTime: baseTime + i * 0.01,
        wallClock: new Date().toISOString(),
        team: a.team,
        playerNumber: a.playerNumber,
        playerName: this.roster.displayName(a.team, a.playerNumber),
        skill: a.skill,
        skillName: a.skillName,
        evaluation: a.evaluation,
        zone: a.zone,
        code: `${a.team === 'home' ? 'H' : 'A'}${a.playerNumber}${a.skill}${a.evaluation}` + (a.zone ? `@${a.zone}` : ''),
      };
      return this.actionLog.add(action);
    });

    if (parsed.pointTeam) {
      this.scoreboard.bump(parsed.pointTeam, 1);
    }

    this.lastCommitted = committed;
    this._listeners.forEach((fn) => fn(committed, parsed.pointTeam));
    return parsed;
  }
}
