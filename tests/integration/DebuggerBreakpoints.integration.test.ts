import '../../docs/test/setup'; // Setup JSDOM/Canvas mocks
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Controller } from '../../src/Controller';
import { Model } from '../../src/Model';
import { View } from '../../src/View';
import { ModelPropID, ViewID } from '../../src/Constants';

// Mock View methods for the instance passed to Controller
const mockView = {
	getElementById1: vi.fn().mockImplementation((id) => {
		let el = document.getElementById(id);
		if (!el) {
			el = document.createElement('div');
			el.id = id;
			document.body.appendChild(el);
		}
		return el;
	}),
	setAreaValue: vi.fn(),
	getAreaValue: vi.fn().mockReturnValue(''),
	setDisabled: vi.fn(),
	setHidden: vi.fn(),
	getHidden: vi.fn(),
	setSelectValue: vi.fn(),
	setSelectOptions: vi.fn(),
	getSelectValue: vi.fn(),
	getInputChecked: vi.fn(),
	getInputValue: vi.fn(),
	setAreaSelection: vi.fn(),
	setAreaScrollTop: vi.fn(),
	setAreaInputList: vi.fn(),
	addEventListenerById: vi.fn(),
} as unknown as View;

describe('Debugger Breakpoints Integration', () => {
	let controller: Controller;
	let model: Model;

	beforeEach(() => {
		vi.useFakeTimers();

		// Setup DOM elements required by Canvas and Controller
		const setupElement = (id: string, tag = 'div') => {
			if (!document.getElementById(id)) {
				const el = document.createElement(tag);
				el.id = id;
				document.body.appendChild(el);
			}
		};

		setupElement(ViewID.cpcCanvas, 'canvas');
		setupElement(ViewID.noCanvas);
		setupElement(ViewID.textText, 'textarea');
		setupElement(ViewID.cpcArea); // Required by Canvas constructor
		setupElement(ViewID.showCpcInput, 'input'); // Possibly used by toggleAreaHiddenById?
		setupElement(ViewID.galleryAreaItems); // Used by initDropZone -> addFileSelectHandler?
		setupElement(ViewID.dropZone);
		setupElement(ViewID.fileInput, 'input');
		setupElement(ViewID.debugPauseButton, 'button');
		setupElement(ViewID.debugResumeButton, 'button');
		setupElement(ViewID.debugStepIntoButton, 'button');
		setupElement(ViewID.debugSpeedInput, 'input');
		setupElement(ViewID.debugModeInput, 'input');
		setupElement(ViewID.debugAddBreakpointButton, 'button');
		setupElement(ViewID.debugBreakpointInput, 'input');
		setupElement(ViewID.debugBreakpointList, 'div');
		setupElement(ViewID.debugLineLabel, 'span');
		setupElement(ViewID.debugArea, 'fieldset');
        setupElement(ViewID.outputText, 'textarea'); // Added outputText for fnChain to read from

		model = new Model();
		model.setProperty(ModelPropID.debugMode, true);
		model.setProperty(ModelPropID.speed, 100); // Full speed (no throttle)

		controller = new Controller(model, mockView);
	});

	afterEach(() => {
		if (controller) controller.dispose();
		document.body.innerHTML = ''; // Cleanup DOM
		vi.useRealTimers();
	});

	it('should pause at conditional breakpoint when true', () => {
		const script = "10 a=1\n20 a=2\n30 a=3";
		vi.spyOn(mockView, 'getAreaValue').mockImplementation((id) => {
            if (id === ViewID.inputText) return script;
            // For outputText, we should return what was set.
            // But fnParse sets it via setAreaValue.
            // fnChain gets it via getAreaValue.
            // We need a way to pass data from set to get.
            // The mockView defined above doesn't store state.
            // We should use a simple stateful mock for get/setAreaValue.
            return (mockView as any)._areaValues?.[id] || '';
        });

        (mockView as any)._areaValues = {};
        vi.spyOn(mockView, 'setAreaValue').mockImplementation((id, val) => {
            (mockView as any)._areaValues[id] = val;
        });

		const dbg = controller.getDebugger();
		dbg.addBreakpoint(20, "a=1");

		controller.fnParse(); // Compile
		controller.startRun(); // Start

		vi.advanceTimersByTime(1000);

		expect(dbg.getSnapshot().state).toBe("paused");
		expect(dbg.getSnapshot().line).toBe(20);
		expect(dbg.getVariables().aR).toBe(1); // Variables are compiled to aR (real by default)
	});

	it('should skip conditional breakpoint when false', () => {
		const script = "10 a=1\n20 a=2\n30 a=3";

        (mockView as any)._areaValues = {};
        vi.spyOn(mockView, 'getAreaValue').mockImplementation((id) => {
            if (id === ViewID.inputText) return script;
            return (mockView as any)._areaValues?.[id] || '';
        });
        vi.spyOn(mockView, 'setAreaValue').mockImplementation((id, val) => {
            (mockView as any)._areaValues[id] = val;
        });

		const dbg = controller.getDebugger();
		dbg.addBreakpoint(20, "a=5");

		controller.fnParse();
		controller.startRun();

		vi.advanceTimersByTime(1000);

		const snapshot = dbg.getSnapshot();
		if (snapshot.state === "paused") {
			expect(snapshot.line).not.toBe(20);
		} else {
			expect(snapshot.state).not.toBe("paused"); // if idle
		}
	});

	it('should handle complex conditions', () => {
		const script = "10 a=1: b=2\n20 c=a+b\n30 if c=3 then d=4";

        (mockView as any)._areaValues = {};
        vi.spyOn(mockView, 'getAreaValue').mockImplementation((id) => {
            if (id === ViewID.inputText) return script;
            return (mockView as any)._areaValues?.[id] || '';
        });
        vi.spyOn(mockView, 'setAreaValue').mockImplementation((id, val) => {
            (mockView as any)._areaValues[id] = val;
        });

		const dbg = controller.getDebugger();
		dbg.addBreakpoint(30, "c=3 and b>1");

		controller.fnParse();
		controller.startRun();

		vi.advanceTimersByTime(1000);

		expect(dbg.getSnapshot().state).toBe("paused");
		expect(dbg.getSnapshot().line).toBe(30);
		const vars = dbg.getVariables();
		expect(vars.cR).toBe(3);
	});
});
