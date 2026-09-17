# vballstat — Live Volleyball Scouting Prototype

A browser-based prototype of a **computer-facing volleyball statistical
analysis tool**, modeled on the live-scouting workflow used by
**DataVolley 4** and **VolleyStation**: an analyst watches a live video
feed of the match and types short keyboard codes for every player action
as it happens. Each code is instantly parsed, timestamped against the
video clock, and folded into a live-updating stats table — no batch
processing, no post-game entry.

This is a functional prototype focused on the *scouting loop* (video →
keystroke → structured action → live stats), not a full production
system. It runs entirely in the browser with no backend and no build
step.

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
2. **Start the video feed.** Choose either:
   - **Webcam (live)** — a real live video feed, clock starts on "Start
     match clock".
   - **Video file** — load a local recording and code it exactly like a
     live feed, using the video's own playback clock as the sync source.
3. **Code the action while watching.** With focus anywhere outside a
   text field, type the sequence:

   `<team> <player#> <skill> <evaluation>`

   - Team: `H` (Home) or `A` (Away)
   - Player number: digits (e.g. `7`)
   - Skill: `S` Serve · `R` Reception · `E` Set · `A` Attack · `B` Block ·
     `D` Dig · `F` Freeball
   - Evaluation: `#` Perfect `+` Positive `!` Exclamation/OK `-` Negative
     `/` Poor `=` Error

   Example: `h7a#` = Home, player #7, Attack, Perfect (kill). The moment
   the evaluation key is pressed the action commits, is stamped with the
   current video time, and the stats table updates immediately.

   `Backspace` steps back one stage, `Esc` clears the current entry,
   `Ctrl+Z` undoes the last committed action. Players can also be picked
   by clicking their roster row instead of typing the number.

4. **Read the live stats table.** Per-player and per-team rows break
   down attempts and evaluation counts for every skill, with the
   standard efficiency metrics (kill %, error %, efficiency, positive %)
   recomputed after every keystroke.
5. **Export.** The play-by-play log (with true video timestamps) and the
   aggregated stats table can both be exported to CSV/JSON for later
   analysis, matching how DataVolley exports scouting files.

## Architecture

```
index.html            shell + panel layout
src/main.js            wires all modules together
src/roster/            team & player roster, localStorage persistence
src/video/             webcam / video-file source, unified clock API
src/scouting/          keyboard state machine -> structured Action, action log + undo
src/stats/             skill formulas + live aggregation engine
src/ui/                DOM rendering for each panel (no framework)
```

The important architectural idea, carried over directly from DataVolley
scouting practice: **the video clock is the single source of truth for
timing**. Every committed action is stamped with `video.currentTime()`
(webcam elapsed time, or the loaded video file's `currentTime`), not
`Date.now()`, so the play-by-play log stays frame-accurate against the
footage regardless of when the scout actually pressed the key.

## Not in scope for this prototype

- Automatic rally/rotation/score tracking (score is a manual counter for
  context)
- Computer-vision player/ball tracking — actions are analyst-entered, as
  in real DataVolley/VolleyStation usage
- Multi-set match/league management, video-clip cutting, and PDF reports
