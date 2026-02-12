# 06 — Evaluate / Execute / Console

**Delivers:** REPL console for evaluating expressions and executing statements while paused. Memory viewer.

**Depends on:** Docs 01–02 (Debugger core). Reuses conditional eval from doc 03.

## Expression evaluation — library

### How to evaluate BASIC expressions at runtime

The interpreter already has the compilation pipeline: `BasicLexer → BasicParser → CodeGeneratorJs`. We reuse it in "expression mode" to compile a single BASIC expression into a JavaScript function, then execute it against the current variable state.

**File:** `src/CodeGeneratorJs.ts`

The `noCodeFrame` option already suppresses the outer `while/switch` loop. For expression evaluation we need a further refinement: compile a single expression (not a full program line).

### Evaluator class

```
File: src/Evaluator.ts
Class: Evaluator
```

Separated from Debugger to keep responsibilities clean. Debugger uses Evaluator.

```ts
interface EvalResult {
  value: any;               // result of expression
  error?: string;           // if evaluation failed
}
```

| Method | Signature | Description |
|--------|-----------|-------------|
| `constructor` | `(lexer: BasicLexer, parser: BasicParser)` | Reuse existing lexer/parser |
| `evaluate` | `(expression: string, variables: Variables, vm: CpcVm): EvalResult` | Evaluate a BASIC expression |
| `execute` | `(statement: string, variables: Variables, vm: CpcVm): EvalResult` | Execute a BASIC statement |

### `evaluate()` implementation

1. Prepend a synthetic line: `0 LET evalResult_ = (expression)` (wrap in assignment to capture result)
2. Lex + parse + generate JS with `noCodeFrame: true`
3. The generated JS accesses `v.` (variables) — bind to current `Variables` object
4. Execute via `new Function("o", generatedCode)(vm)`
5. Read `v.evalResult_` as the result
6. Catch any errors, return as `EvalResult.error`

### `execute()` implementation

For full statements (e.g., `PRINT "hello"`, `LET x%=42`):

1. Prepend line number: `0 statement`
2. Compile with `noCodeFrame: true`
3. Execute against current VM/variables
4. Side effects apply (variables are modified, output is produced)
5. Return `EvalResult` with value (if any) or error

### Safety

- Executing statements while paused can modify program state. This is expected and useful (e.g., changing variable values).
- GOTO/GOSUB in executed statements would disrupt the debugger. Block these: check the AST for GOTO/GOSUB nodes and reject them in execute mode.
- Limit execution to a single statement (no multi-line programs in the console).

## Console panel — UI

### Design

A simple REPL: text input + output log. User types BASIC expressions or statements, sees results.

```html
<div id="debugConsoleArea" class="debugPanel">
  <strong>Console</strong>
  <div id="debugConsoleLog" class="consoleLog"></div>
  <div class="consoleInputRow">
    <input id="debugConsoleInput" type="text" placeholder="BASIC expression or statement">
    <button id="debugConsoleRunButton">Eval</button>
  </div>
</div>
```

### UiDebugger additions

| Method | Signature | Description |
|--------|-----------|-------------|
| `evalConsoleInput` | `(): void` | Read input, call evaluator, append result to log |
| `appendToConsoleLog` | `(input: string, result: EvalResult): void` | Format and display |
| `clearConsoleLog` | `(): void` | Clear the log |

Console log format:
```
> x%
42
> a$
"hello"
> LET x%=99
OK
> 1/0
Error: Division by zero
```

Enter key in the input field triggers eval (in addition to the button).

Console is only active when paused. When running, input is disabled.

### Debugger integration

| Method (Debugger) | Signature | Description |
|--------------------|-----------|-------------|
| `eval` | `(expression: string): EvalResult` | Delegate to Evaluator.evaluate() |
| `exec` | `(statement: string): EvalResult` | Delegate to Evaluator.execute() |

These are convenience methods on Debugger that pass through the current VM/Variables.

## Memory viewer — UI

### Library support

`CpcVm` already has `peek(address)` and the internal `mem[]` array (64K).

| Method (Debugger) | Signature | Description |
|--------------------|-----------|-------------|
| `getMemoryRange` | `(start: number, length: number): number[]` | Read a range of memory bytes |

Implementation: loop over `vm.peek(addr)` for the range.

### UI

A simple hex dump viewer:

```html
<div id="debugMemoryArea" class="debugPanel">
  <strong>Memory</strong>
  <input id="debugMemoryAddrInput" type="text" placeholder="Address (hex)" value="0000">
  <button id="debugMemoryRefreshButton">Refresh</button>
  <pre id="debugMemoryDump"></pre>
</div>
```

Display format (16 bytes per row):
```
0000: 00 00 00 00 00 00 00 00  00 00 00 00 00 00 00 00  ................
0010: C3 00 C0 00 00 00 00 00  00 00 00 00 00 00 00 00  ................
```

### UiDebugger additions

| Method | Signature | Description |
|--------|-----------|-------------|
| `refreshMemoryDump` | `(): void` | Read address, fetch range, format hex dump |
| `formatHexDump` | `(start: number, data: number[]): string` | Format as hex + ASCII |

Show 256 bytes at a time (16 rows). User can type new address and refresh.

### Constants / ViewIDs

```ts
ViewID.debugConsoleArea = "debugConsoleArea"
ViewID.debugConsoleLog = "debugConsoleLog"
ViewID.debugConsoleInput = "debugConsoleInput"
ViewID.debugConsoleRunButton = "debugConsoleRunButton"
ViewID.debugMemoryArea = "debugMemoryArea"
ViewID.debugMemoryAddrInput = "debugMemoryAddrInput"
ViewID.debugMemoryRefreshButton = "debugMemoryRefreshButton"
ViewID.debugMemoryDump = "debugMemoryDump"
```

## Export

**File:** `src/index.ts`

Add:
```
export * from "./Evaluator";
```

## Checklist

### Evaluator — library
- [x] Create `src/Evaluator.ts`
- [x] Implement `evaluate(expression, variables, vm)` — compile expression, execute, return result
- [x] Implement `execute(statement, variables, vm)` — compile statement, execute, return result
- [x] Handle compilation errors gracefully (return in `EvalResult.error`)
- [x] Handle runtime errors gracefully
- [x] Block GOTO/GOSUB/RUN/CHAIN in execute mode (check AST or generated code)
- [x] Export from `src/index.ts`

### Debugger integration
- [x] Add `evaluator: Evaluator` property to Debugger (or create on demand)
- [x] Implement `eval(expression)` convenience method
- [x] Implement `exec(statement)` convenience method
- [x] Only allow eval/exec when state is "paused"

### Console — UI
- [x] Add console area HTML to `index.html`
- [x] Add ViewID constants
- [x] Implement `evalConsoleInput()` — read input, distinguish expression vs statement
- [x] Implement `appendToConsoleLog()` — format input + result
- [x] Wire Enter key and Eval button
- [x] Disable console input when not paused
- [ ] Implement `clearConsoleLog()`
- [ ] After exec that modifies variables, refresh variable display

### Memory viewer — UI
- [x] Add memory area HTML to `index.html`
- [x] Add ViewID constants
- [x] Implement `getMemoryRange()` in Debugger
- [x] Implement `refreshMemoryDump()` in UiDebugger
- [x] Implement `formatHexDump()` — hex + ASCII columns
- [x] Wire Refresh button
- [x] Parse hex address input
- [ ] Refresh memory on each pause event (optional)

### Unit tests
- [x] Test `evaluate("1+2")` returns `{ value: 3 }`
- [x] Test `evaluate("a$")` returns current string variable value
- [x] Test `evaluate` with syntax error returns `EvalResult.error`
- [x] Test `execute("LET x%=42")` modifies variable
- [x] Test `execute("GOTO 100")` is rejected
- [x] Test `execute("GOSUB 100")` is rejected
- [x] Test `getMemoryRange(0, 16)` returns 16 bytes
- [x] Test `eval()` only works when paused (throws/returns error otherwise)

### Integration tests
- [x] Pause program, evaluate expression referencing program variables, verify result
- [x] Pause program, execute LET statement, verify variable changed
- [x] Pause program, view memory at known address, verify values match POKE'd data
