import { TEAM_KEYS, SKILLS, EVALUATIONS, SUBZONES, skillName, buildActionCode } from './codes.js';

// Keyboard state machine that turns a fast key sequence
//   <team> <player#> <skill> [<from-zone><subzone?>>]<zone><subzone?> <evaluation>
// into a committed Action, exactly mirroring the terse coding grammar
// DataVolley/VolleyStation scouts type while watching live video. The
// zone segment is entirely optional — any evaluation key commits
// immediately, with or without a zone typed first — and the court
// visualizer can also fill the zone segment via a click (see setZone).
//
// Stages: team -> number -> skill -> [zone digits -> subzone -> '>' -> zone digits -> subzone] -> evaluation
export class ActionCoder {
  constructor({ roster, videoSource, actionLog }) {
    this.roster = roster;
    this.videoSource = videoSource;
    this.actionLog = actionLog;

    this.team = null;
    this.numberBuffer = '';
    this.skill = null;
    this.zoneDigits = '';
    this.subzone = null;
    this.fromZone = null;
    this.fromSubzone = null;

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
      zoneDigits: this.zoneDigits,
      subzone: this.subzone,
      fromZone: this.fromZone,
      fromSubzone: this.fromSubzone,
    };
  }

  reset() {
    this.team = null;
    this.numberBuffer = '';
    this.skill = null;
    this.zoneDigits = '';
    this.subzone = null;
    this.fromZone = null;
    this.fromSubzone = null;
    this._emit();
  }

  // Allow the UI (roster click) to pre-fill team+number directly.
  selectPlayer(team, number) {
    this.team = team;
    this.numberBuffer = String(number);
    this.skill = null;
    this.zoneDigits = '';
    this.subzone = null;
    this.fromZone = null;
    this.fromSubzone = null;
    this._emit();
  }

  // Allow the court visualizer to fill the current zone slot by click,
  // instead of typing digits — same effect as typing that zone number
  // (and its quadrant as a subzone letter) at whatever stage we're at.
  // Only meaningful once team+player+skill are chosen.
  setZone(zoneNumber, subzoneLetter) {
    if (!this.skill) return;
    this.zoneDigits = String(zoneNumber);
    this.subzone = subzoneLetter || null;
    this._emit();
  }

  _stepBack() {
    if (this.subzone) {
      this.subzone = null;
    } else if (this.zoneDigits.length > 0) {
      this.zoneDigits = this.zoneDigits.slice(0, -1);
    } else if (this.fromZone !== null) {
      // Undo the '>' — restore the origin zone as the active slot.
      this.zoneDigits = String(this.fromZone);
      this.subzone = this.fromSubzone;
      this.fromZone = null;
      this.fromSubzone = null;
    } else if (this.skill) {
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

    if (!this.skill) return;

    // Stage 4a: zone digits for the active slot (target, or origin if '>' follows)
    if (!this.subzone && /^[0-9]$/.test(key) && this.zoneDigits.length < 2) {
      e.preventDefault();
      this.zoneDigits += key;
      this._emit();
      return;
    }

    // Stage 4b: subzone quadrant letter for the active slot
    if (this.zoneDigits.length > 0 && !this.subzone && SUBZONES.includes(lower) && key === lower) {
      e.preventDefault();
      this.subzone = lower;
      this._emit();
      return;
    }

    // Stage 4c: '>' turns the slot just typed into the origin zone, and
    // opens a fresh slot for the target zone (DataVolley trajectory).
    if (key === '>' && this.fromZone === null && this.zoneDigits.length > 0) {
      e.preventDefault();
      this.fromZone = parseInt(this.zoneDigits, 10);
      this.fromSubzone = this.subzone;
      this.zoneDigits = '';
      this.subzone = null;
      this._emit();
      return;
    }

    // Stage 5: evaluation symbol commits the action, zone or not
    if (EVALUATIONS.includes(key)) {
      e.preventDefault();
      this._commit(key);
      return;
    }
  }

  _commit(evaluation) {
    const number = parseInt(this.numberBuffer, 10);
    const playerName = this.roster.displayName(this.team, number);
    const skillCode = this.skill;
    const zone = this.zoneDigits ? parseInt(this.zoneDigits, 10) : null;
    const subzone = zone ? this.subzone : null;

    const action = {
      videoTime: this.videoSource.currentTime(),
      wallClock: new Date().toISOString(),
      team: this.team,
      playerNumber: number,
      playerName,
      skill: skillCode,
      skillName: skillName(skillCode),
      evaluation,
      zone,
      subzone,
      fromZone: this.fromZone,
      fromSubzone: this.fromZone ? this.fromSubzone : null,
      code: buildActionCode(this.team, number, skillCode, evaluation, this.fromZone, this.fromSubzone, zone, subzone),
    };

    this.actionLog.add(action);
    this.reset();
  }
}
