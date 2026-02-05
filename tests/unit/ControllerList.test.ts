
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Controller } from '../../src/Controller';
import { Model } from '../../src/Model';
import { View } from '../../src/View';
import { ModelPropID, ViewID } from '../../src/Constants';

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

describe('Controller fnList', () => {
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
        // vi.unstubGlobal not working in this environment/version?
        // Just set it to undefined if it wasn't there, or ignore if test environment is isolated enough.
        // vi.stubGlobal('AudioContext', undefined);
    });

    it('escapes control characters in list command', () => {
        const inputWithControlChars = '10 PRINT "Hello\x00World"';
        const expectedOutputLine = '10 PRINT "Hello\x01\x00World"';

        mockView.getAreaValue.mockReturnValue(inputWithControlChars);

        const vm = controller.getVm();
        const printSpy = vi.spyOn(vm, 'print');

        printSpy.mockImplementation(() => {});

        (controller as any).fnList({
            stream: 0,
            first: 0,
            last: 65535
        });

        expect(printSpy).toHaveBeenCalledWith(0, expectedOutputLine, "\r\n");
    });

    it('handles multiple control characters', () => {
        const input = '20 A$="\x01\x1f"';
        const expected = '20 A$="\x01\x01\x01\x1f"';

        mockView.getAreaValue.mockReturnValue(input);

        const vm = controller.getVm();
        const printSpy = vi.spyOn(vm, 'print');
        printSpy.mockImplementation(() => {});

        (controller as any).fnList({ stream: 0 });

        expect(printSpy).toHaveBeenCalledWith(0, expected, "\r\n");
    });

    it('does not escape standard characters', () => {
        const input = '30 PRINT "Normal Text"';
        const expected = '30 PRINT "Normal Text"';

        mockView.getAreaValue.mockReturnValue(input);

        const vm = controller.getVm();
        const printSpy = vi.spyOn(vm, 'print');
        printSpy.mockImplementation(() => {});

        (controller as any).fnList({ stream: 0 });

        expect(printSpy).toHaveBeenCalledWith(0, expected, "\r\n");
    });
});
