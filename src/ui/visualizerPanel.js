import { COURT_ZONES, SKILLS, SKILL_ORDER, evalLabel } from '../scouting/codes.js';

// Court-zone visualizer: a single diagram showing BOTH teams' courts at
// once, net in the middle, each half labeled with that team's own zone
// numbering — Home's normal grid below the net, Away's grid rotated
// 180° above it. A single court can only show one team's numbering the
// right way up (zone 1 is always "back right *from that team's own
// baseline*"); stacking both, each pre-rotated for its own side, means
// neither team's numbers ever need to be read mirrored in your head.
//
// Serve and Attack ("hit") are the two skills that cross the net: their
// target zone is drawn on the OPPOSING team's half (using the opposing
// team's own numbering, matching how a landing zone is conventionally
// described), and they always get an arrow. Attack's arrow starts from
// an explicit `from` zone if one was typed, otherwise from a generic
// point at the net on the attacking team's own side, since the ball
// demonstrably crossed the net even when the exact launch zone wasn't
// recorded. Serve is different: it never starts inside the court at
// all — a thin "serve zone" strip behind each team's own baseline
// (outside the 3x3 grid entirely) is where every serve's arrow starts,
// since a serve is by definition struck from behind the end line. The
// rally line's existing `<origin>>` zone/subzone still controls *where
// along that baseline* the marker sits (its column, and a left/right
// nudge from the subzone) — there's no separate input for it. Every
// other skill (reception, set, block, dig, freeball) happens entirely
// within the acting team's own court, so its zone (and any `from`
// zone) stays inside that team's own half.
//
// The 18 zone cells are clickable — a single click inserts that cell's
// zone (and its quadrant, from where in the cell you click) into the
// Rally Line textbox at the cursor, the same "point at where it
// landed" workflow openvolley's ovscout2 uses on a video frame, applied
// to this diagram. A press-drag from one cell to a different one, or
// (with the "2-click" toggle on) two separate clicks, inserts a full
// origin+target segment instead of a single zone — the same start/end
// trajectory the rally line's <origin>> or <origin>- syntax already
// supports, drawn instead of typed. Dragging always works; the toggle
// only changes what a same-cell press+release (an ordinary click) does.
//
// The diagram only ever shows the rally currently being reviewed, not a
// trail accumulated across the whole match: RallyCommitter.onCommit
// fires right as each new rally line is committed (before its actions
// are added to the log), which resets rallyStartIndex to "here" so the
// previous rally's markers/arrows disappear and only the new rally's
// own actions get drawn as they come in.
const SKILL_COLOR = {
  S: '#4fb3ff', // serve
  E: '#c084fc', // set
  A: '#ff5470', // attack
  R: '#35d07f',
  B: '#f2c94c',
  D: '#e39a4f',
  F: '#8b95ac',
};

const CROSS_NET_SKILLS = { S: true, A: true };
const TRAIL_LENGTH = 8;
const HALF_H = 300; // px height of one team's half in the SVG
const NET_GAP = 20; // px gap drawn between the two halves
const TOTAL_H = HALF_H * 2 + NET_GAP;
const SERVE_ZONE = 34; // px strip behind each baseline where serve origins are drawn
const SVG_H = TOTAL_H + SERVE_ZONE * 2;

function rotate180(grid) {
  return grid.slice().reverse().map((row) => row.slice().reverse());
}

function opposite(team) {
  return team === 'home' ? 'away' : 'home';
}

// Away's grid is Home's grid rotated 180°: physically stacking Home's
// normal layout below the net and this rotated layout above it is what
// makes both teams' zone numbers read correctly from a single fixed
// viewing angle (see module doc comment above).
function gridFor(team) {
  return team === 'home' ? COURT_ZONES : rotate180(COURT_ZONES);
}

// y of the half's own top edge, shifted down by SERVE_ZONE so a strip
// for behind-the-baseline serve origins fits above Away's court and
// below Home's. Away sits above the net, Home below it.
function yOffsetFor(team) {
  return SERVE_ZONE + (team === 'home' ? HALF_H + NET_GAP : 0);
}

// A serve's real origin is behind the end line, outside the 3x3 zone
// grid entirely — never inside the court like every other skill's
// from-zone. x comes from the from-zone's column (so the rally line's
// existing <origin>> zone/subzone still says roughly where along the
// baseline the server stood); y is fixed in that team's serve strip.
function serveOriginPoint(a) {
  const grid = gridFor(a.team);
  let x = 150;
  if (a.fromZone) {
    for (let r = 0; r < 3; r++) {
      const c = grid[r].indexOf(a.fromZone);
      if (c !== -1) { x = c * 100 + 50; break; }
    }
    if (a.fromSubzone === 'a' || a.fromSubzone === 'c') x -= 22;
    else if (a.fromSubzone === 'b' || a.fromSubzone === 'd') x += 22;
  }
  const y = a.team === 'home' ? SERVE_ZONE + TOTAL_H + SERVE_ZONE / 2 : SERVE_ZONE / 2;
  return { x, y };
}

export function mountVisualizerPanel(root, { actionLog, rallyPanel, roster, rallyCommitter }) {
  root.innerHTML = `
    <div class="panel-header">
      <span>Court Visualizer <span class="viz-caption">click a zone, or drag from one zone to another</span></span>
      <button type="button" class="viz-mode-toggle" aria-pressed="false">2-click trajectory: Off</button>
    </div>
    <svg class="court-svg" viewBox="0 0 300 ${SVG_H}" role="img" aria-label="Volleyball court target-zone diagram, both teams, with serve zones behind each baseline">
      <defs>
        <marker id="viz-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="var(--accent)"/>
        </marker>
      </defs>
      <rect x="0" y="0" width="300" height="${SERVE_ZONE}" fill="var(--panel-border)" opacity="0.35"/>
      <rect x="0" y="${SERVE_ZONE + TOTAL_H}" width="300" height="${SERVE_ZONE}" fill="var(--panel-border)" opacity="0.35"/>
      <line x1="0" y1="${SERVE_ZONE}" x2="300" y2="${SERVE_ZONE}" stroke="var(--text-dim)" stroke-width="1.5" stroke-dasharray="4 3"/>
      <line x1="0" y1="${SERVE_ZONE + TOTAL_H}" x2="300" y2="${SERVE_ZONE + TOTAL_H}" stroke="var(--text-dim)" stroke-width="1.5" stroke-dasharray="4 3"/>
      <text x="4" y="${SERVE_ZONE - 5}" font-size="8" letter-spacing="0.5" fill="var(--text-dim)" font-family="Consolas, monospace">SERVE ZONE</text>
      <text x="4" y="${SERVE_ZONE + TOTAL_H + 13}" font-size="8" letter-spacing="0.5" fill="var(--text-dim)" font-family="Consolas, monospace">SERVE ZONE</text>
      ${halfFrame('away')}
      ${halfFrame('home')}
      <rect x="0" y="${SERVE_ZONE + HALF_H}" width="300" height="${NET_GAP}" fill="var(--accent)" opacity="0.9"/>
      <text x="150" y="${SERVE_ZONE + HALF_H + NET_GAP / 2 + 4}" text-anchor="middle" font-size="10" font-weight="700" letter-spacing="1" fill="#0e1117" font-family="Consolas, monospace">NET</text>
      <text class="half-label" data-team="away" x="150" y="14" text-anchor="middle" font-size="11" fill="var(--text-dim)" font-family="Consolas, monospace"></text>
      <text class="half-label" data-team="home" x="150" y="${SVG_H - 6}" text-anchor="middle" font-size="11" fill="var(--text-dim)" font-family="Consolas, monospace"></text>
      <g class="court-zone-cells">${zoneCells('away')}${zoneCells('home')}</g>
      ${zoneLabels('away')}${zoneLabels('home')}
      <g class="court-trails" pointer-events="none"></g>
      <g class="court-markers" pointer-events="none"></g>
      <g class="court-input-preview" pointer-events="none"></g>
    </svg>
    <div class="viz-legend"></div>
    <div class="viz-empty">Click a cell to insert its zone into the rally line.</div>
  `;

  const svg = root.querySelector('.court-svg');
  const markersLayer = root.querySelector('.court-markers');
  const trailsLayer = root.querySelector('.court-trails');
  const previewLayer = root.querySelector('.court-input-preview');
  const legend = root.querySelector('.viz-legend');
  const empty = root.querySelector('.viz-empty');
  const modeToggle = root.querySelector('.viz-mode-toggle');

  // Index into actionLog.list() where the current rally's own actions
  // begin. Reset on every commit (before its actions are added) so the
  // diagram shows only the rally just played, not a trail accumulated
  // across the whole match.
  let rallyStartIndex = 0;

  function renderHalfLabels() {
    root.querySelectorAll('.half-label').forEach((el) => {
      el.textContent = roster.teamName(el.dataset.team);
    });
  }

  // Cells carry fixed team + row/col; the zone number they represent
  // comes straight from that team's own grid, so a click/drag on a
  // cell always resolves to the number actually printed on it.
  function cellInfoFromEvent(e) {
    const cell = e.target.closest('.zone-cell');
    if (!cell) return null;
    const team = cell.dataset.team;
    const row = Number(cell.dataset.row), col = Number(cell.dataset.col);
    const zone = gridFor(team)[row][col];
    const rect = cell.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    // Quadrant of the cell: a=near-left, b=near-right, c=far-left, d=far-right.
    const subzone = py < 0.5 ? (px < 0.5 ? 'a' : 'b') : (px < 0.5 ? 'c' : 'd');
    return { team, row, col, zone, subzone };
  }

  function sameCell(a, b) {
    return !!a && !!b && a.team === b.team && a.row === b.row && a.col === b.col;
  }

  function findCellEl(info) {
    return root.querySelector(`.zone-cell[data-team="${info.team}"][data-row="${info.row}"][data-col="${info.col}"]`);
  }

  // Converts a mouse event's screen position into the SVG's own user
  // space, accounting for however the viewBox is currently scaled —
  // needed for the live drag-preview line to track the cursor accurately.
  function svgPointFromEvent(e) {
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }

  let twoClickMode = false;
  let dragStart = null;
  let pendingClickStart = null;

  function clearPendingHighlight() {
    root.querySelectorAll('.zone-cell-pending').forEach((el) => el.classList.remove('zone-cell-pending'));
  }

  function cancelPending() {
    pendingClickStart = null;
    clearPendingHighlight();
  }

  modeToggle.addEventListener('click', () => {
    twoClickMode = !twoClickMode;
    cancelPending();
    modeToggle.textContent = `2-click trajectory: ${twoClickMode ? 'On' : 'Off'}`;
    modeToggle.setAttribute('aria-pressed', String(twoClickMode));
  });

  // A same-cell press+release is an ordinary click: in the default
  // mode it inserts that single zone (unchanged); with 2-click mode on,
  // the first click drops a pending start (highlighted) and the second
  // completes the pair, the click-driven counterpart to a drag.
  function handlePlainClick(info) {
    if (!twoClickMode) {
      rallyPanel.insertAtCursor(String(info.zone) + info.subzone);
      return;
    }
    if (!pendingClickStart) {
      pendingClickStart = info;
      findCellEl(info)?.classList.add('zone-cell-pending');
      return;
    }
    const start = pendingClickStart;
    const wasSameCell = sameCell(start, info);
    cancelPending();
    if (wasSameCell) return; // clicking the pending cell again cancels it
    rallyPanel.insertZonePair(start.zone, start.subzone, info.zone, info.subzone);
  }

  function onDocMouseMove(e) {
    if (!dragStart) return;
    const from = pointInHalf(dragStart.team, dragStart.zone, dragStart.subzone);
    const to = svgPointFromEvent(e);
    if (!from) return;
    previewLayer.innerHTML = `<line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" stroke="var(--accent)" stroke-width="2" stroke-dasharray="4 3" opacity="0.85"/>`;
  }

  function onDocMouseUp(e) {
    document.removeEventListener('mousemove', onDocMouseMove);
    previewLayer.innerHTML = '';
    const start = dragStart;
    dragStart = null;
    if (!start) return;
    const end = cellInfoFromEvent(e);
    if (end && !sameCell(start, end)) {
      rallyPanel.insertZonePair(start.zone, start.subzone, end.zone, end.subzone);
      return;
    }
    // No real drag (released on the same cell, or off the court entirely
    // — treat that as "same cell" too, i.e. a plain click on the start).
    handlePlainClick(start);
  }

  root.querySelector('.court-zone-cells').addEventListener('mousedown', (e) => {
    const info = cellInfoFromEvent(e);
    if (!info) return;
    dragStart = info;
    document.addEventListener('mousemove', onDocMouseMove);
    document.addEventListener('mouseup', onDocMouseUp, { once: true });
  });

  function zoneCenter(team, zone) {
    const grid = gridFor(team);
    for (let r = 0; r < 3; r++) {
      const c = grid[r].indexOf(zone);
      if (c !== -1) return { x: c * 100 + 50, y: yOffsetFor(team) + r * 100 + 50 };
    }
    return null;
  }

  // Subzone quadrant offsets within a 100x100 cell: a=near-left,
  // b=near-right, c=far-left, d=far-right (relative to that half's own
  // near-net row).
  const SUBZONE_OFFSET = { a: [-22, -22], b: [22, -22], c: [-22, 22], d: [22, 22] };

  function pointInHalf(team, zone, subzone) {
    const p = zoneCenter(team, zone);
    if (!p) return null;
    const off = subzone && SUBZONE_OFFSET[subzone] ? SUBZONE_OFFSET[subzone] : [0, 0];
    return { x: p.x + off[0], y: p.y + off[1] };
  }

  // A generic point at the net on `team`'s own side, used as the Attack
  // arrow's start when a cross-net action didn't record an explicit
  // origin zone. Serve never uses this — see serveOriginPoint.
  function netEdgePoint(team) {
    return { x: 150, y: team === 'home' ? SERVE_ZONE + HALF_H + NET_GAP + 30 : SERVE_ZONE + HALF_H - 30 };
  }

  function targetPoint(a) {
    if (!a.zone) return null;
    const half = CROSS_NET_SKILLS[a.skill] ? opposite(a.team) : a.team;
    return pointInHalf(half, a.zone, a.subzone);
  }

  // Serve always originates behind the server's own baseline, never
  // inside the zone grid — even when a from-zone was typed, unlike
  // every other skill, where a from-zone marks a point inside the court.
  function originPoint(a) {
    if (a.skill === 'S') return serveOriginPoint(a);
    if (a.fromZone) return pointInHalf(a.team, a.fromZone, a.fromSubzone);
    if (CROSS_NET_SKILLS[a.skill]) return netEdgePoint(a.team);
    return null;
  }

  function render() {
    const located = actionLog
      .list()
      .slice(rallyStartIndex)
      .filter((a) => a.zone)
      .slice(-TRAIL_LENGTH);

    trailsLayer.innerHTML = located
      .map((a) => {
        const from = originPoint(a);
        const to = targetPoint(a);
        if (!from || !to) return '';
        const color = SKILL_COLOR[a.skill] || '#8b95ac';
        return `<line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" stroke="${color}" stroke-width="2" opacity="0.75" marker-end="url(#viz-arrow)"/>`;
      })
      .join('');

    markersLayer.innerHTML = located
      .map((a, i) => {
        const p = targetPoint(a);
        if (!p) return '';
        const color = SKILL_COLOR[a.skill] || '#8b95ac';
        const isLatest = i === located.length - 1;
        const opacity = isLatest ? 1 : 0.35 + (0.4 * i) / Math.max(1, located.length - 1);
        const landingTeam = CROSS_NET_SKILLS[a.skill] ? opposite(a.team) : a.team;
        const label = `${a.team === 'home' ? roster.teamName('home') : roster.teamName('away')} #${a.playerNumber} ${a.skillName} — ${evalLabel(a.skill, a.evaluation)} (${a.fromZone ? `zone ${a.fromZone}${a.fromSubzone || ''} → ` : ''}${roster.teamName(landingTeam)} zone ${a.zone}${a.subzone || ''})`;
        return `<g class="court-marker">
          <circle cx="${p.x}" cy="${p.y}" r="${isLatest ? 10 : 7}" fill="${color}" stroke="#0e1117" stroke-width="1.5" opacity="${opacity}">
            <title>${escapeXml(label)}</title>
          </circle>
          <text x="${p.x}" y="${p.y + 3}" text-anchor="middle" font-size="${isLatest ? 8 : 7}" fill="#0e1117" font-weight="700" pointer-events="none">${a.playerNumber}</text>
        </g>`;
      })
      .join('');

    empty.style.display = located.length ? 'none' : 'block';

    const usedSkills = SKILL_ORDER.filter((s) => located.some((a) => a.skill === s));
    legend.innerHTML = usedSkills
      .map((s) => `<span class="viz-legend-item"><span class="viz-dot" style="background:${SKILL_COLOR[s]}"></span>${SKILLS[s].name}</span>`)
      .join('');
  }

  actionLog.onChange(render);
  roster.onChange(renderHalfLabels);
  rallyCommitter.onCommit(() => {
    rallyStartIndex = actionLog.list().length;
    render();
  });
  renderHalfLabels();
  render();
}

function halfFrame(team) {
  const y = yOffsetFor(team);
  return `<rect x="2" y="${y + 2}" width="296" height="${HALF_H - 4}" fill="none" stroke="var(--panel-border)" stroke-width="2"/>`;
}

function gridLines(team) {
  const y = yOffsetFor(team);
  let s = '';
  for (let i = 1; i < 3; i++) {
    s += `<line x1="${i * 100}" y1="${y}" x2="${i * 100}" y2="${y + HALF_H}" stroke="var(--panel-border)" stroke-width="1"/>`;
    s += `<line x1="0" y1="${y + i * 100}" x2="300" y2="${y + i * 100}" stroke="var(--panel-border)" stroke-width="1"/>`;
  }
  return s;
}

// Cells carry a fixed team + physical row/col; the zone number printed
// in them comes straight from that team's own (possibly rotated) grid.
function zoneCells(team) {
  const grid = gridFor(team);
  const y = yOffsetFor(team);
  let s = '';
  grid.forEach((row, r) => {
    row.forEach((zone, c) => {
      s += `<rect class="zone-cell" data-team="${team}" data-row="${r}" data-col="${c}" x="${c * 100}" y="${y + r * 100}" width="100" height="100" fill="transparent" style="cursor:pointer"><title>Click to insert ${team} zone ${zone}</title></rect>`;
    });
  });
  return gridLines(team) + s;
}

function zoneLabels(team) {
  const grid = gridFor(team);
  const y = yOffsetFor(team);
  let s = '';
  grid.forEach((row, r) => {
    row.forEach((zone, c) => {
      s += `<text x="${c * 100 + 8}" y="${y + r * 100 + 20}" font-size="13" fill="var(--text-dim)" font-family="Consolas, monospace" pointer-events="none">${zone}</text>`;
    });
  });
  return s;
}

function escapeXml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
