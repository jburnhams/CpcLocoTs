# 07 — Debugger UI Integration & Polish

**Delivers:** Complete UI wiring, keyboard shortcuts, layout polish, variable display improvements.

**Depends on:** All previous docs (01–06). This doc ties everything together in the UI.

## UI architecture

The debugger UI is handled by a single class `UiDebugger` in `docs/src/UiDebugger.ts`. Earlier docs defined individual methods; this doc covers the full class structure and integration points.

### UiDebugger class — full shape

```
File: docs/src/UiDebugger.ts
Class: UiDebugger
```

| Property | Type | Description |
|----------|------|-------------|
| `controller` | `IController` | Reference to main controller |
| `debugger` | `Debugger` | Reference from `controller.getDebugger()` |
| `active` | `boolean` | Whether debug UI is visible/active |

### Constructor wiring

`constructor(controller: IController)`

1. Get `debugger` from `controller.getDebugger()`
2. Register `this.onDebugEvent` as listener via `debugger.on()`
3. Bind all DOM event handlers (buttons, inputs, keyboard)
4. Set initial button states (all disabled until debug mode is on)

### Event handler — central dispatch

```
onDebugEvent(event: DebugEvent): void
```

Dispatches to UI updates based on event type:

| Event type | UI update |
|------------|-----------|
| `"paused"` | Update line highlight, variables, call stack, enable step buttons |
| `"resumed"` | Clear highlights, disable step buttons, enable pause button |
| `"step"` | Update line highlight, variables (lightweight, for speed-running) |
| `"breakpoint"` | Same as paused + flash breakpoint indicator |
| `"error"` | Same as paused + show error display |
| `"stateChange"` | Update button enabled/disabled states |

## Variable display improvements

The existing variable viewer (`ViewID.variableArea`, `ViewID.varSelect`, `ViewID.varText`) shows variables in a select dropdown. For the debugger, extend this:

### Enhanced variable panel

During debug pauses, refresh the variable display automatically. Reuse the existing `variableArea` rather than creating a duplicate.

| Method (UiDebugger) | Signature | Description |
|----------------------|-----------|-------------|
| `refreshVariables` | `(): void` | Update variable select/text from debugger snapshot |

This calls the existing variable display logic in Controller (it already has `changeVariable()` and variable listing). Just trigger a refresh on each pause.

Additionally, highlight variables that changed since last pause:

```ts
interface VariableDiff {
  name: string;
  oldValue: any;
  newValue: any;
}
```

| Method | Signature | Description |
|--------|-----------|-------------|
| `getChangedVariables` | `(prev: Record<string, any>, curr: Record<string, any>): VariableDiff[]` | Diff two snapshots |

Changed variables could be shown in bold or with a marker in the variable list.

## Keyboard shortcuts

| Key | Action | When |
|-----|--------|------|
| `F5` | Continue / Run | Always (start run or resume) |
| `F10` | Step Over | When paused |
| `F11` | Step Into | When paused |
| `Shift+F11` | Step Out | When paused |
| `F9` | Toggle breakpoint at current line | When editor focused |
| `Escape` | Pause / Break | When running |

### Implementation

In `UiDebugger`, add a `keydown` listener on `document`:

```
onKeyDown(event: KeyboardEvent): void
```

Only handle shortcuts when debug mode is active. Prevent default for handled keys.

## Layout

### Debug panel position

The debug panel should sit below the existing button bar (Parse, Run, Break, Continue, etc.) and above the output areas. It's a collapsible fieldset, hidden when debug mode is off.

### Approximate layout

```
┌─────────────────────────────────────────────┐
│ [Gallery] [Settings]                         │
├─────────────────────────────────────────────┤
│ Input (textarea)               │ CPC Canvas  │
│                                │             │
├────────────────────────────────┤             │
│ [Parse][Run][Break][Continue]  │             │
├────────────────────────────────┤             │
│ Debug: Speed [===---] Line: 50 │             │
│ [Pause][Continue][Step][Over]  │             │
│ [Out] [x] Break on Error      │             │
├────────────────────────────────┤             │
│ Call Stack  │ Breakpoints      │             │
│ [0] Ln 50   │ Ln 30 [x]       │             │
│ [1] Ln 10   │ Ln 70 [x]       │             │
├─────────────┴──────────────────┤             │
│ Console: > _                   │             │
│ > x%                           │             │
│ 42                             │             │
├────────────────────────────────┴─────────────┤
│ Output  │ Variables │ Memory                  │
└─────────────────────────────────────────────┘
```

### CSS additions

**File:** `docs/CpcLoco.css`

```css
/* Debug panel styles */
#debugArea { ... }           /* main debug fieldset */
.debugPanel { ... }          /* sub-panels (call stack, breakpoints, console, memory) */
.consoleLog { ... }          /* scrollable console output */
.consoleInputRow { ... }     /* input + button row */
.debugHighlight { ... }      /* current line highlight style */
.breakpointMarker { ... }    /* red dot for breakpoints */
.changedVariable { ... }     /* bold/highlight for changed vars */
```

Keep styles minimal — match the existing CpcLoco visual style (simple borders, monospace text).

## UiEventHandler integration

**File:** `docs/src/UiEventHandler.ts`

The existing event handler manages all button clicks. Add debug-related event bindings here, or keep them self-contained in `UiDebugger`.

**Recommended:** Keep all debug event handling in `UiDebugger`. The only touch point in `UiEventHandler` is instantiating `UiDebugger` and passing it the controller.

### Main.ts integration

**File:** `docs/src/main.ts`

In the `CpcLoco` initialization flow:
1. After creating Controller, create `UiDebugger`
2. Pass controller reference

## Constants / ViewIDs — complete list

All ViewIDs added across docs 02–06, collected here:

```ts
// Debug mode toggle (Settings panel)
ViewID.debugModeInput = "debugModeInput"

// Debug panel
ViewID.debugArea = "debugArea"
ViewID.debugSpeedInput = "debugSpeedInput"
ViewID.debugLineLabel = "debugLineLabel"
ViewID.debugPauseButton = "debugPauseButton"
ViewID.debugResumeButton = "debugResumeButton"
ViewID.debugStepIntoButton = "debugStepIntoButton"
ViewID.debugStepOverButton = "debugStepOverButton"
ViewID.debugStepOutButton = "debugStepOutButton"

// Breakpoints
ViewID.debugBreakpointList = "debugBreakpointList"
ViewID.debugBreakpointInput = "debugBreakpointInput"
ViewID.debugAddBreakpointButton = "debugAddBreakpointButton"

// Error display
ViewID.debugErrorInfo = "debugErrorInfo"
ViewID.debugErrorText = "debugErrorText"
ViewID.debugBreakOnErrorInput = "debugBreakOnErrorInput"

// Call stack
ViewID.debugCallStack = "debugCallStack"
ViewID.debugCallStackList = "debugCallStackList"

// Console
ViewID.debugConsoleArea = "debugConsoleArea"
ViewID.debugConsoleLog = "debugConsoleLog"
ViewID.debugConsoleInput = "debugConsoleInput"
ViewID.debugConsoleRunButton = "debugConsoleRunButton"

// Memory
ViewID.debugMemoryArea = "debugMemoryArea"
ViewID.debugMemoryAddrInput = "debugMemoryAddrInput"
ViewID.debugMemoryRefreshButton = "debugMemoryRefreshButton"
ViewID.debugMemoryDump = "debugMemoryDump"
```

## Checklist

### UiDebugger class
- [x] Create `docs/src/UiDebugger.ts`
- [x] Implement constructor — get debugger, register listener, bind DOM
- [x] Implement `onDebugEvent()` — dispatch to update methods
- [x] Implement `updateControls(state)` — enable/disable buttons per state
- [x] Implement `show()` / `hide()` — toggle debug panel visibility

### Line highlighting
- [x] Implement `updateLineHighlight(range)` — update label, scroll textarea
- [x] Clear highlight on resume

### Variable display
- [x] Implement `refreshVariables()` — trigger existing variable display refresh
- [x] Implement `getChangedVariables()` — diff previous and current snapshots
- [x] Highlight changed variables in the list (bold or marker)
- [x] Store previous snapshot for diff on each pause

### Keyboard shortcuts
- [x] Add `keydown` listener on document
- [x] Implement F5 (continue/run), F10 (step over), F11 (step into), Shift+F11 (step out)
- [x] Implement F9 (toggle breakpoint) — needs to determine current line from cursor position
- [x] Implement Escape (pause)
- [x] Only handle shortcuts when debug mode is active
- [x] Prevent default browser behaviour for handled keys

### Layout and CSS
- [x] Add complete debug HTML to `index.html`
- [x] Add CSS rules to `CpcLoco.css`
- [x] Debug panel hidden by default, shown when debugMode is on
- [x] Responsive: panels stack vertically on narrow screens
- [x] Match existing visual style

### Integration
- [x] Instantiate `UiDebugger` in `main.ts` after Controller creation (Done in UiController)
- [x] Wire debugMode checkbox to show/hide debug panel + recompile
- [x] Verify all buttons, inputs, panels function together
- [x] Verify debug mode doesn't interfere with normal run mode (debug off)

### UI tests (see doc 08 for details)
- [ ] Test UiDebugger construction with mock controller
- [ ] Test button state changes on debug events
- [ ] Test keyboard shortcut dispatch
- [ ] Test variable diff detection
