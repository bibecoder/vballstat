# vballstat — Live Volleyball Scouting Prototype

A browser-based prototype of a **computer-facing volleyball statistical
analysis tool**, modeled on the live-scouting workflow used by
**DataVolley 4** and **VolleyStation**: an analyst watches a live video
feed of the match and types a short code for each rally as it happens.
Each code is instantly parsed, timestamped against the video clock, and
folded into a live-updating stats table — no batch processing, no
post-game entry.

This is a functional prototype focused on the *scouting loop* (video →
code → structured action → live stats), not a full production system.
It runs entirely in the browser with no backend and no build step.

## Running it

Because the app uses ES modules and (optionally) the webcam, open it
through a local web server rather than as a `file://` URL:

```bash
node server.js        # zero-dependency static server
# then open http://localhost:8000
```

or, equivalently, `python3 -m http.server 8000`.

## Workflow

1. **Set up rosters.** The Roster panel comes pre-loaded with two sample
   teams (Home / Away). Edit team names, jersey numbers, and player
   names — this mirrors DataVolley's pre-match roster setup.
2. **Start the video feed.** Choose one of:
   - **Webcam (live)** — a real live video feed, clock starts on "Start
     match clock".
   - **Video file** — load a local recording and code it exactly like a
     live feed, using the video's own playback clock as the sync source.
   - **YouTube** — paste any YouTube link (watch/youtu.be/embed/shorts,
     or a bare video ID) into the field under the video controls and
     click "Load YouTube" to code straight off game film someone's
     shared as a link rather than a file; "Load reference clip" loads
     one preset example video the same way. Embedded via YouTube's own
     IFrame Player API, so the app still gets a real playback clock
     (the player's own `getCurrentTime()`) to timestamp actions against,
     the same role `.currentTime` plays for a loaded file.
3. **Type the rally in Rally Line Input**, the sole manual-entry method,
   sitting directly under the play-by-play log. Type the whole point as
   one line, using the same compact code for every action:

   `<Team><Player#><Skill>[From>/-]Zone[Subzone]<Evaluation>`

   - Team: `H` (Home) or `A` (Away)
   - Player number: digits (e.g. `7`)
   - Skill: `S` Serve · `R` Reception · `E` Set · `A` Attack · `B` Block ·
     `D` Dig · `F` Freeball
   - Zone (optional): a target zone `1`-`9` on the standard DataVolley
     grid, an optional quadrant letter `a`-`d` for extra precision, and
     an optional `<origin>` prefix for a full start→end trajectory.
     Serve uses `-` (e.g. `6-8a` = served from position 6, landed at
     zone 8, near-left quadrant), since a serve's "from" is where the
     server stood, not an in-court trajectory; every other skill uses
     `>` (e.g. `3>5a` = attacked from zone 3 to zone 5, near-left
     quadrant). Both separators parse the same either way — this only
     affects which one gets written back into the log/exports.
   - Evaluation: `#` Perfect `+` Positive `!` Exclamation/OK `-` Negative
     `/` Poor `=` Error

   Separate actions with `;` or spaces, and close the rally with `HP` /
   `AP` (team letter + `P`) to award the point — the older two-word
   `Point H` / `Point A` still works too, `HP`/`AP` is just the fast
   version. Example: `H13S6-8a+; A27R+; H9E4#; H7A#; HP`. Press `Enter`
   (or "Commit rally") to commit the whole line at once, stamped with
   the current video time.

   **Click to assist typing** instead of typing every character:
   clicking a roster player inserts their `H13`-style token at the
   cursor; clicking a zone on the Court Visualizer inserts that zone
   (and its quadrant, based on where in the cell you click). **Dragging**
   from one zone to another inserts a full origin+target segment in one
   motion (e.g. `4a-5d` or `4a>5d`, the right separator picked
   automatically from whatever skill letter you've already typed on
   that token) instead of just the target — the same trajectory the
   `<origin>` syntax supports, drawn instead of typed. The "2-click
   trajectory" toggle above the diagram switches a plain click into a
   two-step version of the same thing: click once to drop a start point
   (shown highlighted), click again to complete it; clicking that same
   pending cell again cancels it. A collapsed "Show code reference"
   panel under the input recaps the full code table for new users.
   `Ctrl+Z` undoes the last committed action from anywhere.

4. **Read the court visualizer.** One diagram shows both teams' courts
   at once, net in the middle — Away's zone grid above it (pre-rotated
   180° for their own baseline), Home's below (normal orientation) —
   so neither team's numbers ever need mentally mirroring. A dashed
   "serve zone" strip sits outside each team's own baseline (behind the
   grid entirely): every Serve's arrow starts there, since a serve is
   struck from behind the end line, not from inside the court — the
   rally line's `<start>-` zone/subzone still controls where along that
   baseline it's drawn. Attack also crosses the net, landing in the
   *opposing* team's half (using that team's own numbering), with its
   arrow starting from an explicit `from` zone if one was typed or
   otherwise from a generic point at the net on the attacking side.
   Every other skill (reception, set, block, dig, freeball) stays
   within the acting team's own half.
5. **Read the live stats table and match report.** Per-player and
   per-team rows break down attempts and evaluation counts for every
   skill, with standard efficiency metrics (kill %, error %, efficiency,
   positive %) recomputed after every commit. The Match Report panel
   adds a readable summary: score, per-team skill totals, top performer
   per skill, and error leaders.
6. **Export / import.** The play-by-play log (with true video
   timestamps) exports to CSV, JSON, or a DataVolley-structured DVW file
   (real section names, our own simplified row encoding — see
   `src/scouting/dvwFormat.js` for the fidelity caveat); DVW files this
   app exported can be re-imported to restore the full session.

## Architecture

```
index.html              shell + panel layout
src/main.js              wires all modules together
src/roster/               team & player roster, localStorage persistence
src/video/                 webcam / video-file source, unified clock API
src/scouting/               rally-line parser/committer, action log + undo,
                             scoreboard, DVW export/import
src/stats/                   skill formulas + live aggregation engine
src/ui/                       DOM rendering for each panel (no framework)
```

The important architectural idea, carried over directly from DataVolley
scouting practice: **the video clock is the single source of truth for
timing**. Every committed action is stamped with `video.currentTime()`
(webcam elapsed time, or the loaded video file's `currentTime`), not
`Date.now()`, so the play-by-play log stays frame-accurate against the
footage regardless of when the scout actually typed the line.

## Not in scope for this prototype

- Automatic rally/rotation/score tracking (score is a manual counter for
  context)
- Computer-vision player/ball tracking — actions are analyst-entered, as
  in real DataVolley/VolleyStation usage
- Byte-exact DataVolley `.dvw` compatibility, per-zone "distribution"
  heatmap grids, and timeout/substitution tracking
- Multi-set match/league management, video-clip cutting, and PDF reports
