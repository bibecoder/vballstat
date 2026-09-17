// Manual scoreboard, shared between the score panel UI and the rally-line
// committer (a parsed "Point H"/"Point A" bumps it automatically).

const STORAGE_KEY = 'vballstat.score.v1';

function defaultScore() {
  return { home: 0, away: 0, set: 1 };
}

export class Scoreboard {
  constructor() {
    this.score = this._load();
    this._listeners = [];
  }

  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : defaultScore();
    } catch (e) {
      return defaultScore();
    }
  }

  _save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.score));
    } catch (e) {
      /* non-fatal for a prototype */
    }
    this._listeners.forEach((fn) => fn(this.score));
  }

  onChange(fn) {
    this._listeners.push(fn);
  }

  bump(team, delta) {
    this.score[team] = Math.max(0, this.score[team] + delta);
    this._save();
  }

  newSet() {
    this.score = { home: 0, away: 0, set: this.score.set + 1 };
    this._save();
  }

  reset() {
    this.score = defaultScore();
    this._save();
  }

  // Bulk-set, e.g. after a DVW import.
  setScore(score) {
    this.score = { ...defaultScore(), ...score };
    this._save();
  }
}
