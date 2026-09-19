import { Roster } from './roster/roster.js';
import { VideoSource } from './video/videoSource.js';
import { ActionLog } from './scouting/actionLog.js';
import { Scoreboard } from './scouting/scoreboard.js';
import { RallyCommitter } from './scouting/rallyCommitter.js';
import { StatsEngine } from './stats/statsEngine.js';

import { mountVideoPanel } from './ui/videoPanel.js';
import { mountRosterPanel } from './ui/rosterPanel.js';
import { mountLogPanel } from './ui/logPanel.js';
import { mountRallyPanel } from './ui/rallyPanel.js';
import { mountVisualizerPanel } from './ui/visualizerPanel.js';
import { mountStatsPanel } from './ui/statsPanel.js';
import { mountScorePanel } from './ui/scorePanel.js';
import { mountReportPanel } from './ui/reportPanel.js';

const roster = new Roster();
const videoEl = document.createElement('video');
videoEl.autoplay = true;
videoEl.playsInline = true;
const youtubeContainerEl = document.createElement('div');
const videoSource = new VideoSource(videoEl, youtubeContainerEl);
const actionLog = new ActionLog();
const scoreboard = new Scoreboard();
const rallyCommitter = new RallyCommitter({ roster, videoSource, actionLog, scoreboard });
const statsEngine = new StatsEngine();

mountVideoPanel(document.getElementById('video-panel'), { videoSource, videoEl, youtubeContainerEl });
mountScorePanel(document.getElementById('score-panel'), { roster, scoreboard });
mountLogPanel(document.getElementById('log-panel'), { actionLog, roster, videoSource, scoreboard });
const rallyPanel = mountRallyPanel(document.getElementById('rally-panel'), { rallyCommitter, roster });
mountRosterPanel(document.getElementById('roster-panel'), { roster, rallyPanel });
mountVisualizerPanel(document.getElementById('visualizer-panel'), { actionLog, rallyPanel, roster, rallyCommitter });
mountStatsPanel(document.getElementById('stats-panel'), { statsEngine, actionLog, roster });
mountReportPanel(document.getElementById('report-panel'), { statsEngine, actionLog, roster, scoreboard });

// The only global keyboard shortcut left once the keystroke buffer is
// gone: Ctrl+Z still undoes the last committed action from anywhere.
window.addEventListener('keydown', (e) => {
  const tag = document.activeElement?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    actionLog.undoLast();
  }
});

// Surface a couple of internals for quick console poking during the demo.
window.vballstat = { roster, videoSource, actionLog, scoreboard, rallyCommitter, statsEngine };
