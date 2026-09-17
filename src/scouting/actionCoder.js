import { TEAM_KEYS, SKILLS, EVALUATIONS, skillName } from './codes.js';

// Keyboard state machine that turns a fast key sequence
//   <team> <player#> <skill> <evaluation>
// into a committed Action, exactly mirroring the terse coding grammar
// DataVolley/VolleyStation scouts type while watching live video.
//
// Stages: 'team' -> 'number' -> 'skill'(implicit, number ends on skill key) -> 'evaluation'
export class ActionCoder {
  constructor({ roster, videoSource, actionLog }) {
    this.roster = roster;
    this.videoSource = videoSource;
    this.actionLog = actionLog;

    this.team = null;
    this.numberBuffer = '';
    this.skill = null;

    this._listeners = [];
    this._boundKeydown = this._onKeydown.bind(this);
  }

  onChange(fn) {
    this._listeners.push(fn);
  }

  _emit() {
    this._listeners.forEach((fn) => fn(this.state()));
  }

  attach() {
    window.addEventListener('keydown', this._boundKeydown);
  }

  detach() {
    window.removeEventListener('keydown', this._boundKeydown);
  }

  state() {
    return {
      team: this.team,
      numberBuffer: this.numberBuffer,
      skill: this.skill,
    };
  }

  reset() {
    this.team = null;
    this.numberBuffer = '';
    this.skill = null;
    this._emit();
  }

  // Allow the UI (roster click) to pre-fill team+number directly.
  selectPlayer(team, number) {
    this.team = team;
    this.numberBuffer = String(number);
    this.skill = null;
    this._emit();
  }

  _stepBack() {
    if (this.skill) {
      this.skill = null;
    } else if (this.numberBuffer.length > 0) {
      this.numberBuffer = this.numberBuffer.slice(0, -1);
    } else if (this.team) {
      this.team = null;
    }
    this._emit();
  }

  _onKeydown(e) {
    // Never hijack typing inside a text field (roster editor, etc.)
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      this.reset();
      return;
    }
    if (e.key === 'Backspace') {
      e.preventDefault();
      this._stepBack();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      this.actionLog.undoLast();
      return;
    }

    const key = e.key;
    const lower = key.toLowerCase();

    // Stage 1: team
    if (!this.team && TEAM_KEYS[lower]) {
      e.preventDefault();
      this.team = TEAM_KEYS[lower];
      this._emit();
      return;
    }

    if (!this.team) return; // nothing else is meaningful yet

    // Stage 2: player number digits
    if (!this.skill && /^[0-9]$/.test(key)) {
      e.preventDefault();
      if (this.numberBuffer.length < 2) {
        this.numberBuffer += key;
        this._emit();
      }
      return;
    }

    // Stage 3: skill letter (requires at least one digit typed)
    if (!this.skill && this.numberBuffer.length > 0 && SKILLS[key.toUpperCase()]) {
      e.preventDefault();
      this.skill = key.toUpperCase();
      this._emit();
      return;
    }

    // Stage 4: evaluation symbol commits the action
    if (this.skill && EVALUATIONS.includes(key)) {
      e.preventDefault();
      this._commit(key);
      return;
    }
  }

  _commit(evaluation) {
    const number = parseInt(this.numberBuffer, 10);
    const playerName = this.roster.displayName(this.team, number);
    const skillCode = this.skill;

    const action = {
      videoTime: this.videoSource.currentTime(),
      wallClock: new Date().toISOString(),
      team: this.team,
      playerNumber: number,
      playerName,
      skill: skillCode,
      skillName: skillName(skillCode),
      evaluation,
      zone: null,
      code: `${this.team === 'home' ? 'H' : 'A'}${number}${skillCode}${evaluation}`,
    };

    this.actionLog.add(action);
    this.reset();
  }
}
