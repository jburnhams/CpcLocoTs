# 02 — Speed Control & Line Highlighting

**Delivers:** Configurable speed execution, current-line highlighting in the editor, minimal debug UI panel. Together with doc 01 this forms the MVP.

## Speed control

### Library side

The `Debugger.speed` property (0–100) controls how fast the program runs.

**Throttle mechanism in `Debugger.onLine()`:**

- `speed === 100`: no throttling, run at full speed
- `speed === 0`: pause immediately (equivalent to stepping)
- `speed` 1–99: every N iterations, insert a timed pause via `vmStop("debug", 70)`

Mapping speed to delay:

```ts
interface SpeedConfig {
  linesPerChunk: number;   // how many lines to run before yielding
  delayMs: number;         // setTimeout delay between chunks
}
```

| Method | Signature | Description |
|--------|-----------|-------------|
| `setSpeed` | `(speed: number): void` | Already in doc 01. Updates internal `SpeedConfig` |
| `getSpeed` | `(): number` | Return current speed |

`Debugger` maintains a `lineCounter` reset each time execution resumes. In `onLine()`:

1. Increment `lineCounter`
2. If `lineCounter >= speedConfig.linesPerChunk`, reset counter, set `this.nextDelay = speedConfig.delayMs`, call `vmStop("debug", 70)`
3. Controller's debug handler uses `nextDelay` for `setTimeout` interval

### Controller side

**File:** `src/Controller.ts`

The `"debug"` handler in `fnRunLoop()` (added in doc 01) needs to:

1. Check `debugger.nextDelay`
2. If > 0: this is a speed-throttle pause, not a user-visible pause. Use `setTimeout(fnRunLoopHandler, delay)` instead of waiting for user input.
3. Emit a `DebugEvent` with type `"step"` so the UI can update the highlight even during speed-running.

Existing speed control (`Model.speed` / `fnSpeed`) handles CPC frame timing. The debugger speed is independent — it controls how many BASIC lines execute per JS event-loop tick.

## Line highlighting

### Source map

`CodeGeneratorJs` already maintains `sourceMap: Record<string, number[]>` — mapping BASIC line labels to source character positions. This is what we need.

| Method (CodeGeneratorJs) | Signature | Description |
|--------------------------|-----------|-------------|
| `getSourceMap` | `(): Record<string, number[]>` | Already exists — returns label-to-position map |

The `Debugger` needs access to the source text and source map to tell the UI which range to highlight.

### Debugger additions

```ts
interface LineRange {
  line: number | string;       // BASIC line number/label
  startPos: number;            // character offset in source
  endPos: number;              // character offset in source
}
```

| Method | Signature | Description |
|--------|-----------|-------------|
| `setSourceMap` | `(map: Record<string, number[]>): void` | Store source map from CodeGeneratorJs |
| `getCurrentLineRange` | `(): LineRange \| null` | Get highlight range for current line |

`setSourceMap()` is called by Controller after compilation.

### UI side — editor highlighting

**File:** `docs/src/UiDebugger.ts`

The BASIC source lives in a `<textarea id="inputText">` (`ViewID.inputText`). Textareas don't support inline highlighting. Two approaches:

**Option A (simple, MVP):** Add a `<div>` overlay below the textarea that shows a highlighted background on the current line. The textarea becomes transparent-background.

**Option B (simpler):** Scroll the textarea to the current line and show the line number in a status label. Use CSS to highlight the line with a separate indicator.

**Recommended for MVP: Option B** — a status line showing the current BASIC line number, plus auto-scroll of the textarea to that line. Highlighting via an overlay div can come later.

### Minimal debug UI panel

**File:** `docs/index.html` — add a debug panel (initially hidden, toggled with a "Debug" checkbox in Settings).

```
<fieldset id="debugArea">
  <legend>Debug</legend>
  <label>Speed: <input id="debugSpeedInput" type="range" min="0" max="100" value="50"></label>
  <span id="debugLineLabel">Line: —</span>
  <button id="debugPauseButton">Pause</button>
  <button id="debugResumeButton">Continue</button>
  <button id="debugStepIntoButton">Step</button>
</fieldset>
```

**File:** `docs/src/UiDebugger.ts`

```
Class: UiDebugger
```

| Method | Signature | Description |
|--------|-----------|-------------|
| `constructor` | `(controller: IController)` | Wire up DOM events |
| `onDebugEvent` | `(event: DebugEvent): void` | Listener passed to `Debugger.on()` |
| `updateLineHighlight` | `(range: LineRange): void` | Scroll textarea, update label |
| `updateControls` | `(state: DebugState): void` | Enable/disable buttons per state |

### Constants / ViewIDs to add

```ts
// Constants.ts additions
ModelPropID.debugMode = "debugMode"

ViewID.debugArea = "debugArea"
ViewID.debugSpeedInput = "debugSpeedInput"
ViewID.debugLineLabel = "debugLineLabel"
ViewID.debugPauseButton = "debugPauseButton"
ViewID.debugResumeButton = "debugResumeButton"
ViewID.debugStepIntoButton = "debugStepIntoButton"
```

## Checklist

### Speed control — library
- [ ] Add `SpeedConfig` type to `DebuggerTypes.ts`
- [ ] Add `lineCounter` and `speedConfig` properties to `Debugger`
- [ ] Implement speed-to-config mapping in `setSpeed()`
- [ ] Add throttle check in `onLine()`: pause after N lines with delay
- [ ] Add `nextDelay` property readable by Controller
- [ ] Add `getSpeed()` method

### Speed control — Controller
- [ ] In `"debug"` handler: check `debugger.nextDelay` for throttle pauses
- [ ] Use `setTimeout(fnRunLoopHandler, delay)` for throttle-only pauses
- [ ] Distinguish throttle-pause (auto-resume) from user-pause (wait for input)

### Line highlighting — library
- [ ] Add `LineRange` type to `DebuggerTypes.ts`
- [ ] Add `setSourceMap()` to `Debugger`
- [ ] Add `getCurrentLineRange()` to `Debugger`
- [ ] Call `setSourceMap()` from Controller after compilation

### Line highlighting — UI
- [ ] Add `debugLineLabel` span to `index.html`
- [ ] Implement `updateLineHighlight()` in `UiDebugger` — update label text
- [ ] Auto-scroll `inputText` textarea to approximate line position
- [ ] Wire `onDebugEvent` to call `updateLineHighlight` on "paused"/"step" events

### Debug UI panel
- [ ] Add debug fieldset to `docs/index.html`
- [ ] Add `debugMode` checkbox to Settings fieldset
- [ ] Add ViewID constants for all new elements
- [ ] Create `docs/src/UiDebugger.ts` class
- [ ] Wire speed slider to `debugger.setSpeed()`
- [ ] Wire Pause/Continue/Step buttons to `debugger.pause()`/`resume()`/`stepInto()`
- [ ] Disable buttons appropriately per state (e.g., no Step when running at full speed)
- [ ] Show/hide debug panel based on `debugMode` setting

### Integration
- [ ] Toggle debug mode recompiles script (`invalidateScript()`)
- [ ] Speed slider works while program is running (real-time speed change)
- [ ] Verify existing Run/Break/Continue buttons still work alongside debugger

### Unit tests
- [ ] Test speed config mapping (speed 0, 50, 100 produce correct linesPerChunk/delay)
- [ ] Test throttle logic in `onLine()` — pauses after correct number of lines
- [ ] Test `getCurrentLineRange()` returns correct range for known source map
- [ ] Test `nextDelay` is set for throttle pause, 0 for breakpoint pause

### Integration tests
- [ ] Run a simple BASIC program with debug enabled and speed=50, verify it completes
- [ ] Verify line highlight updates during speed-throttled execution
- [ ] Verify pause/step/continue cycle works end-to-end
