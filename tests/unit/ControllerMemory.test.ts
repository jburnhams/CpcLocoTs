import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Controller } from '../../src/Controller';
import { ViewID } from '../../src/Constants';

// Mocks
const mockView = {
    setAreaValue: vi.fn(),
    setAreaScrollTop: vi.fn(),
    setDisabled: vi.fn(),
    setSelectValue: vi.fn(),
    getAreaValue: vi.fn(),
    setHidden: vi.fn(),
    setCanvasType: vi.fn(),
    setFocus: vi.fn(),
    setBlur: vi.fn(),
    toggleClass: vi.fn(),
    getHidden: vi.fn(),
    updateTitle: vi.fn()
};

const mockModel = {
    getProperty: vi.fn((prop) => {
        if (prop === 'canvasType') return 'canvas';
        return false;
    }),
    setProperty: vi.fn()
};

const mockVm = {
    vmReset: vi.fn(),
    vmRegisterRsx: vi.fn(),
    vmGetStopObject: vi.fn(),
    vmGetOutBuffer: vi.fn(),
    vmStop: vi.fn(),
    vmGetTimeUntilFrame: vi.fn(),
    vmResetControlBuffer: vi.fn(),
    print: vi.fn(),
    cursor: vi.fn(),
    tagoff: vi.fn(),
    pos: vi.fn(),
    vmResetData: vi.fn(),
    vmReset4Run: vi.fn(),
    vmGoto: vi.fn(),
    vmSetStartLine: vi.fn(),
    vmSetDebugger: vi.fn(),
    vmOnError: vi.fn(),
    vmGetOutFileObject: vi.fn(() => ({ open: false }))
};

// Mock ALL dependencies to isolate Controller logic
vi.mock('../../src/CpcVm', () => {
    return {
        CpcVm: class MockCpcVm {
            constructor() { return mockVm; }
        }
    };
});

vi.mock('../../src/Variables', () => ({
    Variables: class MockVariables {
        getVariable = vi.fn();
        setVariable = vi.fn();
    }
}));

vi.mock('../../src/Keyboard', () => ({
    Keyboard: class MockKeyboard {
    }
}));

vi.mock('../../src/Sound', () => ({
    Sound: class MockSound {
        setActivatedByUser = vi.fn();
        reset = vi.fn();
    }
}));

vi.mock('../../src/BasicParser', () => ({
    BasicParser: class MockBasicParser {
        getKeywords = vi.fn(() => []);
    }
}));

vi.mock('../../src/BasicLexer', () => ({
    BasicLexer: class MockBasicLexer { }
}));

vi.mock('../../src/CodeGeneratorJs', () => ({
    CodeGeneratorJs: class MockCodeGeneratorJs { }
}));

// Mock Canvas modules to avoid DOM interaction
vi.mock('../../src/Canvas', () => ({
    Canvas: class MockCanvas {
        startUpdateCanvas = vi.fn();
        getOptions = vi.fn(() => ({ canvasType: "canvas" }));
        setOptions = vi.fn();
    }
}));
vi.mock('../../src/TextCanvas', () => ({
    TextCanvas: class MockTextCanvas {
        getOptions = vi.fn(() => ({ canvasType: "text" }));
        setOptions = vi.fn();
    }
}));
vi.mock('../../src/NoCanvas', () => ({
    NoCanvas: class MockNoCanvas {
        getOptions = vi.fn(() => ({ canvasType: "none" }));
        setOptions = vi.fn();
    }
}));

// Mock View module for static access
vi.mock('../../src/View', () => {
    return {
        View: class MockView {
            static getElementById1 = vi.fn(() => document.createElement('div'));
            static getElementByIdAs = vi.fn(() => document.createElement('div'));

            // Instance methods expected by Controller
            setAreaValue = vi.fn();
            setAreaScrollTop = vi.fn();
            setDisabled = vi.fn();
            setSelectValue = vi.fn();
            getAreaValue = vi.fn();
            setHidden = vi.fn();
            setCanvasType = vi.fn();
            setFocus = vi.fn();
            setBlur = vi.fn();
            toggleClass = vi.fn();
            getHidden = vi.fn();
            updateTitle = vi.fn();
        }
    };
});

describe('Controller RunLoop Memory Test', () => {
    let controller: Controller;
    let timeouts: Function[] = [];

    beforeEach(() => {
        timeouts = [];
        vi.stubGlobal('setTimeout', (fn: Function, delay: number) => {
            timeouts.push(fn);
            return 123;
        });

        controller = new Controller(mockModel as any, mockView as any);
        (controller as any).vm = mockVm; // Inject mock VM to be sure
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should run 100,000 loops of fnRunLoop without crashing', async () => {
        // Setup a mutable stop object
        const stopObject = { reason: "" };
        mockVm.vmGetStopObject.mockReturnValue(stopObject);

        // Mock vmStop to update the reason
        mockVm.vmStop.mockImplementation((reason: string) => {
            stopObject.reason = reason;
        });

        // Mock fnRunPart1 to simulate a valid execution cycle (setting reason to "timer")
        (controller as any).fnRunPart1 = vi.fn(() => {
            stopObject.reason = "timer";
        });
        (controller as any).fnScript = () => { }; // Fake script

        // Start loop
        (controller as any).fnRunLoop();

        // Drain queue
        let count = 0;
        const limit = 100000;

        console.log(`Starting ${limit} loop test...`);
        const start = performance.now();

        // We can execute synchronously since everything is mocked
        while (timeouts.length > 0 && count < limit) {
            const fn = timeouts.shift();
            if (fn) fn();
            count++;
        }

        const end = performance.now();
        console.log(`Finished ${count} loops in ${(end - start).toFixed(2)}ms`);

        expect(count).toBe(limit);
    });
});
