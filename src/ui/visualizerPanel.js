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
// described), and they always get an arrow — from an explicit `from`
// zone if one was typed, otherwise from a generic point at the net on
// the attacking team's own side, since the ball demonstrably crossed
// the net even when the exact launch zone wasn't recorded. Every other
// skill (reception, set, block, dig, freeball) happens entirely within
// the acting team's own court, so its zone (and any `from` zone) stays
// on that team's own half.
//
// The 18 zone cells are clickable — click inserts that cell's zone (and
// its quadrant, from where in the cell you click) into the Rally Line
// textbox at the cursor, the same "point at where it landed" workflow
// openvolley's ovscout2 uses on a video frame, applied to this diagram.
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

// y of the half's own top edge: Away sits above the net (y=0..300),
// Home below it (y=320..620).
function yOffsetFor(team) {
  return team === 'home' ? HALF_H + NET_GAP : 0;
}

export function mountVisualizerPanel(root, { actionLog, rallyPanel, roster }) {
  root.innerHTML = `
    <div class="panel-header">
      <span>Court Visualizer <span class="viz-caption">click a zone to insert it</span></span>
    </div>
    <svg class="court-svg" viewBox="0 0 300 ${TOTAL_H}" role="img" aria-label="Volleyball court target-zone diagram, both teams">
      <defs>
        <marker id="viz-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="var(--accent)"/>
        </marker>
      </defs>
      ${halfFrame('away')}
      ${halfFrame('home')}
      <rect x="0" y="${HALF_H}" width="300" height="${NET_GAP}" fill="var(--accent)" opacity="0.9"/>
      <text x="150" y="${HALF_H + NET_GAP / 2 + 4}" text-anchor="middle" font-size="10" font-weight="700" letter-spacing="1" fill="#0e1117" font-family="Consolas, monospace">NET</text>
      <text class="half-label" data-team="away" x="150" y="14" text-anchor="middle" font-size="11" fill="var(--text-dim)" font-family="Consolas, monospace"></text>
      <text class="half-label" data-team="home" x="150" y="${TOTAL_H - 6}" text-anchor="middle" font-size="11" fill="var(--text-dim)" font-family="Consolas, monospace"></text>
      <g class="court-zone-cells">${zoneCells('away')}${zoneCells('home')}</g>
      ${zoneLabels('away')}${zoneLabels('home')}
      <g class="court-trails" pointer-events="none"></g>
      <g class="court-markers" pointer-events="none"></g>
    </svg>
    <div class="viz-legend"></div>
    <div class="viz-empty">Click a cell to insert its zone into the rally line.</div>
  `;

  const markersLayer = root.querySelector('.court-markers');
  const trailsLayer = root.querySelector('.court-trails');
  const legend = root.querySelector('.viz-legend');
  const empty = root.querySelector('.viz-empty');

  function renderHalfLabels() {
    root.querySelectorAll('.half-label').forEach((el) => {
      el.textContent = roster.teamName(el.dataset.team);
    });
  }

  // Cells carry fixed team + row/col; the zone number they represent
  // comes straight from that team's own grid, so clicking a cell always
  // inserts the number actually printed on it.
  root.querySelector('.court-zone-cells').addEventListener('click', (e) => {
    const cell = e.target.closest('.zone-cell');
    if (!cell) return;
    const team = cell.dataset.team;
    const row = Number(cell.dataset.row), col = Number(cell.dataset.col);
    const zone = gridFor(team)[row][col];
    const rect = cell.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    // Quadrant of the clicked cell: a=near-left, b=near-right, c=far-left, d=far-right.
    const subzone = py < 0.5 ? (px < 0.5 ? 'a' : 'b') : (px < 0.5 ? 'c' : 'd');
    rallyPanel.insertAtCursor(String(zone) + subzone);
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

  // A generic point at the net on `team`'s own side, used as the arrow's
  // start when a cross-net action didn't record an explicit origin zone.
  function netEdgePoint(team) {
    return { x: 150, y: team === 'home' ? HALF_H + NET_GAP + 30 : HALF_H - 30 };
  }

  function targetPoint(a) {
    if (!a.zone) return null;
    const half = CROSS_NET_SKILLS[a.skill] ? opposite(a.team) : a.team;
    return pointInHalf(half, a.zone, a.subzone);
  }

  function originPoint(a) {
    if (a.fromZone) return pointInHalf(a.team, a.fromZone, a.fromSubzone);
    if (CROSS_NET_SKILLS[a.skill]) return netEdgePoint(a.team);
    return null;
  }

  function render() {
    const located = actionLog
      .list()
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
