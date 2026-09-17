// Team & player roster: setup, lookup, and localStorage persistence.

const STORAGE_KEY = 'vballstat.roster.v1';

function defaultRoster() {
  return {
    home: {
      name: 'Home',
      players: [
        { number: 1, name: 'A. Silva' },
        { number: 4, name: 'J. Torres' },
        { number: 7, name: 'M. Chen' },
        { number: 9, name: 'K. Novak' },
        { number: 11, name: 'D. Reyes' },
        { number: 14, name: 'L. Park' },
      ],
    },
    away: {
      name: 'Away',
      players: [
        { number: 2, name: 'R. Costa' },
        { number: 3, name: 'T. Ibrahim' },
        { number: 6, name: 'S. Haddad' },
        { number: 8, name: 'P. Osei' },
        { number: 10, name: 'E. Kowalski' },
        { number: 15, name: 'N. Fischer' },
      ],
    },
  };
}

export class Roster {
  constructor() {
    this.teams = this._load() || defaultRoster();
    this._listeners = [];
  }

  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  _save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.teams));
    } catch (e) {
      /* storage unavailable — non-fatal for a prototype */
    }
    this._listeners.forEach((fn) => fn(this.teams));
  }

  onChange(fn) {
    this._listeners.push(fn);
  }

  teamName(teamKey) {
    return this.teams[teamKey]?.name || teamKey;
  }

  setTeamName(teamKey, name) {
    this.teams[teamKey].name = name || this.teams[teamKey].name;
    this._save();
  }

  players(teamKey) {
    return this.teams[teamKey].players.slice().sort((a, b) => a.number - b.number);
  }

  findPlayer(teamKey, number) {
    return this.teams[teamKey].players.find((p) => p.number === number);
  }

  addPlayer(teamKey, number, name) {
    if (this.findPlayer(teamKey, number)) return false;
    this.teams[teamKey].players.push({ number, name: name || `#${number}` });
    this._save();
    return true;
  }

  removePlayer(teamKey, number) {
    const list = this.teams[teamKey].players;
    const idx = list.findIndex((p) => p.number === number);
    if (idx === -1) return false;
    list.splice(idx, 1);
    this._save();
    return true;
  }

  renamePlayer(teamKey, number, name) {
    const p = this.findPlayer(teamKey, number);
    if (!p) return false;
    p.name = name;
    this._save();
    return true;
  }

  resetToDefault() {
    this.teams = defaultRoster();
    this._save();
  }

  // Best-effort display name, even for a shirt number not on the roster
  // (real scouting doesn't stop just because the sheet is incomplete).
  displayName(teamKey, number) {
    const p = this.findPlayer(teamKey, number);
    return p ? p.name : `#${number} (unrostered)`;
  }
}
