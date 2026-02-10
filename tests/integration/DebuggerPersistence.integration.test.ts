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

describe('Debugger Persistence Integration', () => {
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
		setupElement(ViewID.cpcArea);
		setupElement(ViewID.showCpcInput, 'input');
		setupElement(ViewID.galleryAreaItems);
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
		setupElement(ViewID.outputText, 'textarea');

		model = new Model();
		model.setProperty(ModelPropID.debugMode, true);
		model.setProperty(ModelPropID.speed, 100);

		controller = new Controller(model, mockView);
	});

	afterEach(() => {
		if (controller) controller.dispose();
		document.body.innerHTML = ''; // Cleanup DOM
		vi.useRealTimers();
	});

	it('should persist and restore breakpoints across sessions', () => {
		const script = "10 a=1\n20 a=2\n30 a=3\n40 a=4";

		// Setup view mock for data flow
		(mockView as any)._areaValues = {};
		vi.spyOn(mockView, 'getAreaValue').mockImplementation((id) => {
			if (id === ViewID.inputText) return script;
			return (mockView as any)._areaValues?.[id] || '';
		});
		vi.spyOn(mockView, 'setAreaValue').mockImplementation((id, val) => {
			(mockView as any)._areaValues[id] = val;
		});

		const dbg = controller.getDebugger();

		// 1. Add breakpoints
		dbg.addBreakpoint(20); // Normal breakpoint
		dbg.addBreakpoint(40, "a=3"); // Conditional breakpoint

		// 2. Export state
		const state = dbg.exportBreakpoints();

		// 3. Clear/Reset
		dbg.clearBreakpoints();
		expect(dbg.getBreakpoints()).toHaveLength(0);

		// 4. Import state
		dbg.importBreakpoints(state);
		expect(dbg.getBreakpoints()).toHaveLength(2);

		// 5. Run and verify it stops at restored breakpoint (line 20)
		controller.fnParse();
		controller.startRun();

		vi.advanceTimersByTime(1000);

		expect(dbg.getSnapshot().state).toBe("paused");
		expect(dbg.getSnapshot().line).toBe(20);

		// 6. Resume and verify it stops at restored conditional breakpoint (line 40)
		controller.startContinue(); // use startContinue to resume from debug pause
		vi.advanceTimersByTime(1000);

		expect(dbg.getSnapshot().state).toBe("paused");
		expect(dbg.getSnapshot().line).toBe(40);
	});
});
