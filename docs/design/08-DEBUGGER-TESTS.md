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
- [ ] Initial state is "idle"
- [ ] `pause()` when running → state becomes "paused"
- [ ] `resume()` when paused → state becomes "running"
- [ ] `stepInto()` when paused → state becomes "stepping"
- [ ] `reset()` from any state → state becomes "idle"
- [ ] `pause()` when idle → no-op (stays idle)
- [ ] `resume()` when idle → no-op
- [ ] `stepInto()` when running → sets pending step (pause on next line)

**onLine() — basic:**
- [ ] When state is "idle" → returns immediately, no events
- [ ] When state is "running" and no breakpoints, no step → returns (no pause)
- [ ] When state is "stepping" and stepMode is "into" → pauses, emits "paused"
- [ ] Pausing calls `vm.vmStop("debug", 70)`
- [ ] Event snapshot contains correct line number

**Speed control:**
- [ ] `setSpeed(100)` → linesPerChunk is very large (no throttle)
- [ ] `setSpeed(0)` → immediate pause on every line
- [ ] `setSpeed(50)` → pauses after N lines with appropriate delay
- [ ] Speed change while running takes effect on next chunk boundary
- [ ] `nextDelay` is set correctly for throttle pauses

**Events:**
- [ ] `on(listener)` registers listener, receives events
- [ ] `off(listener)` removes listener, no more events
- [ ] Multiple listeners all receive same event
- [ ] Events include correct snapshot with line, state, variables, stack

### `tests/unit/DebuggerBreakpoints.test.ts`

**Management:**
- [ ] `addBreakpoint(10)` creates breakpoint with `line: 10, enabled: true`
- [ ] `addBreakpoint(10, "x%>5")` creates conditional breakpoint
- [ ] `removeBreakpoint(10)` removes it
- [ ] `removeBreakpoint(99)` for non-existent line → no-op
- [ ] `toggleBreakpoint(10)` on enabled → disabled
- [ ] `toggleBreakpoint(10)` on disabled → enabled
- [ ] `toggleBreakpoint(20)` on non-existent → creates new enabled breakpoint
- [ ] `getBreakpoints()` returns all breakpoints
- [ ] `clearBreakpoints()` removes all
- [ ] Auto-incrementing `id` for each breakpoint

**Matching in onLine():**
- [ ] Line with enabled breakpoint → pauses
- [ ] Line with disabled breakpoint → does not pause
- [ ] Line without breakpoint → does not pause
- [ ] Breakpoint hit increments `hitCount`
- [ ] Event type is "breakpoint" and includes the Breakpoint object

**Conditional:**
- [ ] Condition `"x%>5"` when x%=10 → triggers
- [ ] Condition `"x%>5"` when x%=3 → does not trigger
- [ ] Condition with syntax error → does not trigger, logs warning
- [ ] Condition with runtime error → does not trigger, logs warning

**Serialisation:**
- [ ] `exportBreakpoints()` returns correct state
- [ ] `importBreakpoints()` restores breakpoints
- [ ] Round-trip: export then import preserves all breakpoints

### `tests/unit/DebuggerSteps.test.ts`

Setup for each test: mock VM with controllable `gosubStack`.

**Step-into:**
- [ ] `stepInto()` → next `onLine()` call pauses
- [ ] After pause, state is "paused"

**Step-over:**
- [ ] At stack depth 0, step-over → next `onLine()` at depth 0 pauses (same as step-into)
- [ ] At stack depth 1, step-over → `onLine()` at depth 2 does not pause, at depth 1 pauses
- [ ] At stack depth 2, step-over → `onLine()` at depth 3 does not pause, at depth 2 pauses
- [ ] Step-over when GOSUB increases depth → runs through subroutine, pauses on return

**Step-out:**
- [ ] At stack depth 2, step-out → `onLine()` at depth 2 does not pause, at depth 1 pauses
- [ ] At stack depth 1, step-out → pauses at depth 0
- [ ] At stack depth 0, step-out → never pauses (runs to end)

## Unit tests — CpcVm debug integration

### `tests/unit/CpcVmDebug.test.ts`

Uses existing `CpcVm.test.ts` patterns (the test helper creates real CpcVm instances).

- [ ] `vmSetDebugger(debugger)` stores reference
- [ ] `vmSetDebugger(undefined)` clears reference
- [ ] `vmDebugHook()` calls `debugger.onLine(this.line)` when debugger is set
- [ ] `vmDebugHook()` does nothing when no debugger set
- [ ] `vmDebugHook()` still prints trace when `tronFlag1` is true
- [ ] `vmDebugHook()` calls both trace and debug when both active
- [ ] `vmGetGosubStack()` returns copy (modifying returned array doesn't affect internal)
- [ ] `vmGetGosubStack()` reflects current stack after gosub/return
- [ ] `vmOnError(callback)` — callback called on `vmComposeError`
- [ ] `vmOnError(callback)` — returning true suppresses throw
- [ ] `vmOnError(callback)` — returning false allows throw
- [ ] `vmOnError(undefined)` — clears callback

## Unit tests — CodeGeneratorJs debug

### `tests/unit/CodeGeneratorJsDebug.test.ts`

Uses existing `CodeGeneratorJs.test.ts` patterns.

- [ ] With `debug: true`: generated code contains `o.vmDebugHook()`
- [ ] With `debug: false, trace: true`: generated code contains `o.vmTrace()`
- [ ] With `debug: true, trace: true`: generated code contains `o.vmDebugHook()` (not both)
- [ ] With `debug: false, trace: false`: no hook calls in generated code
- [ ] `vmDebugHook()` appears once per `case` block (per line)

## Unit tests — Evaluator

### `tests/unit/Evaluator.test.ts`

- [ ] `evaluate("1+2")` → `{ value: 3 }`
- [ ] `evaluate("3*4+1")` → `{ value: 13 }`
- [ ] `evaluate('"hello"+" world"')` → `{ value: "hello world" }`
- [ ] `evaluate("x%")` with `x%=42` → `{ value: 42 }`
- [ ] `evaluate("a$")` with `a$="test"` → `{ value: "test" }`
- [ ] `evaluate("SIN(0)")` → `{ value: 0 }`
- [ ] `evaluate("invalid!!")` → `{ error: "..." }`
- [ ] `execute('LET x%=99')` → variable `x%` becomes 99
- [ ] `execute('PRINT "hi"')` → output produced (no error)
- [ ] `execute("GOTO 100")` → rejected with error
- [ ] `execute("GOSUB 100")` → rejected with error
- [ ] `eval()` when not paused → error

## Integration tests

### `tests/integration/Debugger.test.ts`

Full end-to-end tests using the real compilation pipeline and VM.

**Basic debug session:**
- [ ] Compile `10 PRINT "A"\n20 PRINT "B"\n30 END`, enable debug, step through all lines
- [ ] Verify each step reports correct line number
- [ ] Verify program completes after stepping past END

**Breakpoint session:**
- [ ] Compile program, set breakpoint at line 20, run → pauses at 20
- [ ] Continue → runs to end
- [ ] Set breakpoint at line 10, run → pauses at 10, step → at 20, continue → end

**Speed control:**
- [ ] Compile loop program (`10 FOR i%=1 TO 100\n20 NEXT i%`), run at speed 50
- [ ] Verify program completes (doesn't hang)
- [ ] Verify debug events are emitted during execution

**GOSUB stepping:**
- [ ] Compile `10 GOSUB 100\n20 END\n100 PRINT "sub"\n110 RETURN`
- [ ] Step-into at line 10 → goes to line 100
- [ ] Step-over at line 10 → goes to line 20 (skips subroutine)
- [ ] Enter subroutine, step-out → returns to line 20

**Error stopping:**
- [ ] Compile `10 LET a%=1/0`, enable break-on-error, run → pauses with error
- [ ] Verify error snapshot has correct error code and line
- [ ] Resume → normal error handling takes over

**Evaluation while paused:**
- [ ] Compile and pause at line 20 where `x%=42`
- [ ] `eval("x%")` → 42
- [ ] `exec("LET x%=99")` → x% is now 99
- [ ] Step → program uses new x% value

### `tests/integration/DebuggerUI.test.ts`

Tests against the browser bundle (`dist/browser/cpclocots.min.js`).

- [ ] Verify `Debugger` class is exported and constructable
- [ ] Verify `Evaluator` class is exported and constructable
- [ ] Verify `DebuggerTypes` interfaces are accessible
- [ ] End-to-end: create Controller, enable debug, run program, verify pause/resume cycle

## Test utilities

### `tests/utils/DebugTestHelper.ts`

- [ ] Create `createMockVm()` — returns object with `line`, `gosubStack`, `vmStop`, `vmGetGosubStack`, `vmGetAllVariables`, `variables`
- [ ] Create `createDebugger(mockVm)` — instantiate Debugger with mock
- [ ] Create `collectEvents(debugger)` — returns `{ events: DebugEvent[], listener: DebugListener }`
- [ ] Create `compileBasic(source, debug)` — full compile pipeline, returns JS code
- [ ] Create `createFullVm()` — create real CpcVm with minimal canvas/keyboard/sound mocks

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
- [ ] Create `tests/utils/DebugTestHelper.ts` with mock utilities
- [ ] Verify test helper works with existing test runner (`scripts/run-tests.mjs`)

### Unit test files
- [ ] Create `tests/unit/Debugger.test.ts` — state transitions + onLine + speed + events
- [ ] Create `tests/unit/DebuggerBreakpoints.test.ts` — all breakpoint tests
- [ ] Create `tests/unit/DebuggerSteps.test.ts` — step-into/over/out
- [ ] Create `tests/unit/Evaluator.test.ts` — evaluate + execute
- [ ] Create `tests/unit/CpcVmDebug.test.ts` — vmDebugHook + vmOnError + vmGetGosubStack
- [ ] Create `tests/unit/CodeGeneratorJsDebug.test.ts` — debug code emission

### Integration test files
- [ ] Create `tests/integration/Debugger.test.ts` — full debug session scenarios
- [ ] Create `tests/integration/DebuggerUI.test.ts` — browser bundle exports + basic session

### Coverage
- [ ] Run `npm run coverage` after all tests are written
- [ ] Verify Debugger.ts meets 90% coverage
- [ ] Verify Evaluator.ts meets 85% coverage
- [ ] Address any gaps
