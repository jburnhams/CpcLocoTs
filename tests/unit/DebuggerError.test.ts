import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Debugger } from '../../src/Debugger';
import { CpcVm } from '../../src/CpcVm';
import { CustomError } from '../../src/Utils';

describe('Debugger Error Handling', () => {
    let vm: CpcVm;
    let debuggerInstance: Debugger;
    let errorCallback: (err: CustomError) => boolean;

    beforeEach(() => {
        // Reset mocks
        vi.clearAllMocks();

        // Create mock VM
        vm = {
            vmStop: vi.fn(),
            vmGetGosubStack: vi.fn().mockReturnValue([]),
            vmGetAllVariables: vi.fn().mockReturnValue({}),
            vmSetDebugger: vi.fn(),
            vmOnError: vi.fn().mockImplementation((cb: any) => {
                errorCallback = cb;
            })
        } as unknown as CpcVm;

        debuggerInstance = new Debugger(vm);
    });

    it('should register error handler on construction', () => {
        expect(vm.vmOnError).toHaveBeenCalled();
        expect(errorCallback).toBeDefined();
    });

    it('should not handle error if breakOnError is false', () => {
        debuggerInstance.setBreakOnError(false);
        const error = { message: 'Test Error' } as CustomError;
        const result = errorCallback(error);
        expect(result).toBe(false);
    });

    it('should handle error if breakOnError is true', () => {
        debuggerInstance.setBreakOnError(true);
        const error = { message: 'Test Error', errCode: 10, line: 100, value: 'Info', pos: 5, len: 10 } as CustomError;

        const listener = vi.fn();
        debuggerInstance.on(listener);

        const result = errorCallback(error);

        expect(result).toBe(true);
        expect(listener).toHaveBeenCalledWith(expect.objectContaining({
            type: 'error',
            snapshot: expect.objectContaining({
                error: expect.objectContaining({
                    code: 10,
                    message: 'Test Error',
                    line: 100,
                    info: 'Info',
                    pos: 5,
                    len: 10
                })
            })
        }));
    });

    it('should clear error on resume', () => {
        debuggerInstance.setBreakOnError(true);
        const error = { message: 'Test Error' } as CustomError;
        errorCallback(error);

        expect(debuggerInstance.getSnapshot().error).toBeDefined();

        debuggerInstance.resume();

        expect(debuggerInstance.getSnapshot().error).toBeUndefined();
    });
});
