import { COURT_ZONES, SKILLS, SKILL_ORDER, evalLabel } from '../scouting/codes.js';

// Court-zone visualizer: plots the location of recent scouted actions
// (however they were entered — Rally Line Input, assisted by a roster
// or court click) on the standard DataVolley 3x3 target grid, with
// quadrant-precise subzone placement and a trajectory arrow when an
// action carries a from>to zone pair.
//
// The 9 zone cells are also clickable — click inserts that zone (and
// its quadrant, from where in the cell you click) into the Rally Line
// textbox at the cursor, the same "point at where it landed" workflow
// openvolley's ovscout2 uses on a video frame, applied to this diagram.
//
// A single court diagram can only show one team's zone numbering the
// right way up at a time — 1 is always "back right *from that team's
// own baseline*". Reading the opposing team's serve/attack zones off
// the same diagram means mentally mirroring it, which is slow and
// error-prone while coding live. The Invert toggle instead redraws the
// grid rotated 180° (so the numbers you read are pre-filled correctly
// for whichever side you're currently coding) rather than asking the
// scout to do that flip in their head.
const SKILL_COLOR = {
  S: '#4fb3ff', // serve
  E: '#c084fc', // set
  A: '#ff5470', // attack
  R: '#35d07f',
  B: '#f2c94c',
  D: '#e39a4f',
  F: '#8b95ac',
};

const TRAIL_LENGTH = 8;

function rotate180(grid) {
  return grid.slice().reverse().map((row) => row.slice().reverse());
}

export function mountVisualizerPanel(root, { actionLog, rallyPanel, roster }) {
  root.innerHTML = `
    <div class="panel-header">
      <span>Court Visualizer <span class="viz-caption">click a zone to insert it</span></span>
      <button class="invert-toggle" type="button" aria-pressed="false">⇅ Invert court</button>
    </div>
    <svg class="court-svg" viewBox="0 0 300 300" role="img" aria-label="Volleyball court target-zone diagram">
      <defs>
        <marker id="viz-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="var(--accent)"/>
        </marker>
      </defs>
      <rect x="2" y="2" width="296" height="296" fill="none" stroke="var(--panel-border)" stroke-width="2"/>
      <line x1="2" y1="2" x2="298" y2="2" stroke="var(--accent)" stroke-width="4"/>
      ${gridLines()}
      <g class="court-zone-cells">${zoneCells()}</g>
      <g class="court-zone-labels"></g>
      <g class="court-trails" pointer-events="none"></g>
      <g class="court-markers" pointer-events="none"></g>
    </svg>
    <div class="viz-legend"></div>
    <div class="viz-empty">Net at top. Click a cell to insert its zone into the rally line.</div>
  `;

  const invertBtn = root.querySelector('.invert-toggle');
  const zoneLabelsLayer = root.querySelector('.court-zone-labels');
  const markersLayer = root.querySelector('.court-markers');
  const trailsLayer = root.querySelector('.court-trails');
  const legend = root.querySelector('.viz-legend');
  const empty = root.querySelector('.viz-empty');

  let inverted = false;
  function currentZones() {
    return inverted ? rotate180(COURT_ZONES) : COURT_ZONES;
  }

  function renderZoneLabels() {
    const grid = currentZones();
    let s = '';
    grid.forEach((row, r) => {
      row.forEach((zone, c) => {
        s += `<text x="${c * 100 + 8}" y="${r * 100 + 20}" font-size="13" fill="var(--text-dim)" font-family="Consolas, monospace" pointer-events="none">${zone}</text>`;
      });
    });
    zoneLabelsLayer.innerHTML = s;
  }

  invertBtn.addEventListener('click', () => {
    inverted = !inverted;
    invertBtn.setAttribute('aria-pressed', String(inverted));
    invertBtn.classList.toggle('active', inverted);
    renderZoneLabels();
    render();
  });

  // --- zone cell click handling: inserts <zone><subzone> at the Rally Line cursor ---
  // Cells carry fixed row/col; the zone NUMBER shown/inserted is looked up
  // through currentZones() so it always matches what's currently drawn.
  root.querySelector('.court-zone-cells').addEventListener('click', (e) => {
    const cell = e.target.closest('.zone-cell');
    if (!cell) return;
    const row = Number(cell.dataset.row), col = Number(cell.dataset.col);
    const zone = currentZones()[row][col];
    const rect = cell.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    // Quadrant of the clicked cell: a=near-left, b=near-right, c=far-left, d=far-right.
    const subzone = py < 0.5 ? (px < 0.5 ? 'a' : 'b') : (px < 0.5 ? 'c' : 'd');
    rallyPanel.insertAtCursor(String(zone) + subzone);
  });

  function zoneCenter(zone) {
    const grid = currentZones();
    for (let r = 0; r < 3; r++) {
      const c = grid[r].indexOf(zone);
      if (c !== -1) return { x: c * 100 + 50, y: r * 100 + 50 };
    }
    return null;
  }

  // Subzone quadrant offsets within a 100x100 cell: a=near-left,
  // b=near-right, c=far-left, d=far-right (relative to the net at top).
  const SUBZONE_OFFSET = { a: [-22, -22], b: [22, -22], c: [-22, 22], d: [22, 22] };

  function point(zone, subzone) {
    const p = zoneCenter(zone);
    if (!p) return null;
    const off = subzone && SUBZONE_OFFSET[subzone] ? SUBZONE_OFFSET[subzone] : [0, 0];
    return { x: p.x + off[0], y: p.y + off[1] };
  }

  function render() {
    const located = actionLog
      .list()
      .filter((a) => a.zone)
      .slice(-TRAIL_LENGTH);

    trailsLayer.innerHTML = located
      .map((a) => {
        if (!a.fromZone) return '';
        const from = point(a.fromZone, a.fromSubzone);
        const to = point(a.zone, a.subzone);
        if (!from || !to) return '';
        const color = SKILL_COLOR[a.skill] || '#8b95ac';
        return `<line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" stroke="${color}" stroke-width="2" opacity="0.75" marker-end="url(#viz-arrow)"/>`;
      })
      .join('');

    markersLayer.innerHTML = located
      .map((a, i) => {
        const p = point(a.zone, a.subzone);
        if (!p) return '';
        const color = SKILL_COLOR[a.skill] || '#8b95ac';
        const isLatest = i === located.length - 1;
        const opacity = isLatest ? 1 : 0.35 + (0.4 * i) / Math.max(1, located.length - 1);
        const label = `${a.team === 'home' ? roster.teamName('home') : roster.teamName('away')} #${a.playerNumber} ${a.skillName} — ${evalLabel(a.skill, a.evaluation)} (${a.fromZone ? `zone ${a.fromZone}${a.fromSubzone || ''} → ` : ''}zone ${a.zone}${a.subzone || ''})`;
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
  renderZoneLabels();
  render();
}

function gridLines() {
  let s = '';
  for (let i = 1; i < 3; i++) {
    s += `<line x1="${i * 100}" y1="0" x2="${i * 100}" y2="300" stroke="var(--panel-border)" stroke-width="1"/>`;
    s += `<line x1="0" y1="${i * 100}" x2="300" y2="${i * 100}" stroke="var(--panel-border)" stroke-width="1"/>`;
  }
  return s;
}

// Cells carry fixed physical row/col (never change); the zone number
// they represent depends on the current orientation, so it's looked up
// at click/render time rather than baked in here.
function zoneCells() {
  let s = '';
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      s += `<rect class="zone-cell" data-row="${r}" data-col="${c}" x="${c * 100}" y="${r * 100}" width="100" height="100" fill="transparent" style="cursor:pointer"><title>Click to insert this zone</title></rect>`;
    }
  }
  return s;
}

function escapeXml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
