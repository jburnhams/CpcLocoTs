# 00 — Debugger Design Overview

## Goal

Add a fully featured debugger to CpcLocoTs, exposed as library APIs in `src/` and wired into the `docs/` UI.

## Features

1. Configurable-speed execution with highlighted current line
2. Call stack viewer (GOSUB stack)
3. Memory / variables inspector
4. Breakpoints (line-number and conditional)
5. Error / exception stopping (break-on-error mode)
6. Step forwards (step-into, step-over, step-out)
7. Evaluate / execute / console (REPL for expressions at runtime)

## How execution works today

```
BASIC source
  -> BasicLexer -> tokens -> BasicParser -> AST
  -> CodeGeneratorJs -> JavaScript state machine
  -> eval() produces fnScript(o)
  -> Controller.fnRunLoop() calls fnScript via fnRunPart1()
  -> while (o.vmLoopCondition()) { switch (o.line) { case "10": ...; break; } }
  -> CpcVm methods update state; vmStop(reason, priority) breaks the loop
  -> setTimeout re-enters fnRunLoop()
```

Key existing hook points:
- `CpcVm.vmTrace()` — called per-line when trace flag is on (`CpcVm.ts:1216`)
- `CpcVm.vmLoopCondition()` — loop guard (`CpcVm.ts:1060`)
- `CpcVm.vmStop(reason, priority)` — halts the main loop
- `CpcVm.vmGoto(line)` — line transitions (`CpcVm.ts:949`)
- `CpcVm.gosub() / return()` — GOSUB stack changes (`CpcVm.ts:2155–2166`)
- `CpcVm.gosubStack` — array of return labels (`CpcVm.ts:127`)
- `Controller.fnRunLoop()` — the setTimeout-based main loop (`Controller.ts:1879`)
- `CodeGeneratorJs` — emits `o.vmTrace()` calls; controls instrumentation

## Debugger insertion strategy

When debug mode is active, `CodeGeneratorJs` emits `o.vmDebugHook()` instead of `o.vmTrace()`. This single hook is the interception point for breakpoints, stepping, speed control, and event dispatch.

```
o.vmDebugHook(lineNumber)
  -> Debugger.onLine(lineNumber)
  -> checks breakpoints, step state, speed throttle
  -> if pausing: vmStop("debug", 70)
  -> emits DebugEvent to UI listeners
```

## New files

| File | Role |
|------|------|
| `src/DebuggerTypes.ts` | Shared interfaces and types |
| `src/Debugger.ts` | Core debugger state machine |
| `docs/src/UiDebugger.ts` | UI panel wiring |

## Document index — work through in order

| Doc | Delivers | MVP? |
|-----|----------|------|
| [01-DEBUGGER-CORE](01-DEBUGGER-CORE.md) | `Debugger` class, `DebuggerTypes`, `vmDebugHook`, CodeGen changes | Yes [x] |
| [02-SPEED-AND-HIGHLIGHT](02-SPEED-AND-HIGHLIGHT.md) | Speed slider, line highlighting, basic UI panel | Yes |
| [03-BREAKPOINTS](03-BREAKPOINTS.md) | Line breakpoints, conditional breakpoints, UI gutter | |
| [04-STEP-MODES-AND-CALLSTACK](04-STEP-MODES-AND-CALLSTACK.md) | Step-over, step-out, call stack display | |
| [05-ERROR-STOPPING](05-ERROR-STOPPING.md) | Break-on-error, exception display | |
| [06-EVALUATE-CONSOLE](06-EVALUATE-CONSOLE.md) | REPL console, expression eval, memory view | |
| [07-DEBUGGER-UI](07-DEBUGGER-UI.md) | Full UI integration, polish, keyboard shortcuts | |
| [08-DEBUGGER-TESTS](08-DEBUGGER-TESTS.md) | Comprehensive test plan across all phases | |

Docs 01–02 together form the MVP. Each subsequent doc adds one feature area.
