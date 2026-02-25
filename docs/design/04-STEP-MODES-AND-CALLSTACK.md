# 04 — Step Modes & Call Stack

**Delivers:** Step-over, step-out, call stack display in UI.

**Depends on:** Docs 01–02 (which deliver step-into).

## Step modes — library

Step-into is implemented in doc 01. This doc adds step-over and step-out, which depend on tracking GOSUB stack depth.

### How the GOSUB stack works

`CpcVm.gosubStack: (number | string)[]` — pushed by `gosub()` (`CpcVm.ts:2157`), popped by `return()`.

Timer handlers also use the stack (see `TimerEntry.stackIndexReturn` at `CpcVm.ts:964`).

Stack depth = `gosubStack.length`.

### Step-over logic

"Run until we return to the same or shallower stack depth on the next line."

In `Debugger`:

1. `stepOver()` records `stepDepth = gosubStack.length`, sets `stepMode = "over"`, resumes execution
2. In `onLine()`: if `stepMode === "over"` and `gosubStack.length <= stepDepth` → pause

This means: if the current line does a GOSUB, we keep running until it RETURNs back.

### Step-out logic

"Run until stack depth decreases."

1. `stepOut()` records `stepDepth = gosubStack.length`, sets `stepMode = "out"`, resumes execution
2. In `onLine()`: if `stepMode === "out"` and `gosubStack.length < stepDepth` → pause

### Edge cases

- **Step-over at top level** (gosubStack empty): behaves like step-into (no GOSUB to skip over)
- **Step-out at top level**: run to end (never pauses, since stack can't decrease below 0). May want to warn user in UI.
- **Timer handlers**: these push to gosubStack too. Step-over should correctly skip timer handler bodies. Works naturally since timer handlers increase stack depth.
- **ON GOSUB**: uses same gosubStack, works naturally.
- **ON ERROR GOTO**: does not use gosubStack (uses `errorGotoLine`). Step-over/out behaviour is unchanged.

### Debugger additions

The `stepInto/stepOver/stepOut` methods are declared in doc 01. Here is the `onLine()` flow update:

```
onLine(line):
  ...existing checks...
  if stepMode === "into": pause
  if stepMode === "over" and vm.gosubStack.length <= stepDepth: pause
  if stepMode === "out" and vm.gosubStack.length < stepDepth: pause
  ...breakpoint checks...
  ...speed throttle...
```

## Call stack display — library

### Data structure

```ts
// DebuggerTypes.ts addition

interface StackFrame {
  returnLabel: number | string;   // where RETURN will go
  depth: number;                  // 0-based index in stack
}
```

### Debugger method

| Method | Signature | Description |
|--------|-----------|-------------|
| `getCallStack` | `(): StackFrame[]` | Build structured stack from `vm.gosubStack` |

Implementation: map `vm.vmGetGosubStack()` into `StackFrame[]` with depth index.

The "current location" (top of stack) is `vm.line` — shown at position 0 in the display.

### CpcVm addition

The `vmGetGosubStack()` method (from doc 01) returns a copy of `gosubStack`.

Additionally, to show meaningful labels, we can cross-reference with the source map labels. But for MVP, just showing line numbers is sufficient.

## Call stack display — UI

### Panel

Add to the debug area (extend the fieldset from doc 02):

```html
<div id="debugCallStack" class="debugPanel">
  <strong>Call Stack</strong>
  <ol id="debugCallStackList"></ol>
</div>
```

### UiDebugger additions

| Method | Signature | Description |
|--------|-----------|-------------|
| `updateCallStack` | `(): void` | Render stack frames into the list |

Called on every "paused" or "step" debug event.

Display format per entry:
```
[0] Line 100  (current)
[1] → return to line 50
[2] → return to line 10
```

Clicking a stack frame could scroll the editor to that line (nice-to-have).

### Constants / ViewIDs

```ts
ViewID.debugCallStack = "debugCallStack"
ViewID.debugCallStackList = "debugCallStackList"
```

## UI buttons for step-over / step-out

Add alongside the Step (into) button from doc 02:

```html
<button id="debugStepOverButton" title="Step Over (skip GOSUB)">Over</button>
<button id="debugStepOutButton" title="Step Out (run to RETURN)">Out</button>
```

Wire to `debugger.stepOver()` and `debugger.stepOut()`.

### Constants / ViewIDs

```ts
ViewID.debugStepOverButton = "debugStepOverButton"
ViewID.debugStepOutButton = "debugStepOutButton"
```

## Checklist

### Step-over — library
- [x] Implement `stepOver()` — record stack depth, set mode, resume
- [x] Add `stepMode === "over"` check in `onLine()` — pause when depth <= recorded
- [x] Handle edge case: step-over at top level (empty stack) behaves as step-into

### Step-out — library
- [x] Implement `stepOut()` — record stack depth, set mode, resume
- [x] Add `stepMode === "out"` check in `onLine()` — pause when depth < recorded
- [x] Handle edge case: step-out at top level — run to end or warn

### Call stack — library
- [x] Add `StackFrame` interface to `DebuggerTypes.ts`
- [x] Implement `getCallStack()` — map gosubStack to StackFrame array
- [x] Include `vm.line` as top-of-stack frame

### Call stack — UI
- [x] Add call stack div and ordered list to `index.html`
- [x] Add ViewID constants
- [x] Implement `updateCallStack()` in UiDebugger
- [x] Call `updateCallStack()` on pause/step events
- [x] Click-to-navigate stack frames to source (nice-to-have)

### Step buttons — UI
- [x] Add step-over and step-out buttons to `index.html`
- [x] Add ViewID constants
- [x] Wire click handlers to `debugger.stepOver()` / `debugger.stepOut()`
- [x] Disable step buttons when not paused

### Unit tests
- [x] Test step-over: GOSUB on current line → runs subroutine → pauses after RETURN
- [x] Test step-over: no GOSUB on current line → behaves like step-into
- [x] Test step-over at top level (empty stack) → step-into behaviour
- [x] Test step-out: inside GOSUB → runs to RETURN → pauses at caller
- [x] Test step-out at top level → runs to end
- [x] Test `getCallStack()` returns correct frames for known GOSUB nesting
- [x] Test timer handler stack frames appear in call stack (Implemented in `DebuggerCallStack.integration.test.ts`)
- [x] Test ON GOSUB stack frames appear correctly (Implemented in `DebuggerCallStack.integration.test.ts`)

### Integration tests
- [x] Run program with nested GOSUBs, verify step-over skips subroutine body
- [x] Run program with nested GOSUBs, verify step-out returns to caller
- [x] Verify call stack display updates on each pause
