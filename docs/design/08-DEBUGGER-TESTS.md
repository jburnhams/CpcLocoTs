# 08 — Debugger Test Plan

**Covers:** Comprehensive test strategy for all debugger features, both library and UI.

Tests follow the existing project structure:
- `tests/unit/` — fast, isolated tests with mocks
- `tests/integration/` — end-to-end tests against compiled browser bundles
- Run with `npm run test:unit` and `npm run test:integration`

## Test files

| File | Tests | Type |
|------|-------|------|
| `tests/unit/Debugger.test.ts` | Debugger class state machine | Unit |
| `tests/unit/DebuggerBreakpoints.test.ts` | Breakpoint management and matching | Unit |
| `tests/unit/DebuggerSteps.test.ts` | Step-into, step-over, step-out | Unit |
| `tests/unit/Evaluator.test.ts` | Expression evaluation and statement execution | Unit |
| `tests/unit/CpcVmDebug.test.ts` | vmDebugHook, vmOnError, vmGetGosubStack | Unit |
| `tests/unit/CodeGeneratorJsDebug.test.ts` | Debug hook emission in generated code | Unit |
| `tests/integration/Debugger.test.ts` | Full debug session scenarios | Integration |
| `tests/integration/DebuggerUI.test.ts` | UI panel behaviour with browser bundle | Integration |
| `tests/integration/DebuggerCallStack.integration.test.ts` | Call stack scenarios (ON GOSUB, Timer) | Integration |

## Test helpers

**File:** `tests/utils/DebugTestHelper.ts`

Shared utilities for debugger tests:

| Helper | Description |
|--------|-------------|
| `createMockVm()` | Mock CpcVm with controllable `line`, `gosubStack`, `variables` |
| `createDebugger(mockVm)` | Create Debugger instance with mock VM |
| `collectEvents(debugger)` | Register listener, return array of captured events |
| `compileBasic(source)` | Compile BASIC to JS using real lexer/parser/codegen |
| `runToLine(debugger, targetLine)` | Helper to advance execution to a specific line |

## Unit tests — Debugger class

### `tests/unit/Debugger.test.ts`

**State transitions:**
- [x] Initial state is "idle"
- [x] `pause()` when running → state becomes "paused"
- [x] `resume()` when paused → state becomes "running"
- [x] `stepInto()` when paused → state becomes "stepping"
- [x] `reset()` from any state → state becomes "idle"
- [x] `pause()` when idle → no-op (stays idle)
- [x] `resume()` when idle → no-op
- [x] `stepInto()` when running → sets pending step (pause on next line)

**onLine() — basic:**
- [x] When state is "idle" → returns immediately, no events
- [x] When state is "running" and no breakpoints, no step → returns (no pause)
- [x] When state is "stepping" and stepMode is "into" → pauses, emits "paused"
- [x] Pausing calls `vm.vmStop("debug", 70)`
- [x] Event snapshot contains correct line number

**Speed control:**
- [x] `setSpeed(100)` → linesPerChunk is very large (no throttle)
- [x] `setSpeed(0)` → immediate pause on every line
- [x] `setSpeed(50)` → pauses after N lines with appropriate delay
- [x] Speed change while running takes effect on next chunk boundary
- [x] `nextDelay` is set correctly for throttle pauses

**Events:**
- [x] `on(listener)` registers listener, receives events
- [x] `off(listener)` removes listener, no more events
- [x] Multiple listeners all receive same event
- [x] Events include correct snapshot with line, state, variables, stack

### `tests/unit/DebuggerBreakpoints.test.ts`

**Management:**
- [x] `addBreakpoint(10)` creates breakpoint with `line: 10, enabled: true`
- [x] `addBreakpoint(10, "x%>5")` creates conditional breakpoint
- [x] `removeBreakpoint(10)` removes it
- [x] `removeBreakpoint(99)` for non-existent line → no-op
- [x] `toggleBreakpoint(10)` on enabled → disabled
- [x] `toggleBreakpoint(10)` on disabled → enabled
- [x] `toggleBreakpoint(20)` on non-existent → creates new enabled breakpoint
- [x] `getBreakpoints()` returns all breakpoints
- [x] `clearBreakpoints()` removes all
- [x] Auto-incrementing `id` for each breakpoint

**Matching in onLine():**
- [x] Line with enabled breakpoint → pauses
- [x] Line with disabled breakpoint → does not pause
- [x] Line without breakpoint → does not pause
- [x] Breakpoint hit increments `hitCount`
- [x] Event type is "breakpoint" and includes the Breakpoint object

**Conditional:**
- [x] Condition `"x%>5"` when x%=10 → triggers
- [x] Condition `"x%>5"` when x%=3 → does not trigger
- [x] Condition with syntax error → does not trigger, logs warning
- [x] Condition with runtime error → does not trigger, logs warning

**Serialisation:**
- [x] `exportBreakpoints()` returns correct state
- [x] `importBreakpoints()` restores breakpoints
- [x] Round-trip: export then import preserves all breakpoints

### `tests/unit/DebuggerSteps.test.ts`

Setup for each test: mock VM with controllable `gosubStack`.

**Step-into:**
- [x] `stepInto()` → next `onLine()` call pauses
- [x] After pause, state is "paused"

**Step-over:**
- [x] At stack depth 0, step-over → next `onLine()` at depth 0 pauses (same as step-into)
- [x] At stack depth 1, step-over → `onLine()` at depth 2 does not pause, at depth 1 pauses
- [x] At stack depth 2, step-over → `onLine()` at depth 3 does not pause, at depth 2 pauses
- [x] Step-over when GOSUB increases depth → runs through subroutine, pauses on return

**Step-out:**
- [x] At stack depth 2, step-out → `onLine()` at depth 2 does not pause, at depth 1 pauses
- [x] At stack depth 1, step-out → pauses at depth 0
- [x] At stack depth 0, step-out → never pauses (runs to end)

## Unit tests — CpcVm debug integration

### `tests/unit/CpcVmDebug.test.ts`

Uses existing `CpcVm.test.ts` patterns (the test helper creates real CpcVm instances).

- [x] `vmSetDebugger(debugger)` stores reference
- [x] `vmSetDebugger(undefined)` clears reference
- [x] `vmDebugHook()` calls `debugger.onLine(this.line)` when debugger is set
- [x] `vmDebugHook()` does nothing when no debugger set
- [x] `vmDebugHook()` still prints trace when `tronFlag1` is true
- [x] `vmDebugHook()` calls both trace and debug when both active
- [x] `vmGetGosubStack()` returns copy (modifying returned array doesn't affect internal)
- [x] `vmGetGosubStack()` reflects current stack after gosub/return
- [x] `vmOnError(callback)` — callback called on `vmComposeError`
- [x] `vmOnError(callback)` — returning true suppresses throw
- [x] `vmOnError(callback)` — returning false allows throw
- [x] `vmOnError(undefined)` — clears callback

## Unit tests — CodeGeneratorJs debug

### `tests/unit/CodeGeneratorJsDebug.test.ts`

Uses existing `CodeGeneratorJs.test.ts` patterns.

- [x] With `debug: true`: generated code contains `o.vmDebugHook()`
- [x] With `debug: false, trace: true`: generated code contains `o.vmTrace()`
- [x] With `debug: true, trace: true`: generated code contains `o.vmDebugHook()` (not both)
- [x] With `debug: false, trace: false`: no hook calls in generated code
- [x] `vmDebugHook()` appears once per `case` block (per line)

## Unit tests — Evaluator

### `tests/unit/Evaluator.test.ts`

- [x] `evaluate("1+2")` → `{ value: 3 }`
- [x] `evaluate("3*4+1")` → `{ value: 13 }`
- [x] `evaluate('"hello"+" world"')` → `{ value: "hello world" }`
- [x] `evaluate("x%")` with `x%=42` → `{ value: 42 }`
- [x] `evaluate("a$")` with `a$="test"` → `{ value: "test" }`
- [x] `evaluate("SIN(0)")` → `{ value: 0 }`
- [x] `evaluate("invalid!!")` → `{ error: "..." }`
- [x] `execute('LET x%=99')` → variable `x%` becomes 99
- [x] `execute('PRINT "hi"')` → output produced (no error)
- [x] `execute("GOTO 100")` → rejected with error
- [x] `execute("GOSUB 100")` → rejected with error
- [x] `eval()` when not paused → error

## Integration tests

### `tests/integration/Debugger.test.ts`

Full end-to-end tests using the real compilation pipeline and VM.

**Basic debug session:**
- [x] Compile `10 PRINT "A"\n20 PRINT "B"\n30 END`, enable debug, step through all lines
- [x] Verify each step reports correct line number
- [x] Verify program completes after stepping past END

**Breakpoint session:**
- [x] Compile program, set breakpoint at line 20, run → pauses at 20
- [x] Continue → runs to end
- [x] Set breakpoint at line 10, run → pauses at 10, step → at 20, continue → end

**Speed control:**
- [x] Compile loop program (`10 FOR i%=1 TO 100\n20 NEXT i%`), run at speed 50
- [x] Verify program completes (doesn't hang)
- [x] Verify debug events are emitted during execution

**GOSUB stepping:**
- [x] Compile `10 GOSUB 100\n20 END\n100 PRINT "sub"\n110 RETURN`
- [x] Step-into at line 10 → goes to line 100
- [x] Step-over at line 10 → goes to line 20 (skips subroutine)
- [x] Enter subroutine, step-out → returns to line 20

**Error stopping:**
- [x] Compile `10 LET a%=1/0`, enable break-on-error, run → pauses with error
- [x] Verify error snapshot has correct error code and line
- [x] Resume → normal error handling takes over

**Evaluation while paused:**
- [x] Compile and pause at line 20 where `x%=42`
- [x] `eval("x%")` → 42
- [x] `exec("LET x%=99")` → x% is now 99
- [x] Step → program uses new x% value

### `tests/integration/DebuggerUI.test.ts`

Tests against the browser bundle (`dist/browser/cpclocots.min.js`).

- [x] Verify `Debugger` class is exported and constructable
- [x] Verify `Evaluator` class is exported and constructable
- [x] Verify `DebuggerTypes` interfaces are accessible
- [x] End-to-end: create Controller, enable debug, run program, verify pause/resume cycle

## Test utilities

### `tests/utils/DebugTestHelper.ts`

- [x] Create `createMockVm()` — returns object with `line`, `gosubStack`, `vmStop`, `vmGetGosubStack`, `vmGetAllVariables`, `variables`
- [x] Create `createDebugger(mockVm)` — instantiate Debugger with mock
- [x] Create `collectEvents(debugger)` — returns `{ events: DebugEvent[], listener: DebugListener }`
- [x] Create `compileBasic(source, debug)` — full compile pipeline, returns JS code
- [x] Create `createFullVm()` — create real CpcVm with minimal canvas/keyboard/sound mocks

## Coverage targets

| Component | Target |
|-----------|--------|
| `Debugger.ts` | 90%+ line coverage |
| `Evaluator.ts` | 85%+ line coverage |
| `CpcVm` debug methods | 90%+ for new methods |
| `CodeGeneratorJs` debug emission | 100% for new branches |

Run coverage: `npm run coverage`

## Checklist

### Test infrastructure
- [x] Create `tests/utils/DebugTestHelper.ts` with mock utilities
- [x] Verify test helper works with existing test runner (`scripts/run-tests.mjs`)

### Unit test files
- [x] Create `tests/unit/Debugger.test.ts` — state transitions + onLine + speed + events
- [x] Create `tests/unit/DebuggerBreakpoints.test.ts` — all breakpoint tests
- [x] Create `tests/unit/DebuggerSteps.test.ts` — step-into/over/out
- [x] Create `tests/unit/Evaluator.test.ts` — evaluate + execute
- [x] Create `tests/unit/CpcVmDebug.test.ts` — vmDebugHook + vmOnError + vmGetGosubStack
- [x] Create `tests/unit/CodeGeneratorJsDebug.test.ts` — debug code emission

### Integration test files
- [x] Create `tests/integration/Debugger.test.ts` — full debug session scenarios
- [x] Create `tests/integration/DebuggerUI.test.ts` — browser bundle exports + basic session

### Coverage
- [x] Run `npm run coverage` after all tests are written
- [x] Verify Debugger.ts meets 90% coverage
- [x] Verify Evaluator.ts meets 85% coverage
- [x] Address any gaps
