# 03 — Breakpoints

**Delivers:** Line breakpoints, conditional breakpoints, breakpoint persistence, UI gutter indicators.

**Depends on:** Docs 01, 02 (Debugger core + speed/highlight)

## Library design

### Breakpoint management (already declared in doc 01)

`Debugger` holds `breakpoints: Map<number, Breakpoint>` keyed by BASIC line number.

### Breakpoint checking in `onLine()`

Added to the `onLine()` flow (after step-check, before speed-throttle):

1. Look up `this.breakpoints.get(numericLine)`
2. If found and `enabled`:
   a. If no `condition` — hit. Increment `hitCount`, pause.
   b. If `condition` — evaluate expression (see below). If truthy, hit.
3. On hit: emit `DebugEvent` with `type: "breakpoint"` and include the `Breakpoint` object.

### Conditional breakpoint evaluation

Conditions are BASIC expressions like `x%>10` or `a$="done"`.

To evaluate, reuse `CodeGeneratorJs` in expression-only mode:

| Method (Debugger) | Signature | Description |
|--------------------|-----------|-------------|
| `evaluateCondition` | `(condition: string): boolean` | Compile + eval a BASIC expression against current variables |

Implementation approach:
- Use `CodeGeneratorJs` with `noCodeFrame: true` to compile just the expression
- Wrap result in a function that accesses current `Variables`
- Cache compiled condition functions per breakpoint (invalidate on edit)

This same mechanism is reused in doc 06 for the eval console.

### Breakpoint serialisation

For persistence across page reloads (optional, low priority):

```ts
interface BreakpointState {
  breakpoints: { line: number; enabled: boolean; condition?: string }[];
}
```

| Method | Signature | Description |
|--------|-----------|-------------|
| `exportBreakpoints` | `(): BreakpointState` | Serialise for storage |
| `importBreakpoints` | `(state: BreakpointState): void` | Restore from storage |

## UI design

### Breakpoint gutter

The input textarea doesn't support gutters natively. Options:

**Option A (recommended):** Add a `<div id="debugGutter">` to the left of `inputText`. It contains one clickable element per BASIC line. Clicking toggles a breakpoint. Active breakpoints shown as a red dot.

**Option B (simpler):** A separate list/panel showing all breakpoints with add/remove controls.

**Recommended:** Start with Option B (breakpoint list), add Option A (gutter) as a refinement.

### Breakpoint list panel

Add to the debug fieldset from doc 02:

```html
<div id="debugBreakpointList"></div>
<input id="debugBreakpointInput" type="number" placeholder="Line">
<button id="debugAddBreakpointButton">Add BP</button>
```

### UiDebugger additions

| Method | Signature | Description |
|--------|-----------|-------------|
| `addBreakpointFromInput` | `(): void` | Read line from input, call `debugger.addBreakpoint()` |
| `removeBreakpointFromList` | `(line: number): void` | Remove and update list |
| `updateBreakpointList` | `(): void` | Re-render the breakpoint list |
| `onBreakpointHit` | `(event: DebugEvent): void` | Flash the breakpoint, update line label |

### Constants / ViewIDs to add

```ts
ViewID.debugBreakpointList = "debugBreakpointList"
ViewID.debugBreakpointInput = "debugBreakpointInput"
ViewID.debugAddBreakpointButton = "debugAddBreakpointButton"
```

## Checklist

### Breakpoint core — library
- [ ] Implement `addBreakpoint(line, condition?)` — creates Breakpoint, adds to map
- [ ] Implement `removeBreakpoint(line)` — deletes from map
- [ ] Implement `toggleBreakpoint(line)` — toggle enabled flag
- [ ] Implement `getBreakpoints()` — return array of all breakpoints
- [ ] Implement `clearBreakpoints()` — clear the map
- [ ] Add breakpoint check to `onLine()` — lookup + enabled check
- [ ] Emit `DebugEvent` with `type: "breakpoint"` on hit
- [ ] Increment `hitCount` on each hit

### Conditional breakpoints — library
- [ ] Implement `evaluateCondition(condition)` using CodeGeneratorJs expression mode
- [ ] Cache compiled condition functions per breakpoint
- [ ] Invalidate cache when breakpoint condition is edited
- [ ] Handle evaluation errors gracefully (log warning, treat as not-hit)

### Breakpoint persistence
- [ ] Implement `exportBreakpoints()`
- [ ] Implement `importBreakpoints()`
- [ ] Wire to localStorage in UI (optional, low priority)

### Breakpoint UI
- [ ] Add breakpoint list div + input + button to `index.html`
- [ ] Add ViewID constants
- [ ] Implement `addBreakpointFromInput()` in UiDebugger
- [ ] Implement `removeBreakpointFromList()` — each list item has a remove button
- [ ] Implement `updateBreakpointList()` — render current breakpoints as list items
- [ ] Call `updateBreakpointList()` after add/remove/toggle
- [ ] Show breakpoint hit in line label (e.g., "Breakpoint at line 50")

### Breakpoint gutter (refinement, not MVP)
- [ ] Add `debugGutter` div alongside `inputText`
- [ ] Parse BASIC source to extract line numbers
- [ ] Render one marker per line in gutter, positioned to align with textarea lines
- [ ] Click handler toggles breakpoint at that line
- [ ] Active breakpoints shown as red dot
- [ ] Sync gutter scroll with textarea scroll

### Unit tests
- [ ] Test `addBreakpoint` / `removeBreakpoint` / `toggleBreakpoint` state
- [ ] Test `getBreakpoints` returns correct list
- [ ] Test `clearBreakpoints` empties the map
- [ ] Test `onLine()` pauses when hitting an enabled breakpoint
- [ ] Test `onLine()` does not pause when breakpoint is disabled
- [ ] Test `onLine()` does not pause when line has no breakpoint
- [ ] Test conditional breakpoint — condition true triggers pause
- [ ] Test conditional breakpoint — condition false does not trigger pause
- [ ] Test conditional breakpoint — evaluation error does not crash
- [ ] Test `hitCount` increments correctly
- [ ] Test `exportBreakpoints` / `importBreakpoints` round-trip
