# Test Migration Guide

This document outlines the process for migrating legacy QUnit tests (`*.qunit.ts`) to Vitest (`*.test.ts`) one file at a time.

## Migration Process

Follow these steps for each file to ensure a clean and verifiable migration.

### 1. File Setup
1.  **Copy** the target `.qunit.ts` file to a new `.test.ts` file in the same directory.
    -   *Why copy?* Preserves the original legacy test and huge data structures until the new one is verified.
    -   Example: `copy tests\unit\BasicParser.qunit.ts tests\unit\BasicParser.test.ts`

### 2. Refactor Code
Edit the new `.test.ts` file:
1.  **Update Imports**:
    -   Remove `QUnit`, `TestHelper`, `Assert` imports (unless `TestHelper` is strictly needed for types, but prefer local types).
    -   Add `import { describe, test, expect } from 'vitest';`.
    -   Ensure the Subject Under Test (SUT) is imported correctly from `../../src/...`.
2.  **Convert Structure**:
    -   Replace `QUnit.module("Name", hooks => { ... })` with `describe("Name", () => { ... })`.
    -   Remove `hooks` setup. Instantiate the SUT directly inside `describe` or `test`.
    -   Replace `runTestsFor` or custom loop logic with simple loops generating `test(...)` calls.
    -   *Crucial*: Ensure `test()` calls are generated *synchronously* at definition time (i.e., inside `describe` but outside any async hooks).
3.  **Convert Assertions**:
    -   `assert.strictEqual(actual, expected)` -> `expect(actual).toBe(expected)`
    -   `assert.ok(value)` -> `expect(value).toBeTruthy()`
    -   `assert.deepEqual(actual, expected)` -> `expect(actual).toEqual(expected)`

### 3. Verify
1.  **Run the Test**: Execute *only* the new test file to isolate failures.
    -   Command: `npm run test tests/unit/TargetFile.test.ts`
2.  **Debug**: logical errors, missing setups, or type mismatches.
    -   *Tip*: Use `fnHex2Bin` or similar helpers locally if they were part of the legacy file.

### 4. Cleanup
1.  **Delete Legacy File**: Once the new test passes green (exit code 0).
    -   Command: `del tests\unit\TargetFile.qunit.ts`
2.  **Commit/Check**: Mark the checkbox below.

---

## Migration Checklist

- [x] DiskImage
- [x] BasicTokenizer
- [x] BasicParser
- [x] BasicLexer
- [x] BasicFormatter
- [x] CodeGeneratorBasic
- [x] CodeGeneratorJs
- [x] CodeGeneratorToken
- [x] CpcVm
- [x] Diff
- [x] Model
- [ ] Sound
- [ ] Variables
- [ ] Z80Disass
- [ ] ZipFile
- [ ] testParseExamples

## Migration Notes

- **CpcVm**: Replaced `TestHelper.generateAllTests` with a local loop to generate tests from `allTests` object. Replaced `QUnit.module` with `describe`. Updated imports to point to `../../src/`.
- **Diff**: Replaced `TestHelper.generateAllTests` with nested `describe`/`test` loops iterating over `allTests`. Updated imports to `../../src/`.
- **Model**: Direct translation of QUnit tests to Vitest. Updated imports to `../../src/`.
