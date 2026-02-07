# 01 — Debugger Core (Library)

**Delivers:** `DebuggerTypes.ts`, `Debugger.ts`, `vmDebugHook()` in CpcVm, CodeGeneratorJs instrumentation, export from `index.ts`.

This is the foundation. Nothing else works without it.

## Data structures

```ts
// src/DebuggerTypes.ts

type DebugState = "idle" | "running" | "paused" | "stepping";

type StepMode = "into" | "over" | "out";

interface Breakpoint {
  id: number;
  line: number;                  // BASIC line number
  enabled: boolean;
  condition?: string;            // optional BASIC expression, e.g. "x%>10"
  hitCount?: number;             // how many times hit so far
}

interface DebugSnapshot {
  line: number | string;         // current BASIC line
  state: DebugState;
  gosubStack: (number | string)[];  // copy of CpcVm.gosubStack
  variables: Record<string, any>;   // snapshot from Variables.getAllVariables()
  error?: { code: number; message: string; line: number | string };
}

type DebugEventType =
  | "paused"       // execution paused (breakpoint, step, manual)
  | "resumed"      // execution continuing
  | "step"         // single step completed
  | "error"        // error/exception occurred
  | "breakpoint"   // breakpoint hit
  | "stateChange"; // DebugState changed

interface DebugEvent {
  type: DebugEventType;
  snapshot: DebugSnapshot;
  breakpoint?: Breakpoint;       // set when type === "breakpoint"
}

type DebugListener = (event: DebugEvent) => void;
```

## Debugger class

```
File: src/Debugger.ts
Class: Debugger
```

### Constructor

`constructor(vm: CpcVm)` — takes a reference to the VM.

### Properties

- `state: DebugState` — current debugger state
- `breakpoints: Map<number, Breakpoint>` — keyed by line number
- `speed: number` — 0 (paused) to 100 (full), controls delay between lines
- `breakOnError: boolean` — stop on any runtime error
- `stepMode: StepMode | null` — active step mode
- `stepDepth: number` — GOSUB stack depth when step started

### Methods — execution control

| Method | Signature | Description |
|--------|-----------|-------------|
| `pause` | `(): void` | Request pause at next line |
| `resume` | `(): void` | Continue from paused state |
| `stepInto` | `(): void` | Execute one line, then pause |
| `stepOver` | `(): void` | Execute until same or shallower stack depth |
| `stepOut` | `(): void` | Execute until stack depth decreases |
| `reset` | `(): void` | Return to idle, clear step state |
| `setSpeed` | `(speed: number): void` | Set execution speed 0–100 |

### Methods — breakpoints

| Method | Signature | Description |
|--------|-----------|-------------|
| `addBreakpoint` | `(line: number, condition?: string): Breakpoint` | Add a breakpoint |
| `removeBreakpoint` | `(line: number): void` | Remove breakpoint at line |
| `toggleBreakpoint` | `(line: number): Breakpoint \| undefined` | Toggle on/off |
| `getBreakpoints` | `(): Breakpoint[]` | List all breakpoints |
| `clearBreakpoints` | `(): void` | Remove all |

### Methods — inspection

| Method | Signature | Description |
|--------|-----------|-------------|
| `getSnapshot` | `(): DebugSnapshot` | Current state snapshot |
| `getCallStack` | `(): (number \| string)[]` | Copy of GOSUB stack |
| `getVariables` | `(): Record<string, any>` | All current variables |

### Methods — events

| Method | Signature | Description |
|--------|-----------|-------------|
| `on` | `(listener: DebugListener): void` | Add event listener |
| `off` | `(listener: DebugListener): void` | Remove listener |

### Core method — the hook

| Method | Signature | Description |
|--------|-----------|-------------|
| `onLine` | `(line: number \| string): void` | Called by `vmDebugHook` every line |

`onLine()` logic:

1. Update `currentLine`
2. If `state === "idle"`, return immediately (no debugging)
3. Check breakpoints: does `breakpoints` have an entry for `line` with `enabled === true`?
   - If conditional, evaluate condition — see doc 06 for eval details; initially skip conditional
4. Check step completion: if `stepMode === "into"`, pause. If `"over"`, check depth. If `"out"`, check depth decreased.
5. If none of the above trigger, and speed < 100, calculate delay and decide whether to pause for throttling
6. If pausing: set `state = "paused"`, build `DebugSnapshot`, emit event, call `vm.vmStop("debug", 70)`
7. If not pausing: return (execution continues)

## CpcVm changes

**File:** `src/CpcVm.ts`

### New property

- `debugger?: Debugger` — optional reference, set via new method

### New methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `vmSetDebugger` | `(dbg: Debugger \| undefined): void` | Attach/detach debugger |
| `vmDebugHook` | `(): void` | Called per-line by compiled code |
| `vmGetGosubStack` | `(): (number \| string)[]` | Public read access to `gosubStack` |

`vmDebugHook()` implementation:

```
vmDebugHook(): void {
  if (this.tronFlag1) {
    // existing trace output
    this.print(0, "[" + String(this.line) + "]");
  }
  if (this.debuggerRef) {
    this.debuggerRef.onLine(this.line);
  }
}
```

Note: `vmDebugHook` replaces `vmTrace` in generated code when debug mode is on. It still respects `tronFlag1` for TRON output.

## CodeGeneratorJs changes

**File:** `src/CodeGeneratorJs.ts`

### New option

Add to `CodeGeneratorJsOptions`:
- `debug?: boolean` — emit debug hooks instead of trace hooks

### Code generation change

In the method that emits per-line code (where `o.vmTrace()` is currently emitted when `trace` is true):

- When `debug === true`: emit `o.vmDebugHook();` at the start of every `case` block
- When only `trace === true`: emit `o.vmTrace();` (existing behaviour)
- When both: emit `o.vmDebugHook();` (it handles trace internally)

Reference: search for `vmTrace` in `CodeGeneratorJs.ts` to find the emission point.

## Controller changes

**File:** `src/Controller.ts`

### New property

- `debugger: Debugger` — instantiated in constructor

### New handler

Add `"debug"` to the `handlers` map (alongside "timer", "waitKey", etc.):

```
When stop.reason === "debug":
  -> do NOT re-enter the loop
  -> update UI (variables, output)
  -> wait for user action (step, continue, etc.)
```

### Integration with existing IController

Add to `IController` interface (in `Interfaces.ts`):

| Method | Signature |
|--------|-----------|
| `getDebugger` | `(): Debugger` |

### Recompilation trigger

When debug mode is toggled on/off, `invalidateScript()` must be called so the code is recompiled with/without `vmDebugHook` calls.

## Export

**File:** `src/index.ts`

Add:
```
export * from "./DebuggerTypes";
export * from "./Debugger";
```

## Checklist

### Types
- [ ] Create `src/DebuggerTypes.ts` with all interfaces above
- [ ] Export from `src/index.ts`

### Debugger class
- [ ] Create `src/Debugger.ts` with constructor taking `CpcVm`
- [ ] Implement `state` property and `DebugState` transitions
- [ ] Implement `onLine()` — initial version: just check `state` and step-into
- [ ] Implement `pause()` / `resume()` / `stepInto()`
- [ ] Implement `reset()`
- [ ] Implement `setSpeed()`
- [ ] Implement `getSnapshot()`, `getCallStack()`, `getVariables()`
- [ ] Implement `on()` / `off()` event listener management
- [ ] Implement `emit()` private helper
- [ ] Export from `src/index.ts`

### CpcVm integration
- [ ] Add `debuggerRef` property to `CpcVm`
- [ ] Add `vmSetDebugger()` method
- [ ] Add `vmDebugHook()` method
- [ ] Add `vmGetGosubStack()` method
- [ ] Ensure `vmDebugHook` respects existing `tronFlag1`

### CodeGeneratorJs integration
- [ ] Add `debug` option to `CodeGeneratorJsOptions`
- [ ] Modify per-line emission: emit `o.vmDebugHook()` when `debug` is true
- [ ] When both `trace` and `debug` are on, emit only `vmDebugHook`

### Controller integration
- [ ] Instantiate `Debugger` in Controller constructor
- [ ] Call `vm.vmSetDebugger(this.debugger)` during init
- [ ] Add `"debug"` to `handlers` map — pauses the run loop
- [ ] Add `getDebugger()` to IController
- [ ] Call `invalidateScript()` when debug mode is toggled
- [ ] Pass `debug` option through to CodeGeneratorJs

### Model / Constants
- [ ] Add `ModelPropID.debug` mode (or repurpose existing `debug` property) for debug-enabled flag
- [ ] Distinguish between `debug` (numeric log level) and `debugMode` (boolean debugger active)

### Unit tests (see also doc 08)
- [ ] Test Debugger construction with mock CpcVm
- [ ] Test state transitions: idle -> running -> paused -> running
- [ ] Test `onLine()` triggers pause when `state === "stepping"` and `stepMode === "into"`
- [ ] Test `onLine()` does nothing when `state === "idle"`
- [ ] Test event emission on pause/resume
- [ ] Test `vmDebugHook()` calls `debugger.onLine()` when debugger is set
- [ ] Test `vmDebugHook()` still prints trace when `tronFlag1` is on
- [ ] Test CodeGeneratorJs emits `vmDebugHook` when `debug: true`
- [ ] Test CodeGeneratorJs emits `vmTrace` when only `trace: true`
