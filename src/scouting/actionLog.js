// Append-only (with undo) log of committed scouting actions.
// This is the "scouting file" of the prototype: the ground truth every
// stats table and export is derived from.

let nextId = 1;

export class ActionLog {
  constructor() {
    this.actions = [];
    this._listeners = [];
  }

  onChange(fn) {
    this._listeners.push(fn);
  }

  _emit() {
    this._listeners.forEach((fn) => fn(this.actions));
  }

  add(action) {
    const withId = { id: nextId++, ...action };
    this.actions.push(withId);
    this._emit();
    return withId;
  }

  undoLast() {
    const removed = this.actions.pop();
    if (removed) this._emit();
    return removed;
  }

  remove(id) {
    const idx = this.actions.findIndex((a) => a.id === id);
    if (idx === -1) return false;
    this.actions.splice(idx, 1);
    this._emit();
    return true;
  }

  clear() {
    this.actions = [];
    this._emit();
  }

  list() {
    return this.actions;
  }

  toCSV() {
    const header = ['#', 'video_time', 'wall_clock', 'team', 'player_number', 'player_name', 'skill', 'evaluation', 'code'];
    const rows = this.actions.map((a, i) => [
      i + 1,
      a.videoTime.toFixed(2),
      a.wallClock,
      a.team,
      a.playerNumber,
      a.playerName,
      a.skillName,
      a.evaluation,
      a.code,
    ]);
    return [header, ...rows].map((r) => r.map(csvEscape).join(',')).join('\n');
  }

  toJSON() {
    return JSON.stringify(this.actions, null, 2);
  }
}

function csvEscape(value) {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
