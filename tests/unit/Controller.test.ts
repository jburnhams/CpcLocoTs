
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Controller } from '../../src/Controller';
import { Model } from '../../src/Model';
import { View } from '../../src/View';
import { ModelPropID, ViewID } from '../../src/Constants';
import { CodeGeneratorJs } from '../../src/CodeGeneratorJs';

// Mock View module
vi.mock('../../src/View', () => {
    return {
        View: {
            getElementById1: vi.fn(() => {
                 const el = document.createElement('div');
                 return el;
            }),
            getElementByIdAs: vi.fn(() => document.createElement('div')),
        }
    };
});

describe('Controller Unit Tests', () => {
    let controller: Controller;
    let mockModel: any;
    let mockView: any;

    beforeEach(() => {
        // Mock AudioContext for Sound class
        vi.stubGlobal('AudioContext', vi.fn().mockImplementation(() => ({
            createGain: vi.fn(() => ({ connect: vi.fn(), gain: { value: 0 } })),
            createOscillator: vi.fn(() => ({ connect: vi.fn(), start: vi.fn(), stop: vi.fn() })),
            destination: {},
            currentTime: 0,
            state: 'suspended',
            resume: vi.fn().mockResolvedValue(undefined),
            suspend: vi.fn().mockResolvedValue(undefined),
            onstatechange: null
        })));

        // Mock Model
        mockModel = {
            getProperty: vi.fn((prop) => {
                if (prop === ModelPropID.canvasType) return 'none';
                if (prop === ModelPropID.basicVersion) return 'BP 1.0';
                if (prop === ModelPropID.showCpc) return false;
                if (prop === ModelPropID.sound) return false;
                if (prop === ModelPropID.dragElements) return false;
                if (prop === ModelPropID.speed) return 100; // default speed
                if (prop === ModelPropID.trace) return false;
                if (prop === ModelPropID.debugMode) return false;
                return undefined;
            }),
            getAllProperties: vi.fn(() => ({})),
        };

        // Mock View Instance
        mockView = {
            getAreaValue: vi.fn(),
            setSelectValue: vi.fn(),
            setHidden: vi.fn(),
            setSelectOptions: vi.fn(),
            getInputChecked: vi.fn(),
            addFileSelectHandler: vi.fn(),
            setDisabled: vi.fn(),
            setAreaValue: vi.fn(),
            addEventListenerById: vi.fn(),
            removeEventListenerById: vi.fn(),
        };

        controller = new Controller(mockModel as Model, mockView as View);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should initialize correctly', () => {
        expect(controller).toBeDefined();
        expect(controller.getVm()).toBeDefined();
        expect(controller.getDebugger()).toBeDefined();
    });

    it('should update speed correctly', () => {
        // Test initial speed setup (default 100 -> initialLoopTimeout should be 0)
        // Controller constructor calls fnSpeed().
        // speed 100 => 1000 - 100*10 = 0.
        // We can check private property 'initialLoopTimeout' if we cast to any,
        // or ensure no error is thrown.
        expect((controller as any).initialLoopTimeout).toBe(0);

        // Change speed
        mockModel.getProperty.mockImplementation((prop: string) => {
            if (prop === ModelPropID.speed) return 50;
            return 100; // Fallback or other defaults if needed, though only speed is called here
        });

        controller.fnSpeed();
        // 1000 - 50*10 = 500
        expect((controller as any).initialLoopTimeout).toBe(500);
    });

    it('should update trace option', () => {
        // Initial state
        const codeGen: CodeGeneratorJs = (controller as any).codeGeneratorJs;
        expect(codeGen.getOptions().trace).toBe(false);

        // Change trace
        mockModel.getProperty.mockImplementation((prop: string) => {
             if (prop === ModelPropID.trace) return true;
             return undefined;
        });

        controller.fnTrace();
        expect(codeGen.getOptions().trace).toBe(true);
    });

    it('should dispose debugger when disposed', () => {
        const debuggerDisposeSpy = vi.spyOn(controller.getDebugger(), 'dispose');
        controller.dispose();
        expect(debuggerDisposeSpy).toHaveBeenCalled();
    });
});
