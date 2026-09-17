import { Roster } from './roster/roster.js';
import { VideoSource } from './video/videoSource.js';
import { ActionLog } from './scouting/actionLog.js';
import { ActionCoder } from './scouting/actionCoder.js';
import { Scoreboard } from './scouting/scoreboard.js';
import { RallyCommitter } from './scouting/rallyCommitter.js';
import { StatsEngine } from './stats/statsEngine.js';

import { mountVideoPanel } from './ui/videoPanel.js';
import { mountRosterPanel } from './ui/rosterPanel.js';
import { mountCodingPanel } from './ui/codingPanel.js';
import { mountRallyPanel } from './ui/rallyPanel.js';
import { mountVisualizerPanel } from './ui/visualizerPanel.js';
import { mountStatsPanel } from './ui/statsPanel.js';
import { mountScorePanel } from './ui/scorePanel.js';
import { mountReportPanel } from './ui/reportPanel.js';

const roster = new Roster();
const videoEl = document.createElement('video');
videoEl.autoplay = true;
videoEl.playsInline = true;
const videoSource = new VideoSource(videoEl);
const actionLog = new ActionLog();
const actionCoder = new ActionCoder({ roster, videoSource, actionLog });
const scoreboard = new Scoreboard();
const rallyCommitter = new RallyCommitter({ roster, videoSource, actionLog, scoreboard });
const statsEngine = new StatsEngine();

mountVideoPanel(document.getElementById('video-panel'), { videoSource, videoEl });
mountScorePanel(document.getElementById('score-panel'), { roster, scoreboard });
mountRosterPanel(document.getElementById('roster-panel'), { roster, actionCoder });
mountCodingPanel(document.getElementById('coding-panel'), { actionCoder, actionLog, roster, videoSource, scoreboard });
mountRallyPanel(document.getElementById('rally-panel'), { rallyCommitter, roster });
mountVisualizerPanel(document.getElementById('visualizer-panel'), { actionLog, actionCoder, roster });
mountStatsPanel(document.getElementById('stats-panel'), { statsEngine, actionLog, roster });
mountReportPanel(document.getElementById('report-panel'), { statsEngine, actionLog, roster, scoreboard });

actionCoder.attach();

// Surface a couple of internals for quick console poking during the demo.
window.vballstat = { roster, videoSource, actionLog, actionCoder, scoreboard, rallyCommitter, statsEngine };
