# 05 — Error / Exception Stopping

**Delivers:** Break-on-error mode, error display in debug panel, integration with ON ERROR GOTO.

**Depends on:** Doc 01 (Debugger core).

## How errors work today

**File:** `src/CpcVm.ts`

- `vmComposeError(error, errCode, errInfo)` — creates a `CustomError` with CPC error code, info, and current line. Called throughout CpcVm when a BASIC runtime error occurs.
- `errorGotoLine` — if non-zero, errors jump to this line (ON ERROR GOTO). If zero, errors stop the program.
- `errorCode` / `errorLine` — stored for `ERR` / `ERL` functions.
- Errors are thrown as `CustomError` exceptions, caught in `Controller.fnRunPart1()`.

**File:** `src/Controller.ts`

- `fnRunPart1()` — wraps `fnScript(vm)` in try/catch. On catch, sets stop reason to `"error"` or lets ON ERROR GOTO handle it.

## Library design

### Break-on-error mode

When `Debugger.breakOnError` is true, the debugger intercepts errors before they propagate to ON ERROR GOTO or the normal error handler.

**Approach:** Hook into `vmComposeError` in CpcVm.

### CpcVm changes

Add a pre-error hook:

| Method | Signature | Description |
|--------|-----------|-------------|
| `vmOnError` | `(callback: ((err: CustomError) => boolean) \| undefined): void` | Register error callback |

When `vmComposeError` is called and a callback is registered:

1. Call the callback with the error
2. If callback returns `true`: the error is "handled" by the debugger — call `vmStop("debug", 70)` and suppress the throw
3. If callback returns `false`: normal error flow continues (ON ERROR GOTO or stop)

### Debugger integration

In `Debugger` constructor (or when attaching to VM):

- Register an error callback via `vm.vmOnError(this.handleError.bind(this))`

| Method (Debugger) | Signature | Description |
|--------------------|-----------|-------------|
| `handleError` | `(err: CustomError): boolean` | Error callback |
| `setBreakOnError` | `(enabled: boolean): void` | Toggle break-on-error |

`handleError()` logic:

1. If `breakOnError` is false, return `false` (don't intercept)
2. Store error in `lastError`
3. Set `state = "paused"`
4. Build `DebugSnapshot` with error info
5. Emit `DebugEvent` with `type: "error"`
6. Return `true` (suppress normal error handling)

When the user resumes after an error pause:
- The error has been shown but not acted on
- Options: continue (re-throw or skip), or let user fix and re-run

For simplicity, resume after error-pause re-throws the error (normal CPC error handling takes over). The debugger just gives you a chance to inspect state first.

### Error snapshot

Extend `DebugSnapshot.error`:

```ts
interface ErrorInfo {
  code: number;          // CPC error code (e.g., 5 = "Improper argument")
  message: string;       // Error message text
  line: number | string; // BASIC line where error occurred
  info: string;          // Additional context (e.g., which command)
}
```

### Debugger property

- `lastError: ErrorInfo | null` — most recent error, cleared on resume

## UI design

### Error display

When a debug event with `type: "error"` arrives:

1. Update the line label: "Error at line 50: Type mismatch"
2. Highlight the error line in the editor (reuse line highlighting from doc 02)
3. Show error details in a small section of the debug panel

Add to the debug fieldset:

```html
<div id="debugErrorInfo" class="displayNone">
  <strong>Error:</strong> <span id="debugErrorText"></span>
</div>
```

### Break-on-error toggle

Add to Settings or debug panel:

```html
<input id="debugBreakOnErrorInput" type="checkbox">
<label for="debugBreakOnErrorInput">Break on Error</label>
```

### UiDebugger additions

| Method | Signature | Description |
|--------|-----------|-------------|
| `updateErrorDisplay` | `(error: ErrorInfo \| null): void` | Show/hide error info |
| `onBreakOnErrorChange` | `(): void` | Toggle handler |

### Constants / ViewIDs

```ts
ViewID.debugErrorInfo = "debugErrorInfo"
ViewID.debugErrorText = "debugErrorText"
ViewID.debugBreakOnErrorInput = "debugBreakOnErrorInput"
```

## Checklist

### Error hooking — CpcVm
- [ ] Add `errorCallback` property to CpcVm
- [ ] Implement `vmOnError(callback)` setter
- [ ] In `vmComposeError()`: call `errorCallback` before throwing, respect return value
- [ ] Ensure `vmOnError(undefined)` cleans up callback

### Break-on-error — Debugger
- [ ] Add `breakOnError: boolean` property (default false)
- [ ] Add `lastError: ErrorInfo | null` property
- [ ] Implement `handleError(err)` — check `breakOnError`, build snapshot, emit event
- [ ] Implement `setBreakOnError(enabled)` setter
- [ ] Register/unregister error callback when attaching/detaching debugger
- [ ] On resume after error: re-throw error to let normal CPC error flow continue
- [ ] Clear `lastError` on resume

### Error info in snapshot
- [ ] Add `ErrorInfo` interface to `DebuggerTypes.ts`
- [ ] Include `error` field in `DebugSnapshot` when paused due to error

### Error display — UI
- [ ] Add error info div to `index.html`
- [ ] Add break-on-error checkbox to debug panel
- [ ] Add ViewID constants
- [ ] Implement `updateErrorDisplay()` — show error code, message, line
- [ ] Wire break-on-error checkbox to `debugger.setBreakOnError()`
- [ ] Hide error display when no error / on resume

### Unit tests
- [ ] Test `vmOnError` callback is called when `vmComposeError` fires
- [ ] Test callback returning `true` suppresses the throw
- [ ] Test callback returning `false` allows normal error flow
- [ ] Test `handleError` with `breakOnError = true` — pauses and emits event
- [ ] Test `handleError` with `breakOnError = false` — returns false
- [ ] Test error snapshot contains correct code, message, line
- [ ] Test `lastError` is set on error, cleared on resume
- [ ] Test resume after error re-throws for normal handling

### Integration tests
- [ ] Run program with deliberate error (e.g., division by zero), verify debugger pauses
- [ ] Inspect variables at error point, verify they reflect state at error
- [ ] Resume after error, verify normal error message appears
- [ ] Run program with ON ERROR GOTO and breakOnError off — verify normal handling
