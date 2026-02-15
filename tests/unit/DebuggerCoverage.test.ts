import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Debugger } from '../../src/Debugger';
import { CpcVm } from '../../src/CpcVm';
import { Evaluator } from '../../src/Evaluator';

describe('Debugger Coverage', () => {
    let vm: any;
    let dbg: Debugger;
    let evaluator: any;

    beforeEach(() => {
        vm = {
            vmGetGosubStack: vi.fn().mockReturnValue([]),
            vmStop: vi.fn(),
            vmGetAllVariables: vi.fn().mockReturnValue({}),
            vmOnError: vi.fn(),
            peek: vi.fn().mockReturnValue(0)
        };
        evaluator = {
            evaluate: vi.fn(),
            execute: vi.fn()
        };
        dbg = new Debugger(vm as unknown as CpcVm, evaluator as unknown as Evaluator);
    });

    it('should handle condition evaluator error', () => {
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        dbg.addBreakpoint(10, "error_condition");
        dbg.setConditionEvaluator(() => {
            throw new Error("Eval error");
        });

        dbg.resume();
        dbg.onLine(10);

        expect(consoleSpy).toHaveBeenCalledWith("Condition evaluation error:", expect.any(Error));
        expect(vm.vmStop).not.toHaveBeenCalledWith("debug", 70); // Should treat error as false
        consoleSpy.mockRestore();
    });

    it('should return error if no evaluator attached', () => {
        const dbgNoEval = new Debugger(vm as unknown as CpcVm);
        expect(dbgNoEval.eval("1+1")).toEqual({ error: "No evaluator attached" });
        expect(dbgNoEval.exec("PRINT 1")).toEqual({ error: "No evaluator attached" });
    });

    it('should return error if eval/exec called when not paused', () => {
        dbg.resume(); // State running
        expect(dbg.eval("1+1")).toEqual({ error: "Must be paused to evaluate" });
        expect(dbg.exec("PRINT 1")).toEqual({ error: "Must be paused to execute" });
    });

    it('should handle skipStepCheck logic', () => {
        // Mock getSnapshot for paused state
        dbg.pause();
        // Prepare step into: sets state=stepping, skipStepCheck=true if currentLine is number

        // Mock currentLine implicitly via onLine
        dbg.onLine(10); // currentLine becomes 10, state is paused

        // Now stepInto
        vm.vmStop.mockClear();
        dbg.stepInto();

        // onLine called for the SAME line (10)
        // should NOT pause because of skipStepCheck
        dbg.onLine(10);
        expect(vm.vmStop).not.toHaveBeenCalledWith("debug", 70);

        // onLine called for NEXT line (20)
        // should pause
        dbg.onLine(20);
        expect(vm.vmStop).toHaveBeenCalledWith("debug", 70);
    });

    it('should handle skipErrorLine logic', () => {
        dbg.setBreakOnError(true);
        // Access private handleError via vmOnError mock
        const errHandler = (vm.vmOnError as any).mock.calls[0][0];

        // 1. Trigger error
        const error = { message: "Test", line: 10, errCode: 5, pos: 0, len: 0 };
        errHandler(error);

        expect(dbg.getSnapshot().state).toBe("paused");
        expect(dbg.getSnapshot().error).toBeDefined();

        // 2. Resume (should set skipErrorLine = 10)
        dbg.resume();
        expect(dbg.getSnapshot().state).toBe("running");

        // 3. Trigger same error again (should be skipped)
        const result = errHandler(error);
        expect(result).toBe(false); // Not handled/paused

        // 4. Trigger error on different line
        const error2 = { message: "Test2", line: 20, errCode: 5, pos: 0, len: 0 };
        const result2 = errHandler(error2);
        expect(result2).toBe(true); // Paused
    });

    it('should reset skipErrorLine when moving to new line', () => {
        dbg.setBreakOnError(true);
        const errHandler = (vm.vmOnError as any).mock.calls[0][0];

        // 1. Trigger error and resume
        const error = { message: "Test", line: 10, errCode: 5, pos: 0, len: 0 };
        errHandler(error);
        dbg.resume();

        // 2. Move to new line
        dbg.onLine(20);

        // 3. Trigger error on original line (should be handled again)
        const result = errHandler(error);
        expect(result).toBe(true);
    });
});
