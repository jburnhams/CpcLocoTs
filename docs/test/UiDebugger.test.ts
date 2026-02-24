import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { UiDebugger } from "../src/UiDebugger";
import { View, ViewID } from "cpclocots";

describe("UiDebugger", () => {
    let controller: any;
    let view: any;
    let debuggerMock: any;
    let uiDebugger: UiDebugger;
    let elements: Record<string, any>;
    let documentEvents: Record<string, Function> = {};

    beforeEach(() => {
        elements = {};
        documentEvents = {};

        // Mock View methods
        view = {
            setAreaSelection: vi.fn(),
            setSelectOptions: vi.fn(),
            getSelectValue: vi.fn().mockReturnValue(""),
            setAreaValue: vi.fn(),
        };

        // Mock static View methods
        vi.spyOn(View, "getElementById1").mockImplementation((id: string) => {
            if (!elements[id]) {
                elements[id] = {
                    addEventListener: vi.fn(),
                    disabled: false,
                    value: "",
                    classList: {
                        remove: vi.fn(),
                        add: vi.fn()
                    },
                    textContent: "",
                    checked: false,
                    innerHTML: "",
                    appendChild: vi.fn(),
                    selectionStart: 0, // For textarea
                    scrollTop: 0
                };
            }
            return elements[id];
        });

        // Mock document.addEventListener
        vi.spyOn(document, "addEventListener").mockImplementation((event, handler) => {
            documentEvents[event] = handler as Function;
        });

        debuggerMock = {
            pause: vi.fn(),
            resume: vi.fn(),
            stepInto: vi.fn(),
            stepOver: vi.fn(),
            stepOut: vi.fn(),
            setSpeed: vi.fn(),
            on: vi.fn(),
            getLineRange: vi.fn().mockReturnValue(null),
            getCurrentLineRange: vi.fn().mockReturnValue(null),
            getBreakpoints: vi.fn().mockReturnValue([]),
            addBreakpoint: vi.fn(),
            removeBreakpoint: vi.fn(),
            toggleBreakpoint: vi.fn(),
            getCallStack: vi.fn().mockReturnValue([]),
            getSnapshot: vi.fn().mockReturnValue({ state: "idle", variables: {} }),
            eval: vi.fn(),
            exec: vi.fn(),
            getMemoryRange: vi.fn().mockReturnValue([]),
            exportBreakpoints: vi.fn().mockReturnValue({ breakpoints: [] }),
            importBreakpoints: vi.fn()
        };

        controller = {
            getDebugger: () => debuggerMock,
            startRun: vi.fn()
        };

        uiDebugger = new UiDebugger(controller, view);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("should initialize controls", () => {
        // Check if event listeners are attached
        expect(elements[ViewID.debugPauseButton].addEventListener).toHaveBeenCalledWith("click", expect.any(Function));
        expect(elements[ViewID.debugSpeedInput].addEventListener).toHaveBeenCalledWith("input", expect.any(Function));
        expect(elements[ViewID.debugAddBreakpointButton].addEventListener).toHaveBeenCalledWith("click", expect.any(Function));
        expect(document.addEventListener).toHaveBeenCalledWith("keydown", expect.any(Function));
        expect(debuggerMock.on).toHaveBeenCalled();
    });

    it("should update controls when running", () => {
        // Trigger event
        const onEvent = debuggerMock.on.mock.calls[0][0];
        onEvent({
            type: "stateChange",
            snapshot: { state: "running", variables: {} }
        });

        expect(elements[ViewID.debugPauseButton].disabled).toBe(false);
        expect(elements[ViewID.debugResumeButton].disabled).toBe(true);
        expect(elements[ViewID.debugStepIntoButton].disabled).toBe(true);
    });

    it("should update controls when paused", () => {
        const onEvent = debuggerMock.on.mock.calls[0][0];
        onEvent({
            type: "paused",
            snapshot: { state: "paused", variables: {} }
        });

        expect(elements[ViewID.debugPauseButton].disabled).toBe(true);
        expect(elements[ViewID.debugResumeButton].disabled).toBe(false);
        expect(elements[ViewID.debugStepIntoButton].disabled).toBe(false);
    });

    it("should update line highlight", () => {
        debuggerMock.getCurrentLineRange.mockReturnValue({
            line: 10,
            startPos: 0,
            endPos: 10
        });

        const onEvent = debuggerMock.on.mock.calls[0][0];
        onEvent({
            type: "step",
            snapshot: { state: "paused", variables: {} }
        });

        expect(elements[ViewID.debugLineLabel].textContent).toBe("Line: 10");
        expect(view.setAreaSelection).toHaveBeenCalledWith(ViewID.inputText, 0, 10);
    });

    it("should set speed on input", () => {
        const input = elements[ViewID.debugSpeedInput];
        const listener = input.addEventListener.mock.calls.find((c: any[]) => c[0] === "input")[1];

        input.value = "50";
        listener();

        expect(debuggerMock.setSpeed).toHaveBeenCalledWith(50);
    });

    it("should refresh variables with diff", () => {
        const onEvent = debuggerMock.on.mock.calls[0][0];

        // First snapshot (all new, so all marked changed)
        onEvent({
            type: "paused",
            snapshot: {
                state: "paused",
                variables: { a: 1, b: 2 }
            }
        });

        expect(view.setSelectOptions).toHaveBeenCalledWith(ViewID.varSelect, expect.arrayContaining([
            expect.objectContaining({ value: "a", text: "a=1 *" }),
            expect.objectContaining({ value: "b", text: "b=2 *" })
        ]));

        // Second snapshot with change
        onEvent({
            type: "step",
            snapshot: {
                state: "paused",
                variables: { a: 1, b: 3 } // b changed
            }
        });

        expect(view.setSelectOptions).toHaveBeenLastCalledWith(ViewID.varSelect, expect.arrayContaining([
            expect.objectContaining({ value: "a", text: "a=1" }),
            expect.objectContaining({ value: "b", text: "b=3 *" }) // Check for asterisk
        ]));
    });

    it("should detect deleted variables", () => {
        const onEvent = debuggerMock.on.mock.calls[0][0];

        // First snapshot
        onEvent({
            type: "paused",
            snapshot: {
                state: "paused",
                variables: { a: 1, b: 2 }
            }
        });

        // Second snapshot (b deleted)
        onEvent({
            type: "step",
            snapshot: {
                state: "paused",
                variables: { a: 1 }
            }
        });

        expect(view.setSelectOptions).toHaveBeenLastCalledWith(ViewID.varSelect, expect.arrayContaining([
            expect.objectContaining({ value: "a", text: "a=1" }),
            expect.objectContaining({ value: "b", text: "b=undefined *" }) // b deleted
        ]));
    });

    it("should handle keyboard shortcuts", () => {
        // Enable debug mode
        elements[ViewID.debugModeInput].checked = true;

        // Mock getSnapshot for paused state
        debuggerMock.getSnapshot.mockReturnValue({ state: "paused", variables: {} });

        const onKeyDown = documentEvents["keydown"];
        expect(onKeyDown).toBeDefined();

        // Helper to simulate key press
        const simulateKey = (key: string, shiftKey = false) => {
            const event = {
                key,
                shiftKey,
                preventDefault: vi.fn()
            };
            onKeyDown(event);
            return event;
        };

        // F10: Step Over
        simulateKey("F10");
        expect(debuggerMock.stepOver).toHaveBeenCalled();

        // F11: Step Into
        simulateKey("F11");
        expect(debuggerMock.stepInto).toHaveBeenCalled();

        // Shift+F11: Step Out
        simulateKey("F11", true);
        expect(debuggerMock.stepOut).toHaveBeenCalled();

        // F5: Resume
        simulateKey("F5");
        expect(debuggerMock.resume).toHaveBeenCalled();

        // Change state to idle for Run test
        debuggerMock.getSnapshot.mockReturnValue({ state: "idle", variables: {} });
        simulateKey("F5");
        expect(controller.startRun).toHaveBeenCalled();
    });

    it("should toggle breakpoint at cursor with F9", () => {
        // Enable debug mode
        elements[ViewID.debugModeInput].checked = true;

        // Ensure inputText element exists
        View.getElementById1(ViewID.inputText);
        const input = elements[ViewID.inputText];
        input.value = "10 PRINT 'Hello'\n20 GOTO 10";
        input.selectionStart = 5; // Cursor on first line ("10 ...")

        const onKeyDown = documentEvents["keydown"];
        const event = {
            key: "F9",
            preventDefault: vi.fn()
        };
        onKeyDown(event);

        expect(event.preventDefault).toHaveBeenCalled();
        expect(debuggerMock.toggleBreakpoint).toHaveBeenCalledWith(10);

        // Move cursor to second line
        input.selectionStart = 20; // Cursor on second line ("20 ...")
        onKeyDown(event);
        expect(debuggerMock.toggleBreakpoint).toHaveBeenCalledWith(20);
    });

    it("should update gutter with breakpoints", () => {
        const input = elements[ViewID.inputText];
        const gutter = elements[ViewID.debugGutter];

        input.value = "10 PRINT 'A'\n20 GOTO 10";
        debuggerMock.getBreakpoints.mockReturnValue([
            { line: 10, enabled: true },
            { line: 20, enabled: false }
        ]);

        // Trigger gutter update (e.g. via input event)
        const onInput = input.addEventListener.mock.calls.find((c: any[]) => c[0] === "input")[1];

        // Clear previous calls from init
        gutter.appendChild.mockClear();

        onInput();

        // Check that a DocumentFragment was appended
        expect(gutter.appendChild).toHaveBeenCalledTimes(1);
        const fragment = gutter.appendChild.mock.calls[0][0];
        expect(fragment).toBeInstanceOf(DocumentFragment);

        // Check children of fragment
        expect(fragment.children.length).toBe(2);

        const line10Div = fragment.children[0] as HTMLElement;
        expect(line10Div.getAttribute("data-line")).toBe("10");
        expect(line10Div.classList.contains("breakpoint")).toBe(true);
        expect(line10Div.title).toContain("Breakpoint at 10");

        const line20Div = fragment.children[1] as HTMLElement;
        expect(line20Div.getAttribute("data-line")).toBe("20");
        expect(line20Div.classList.contains("breakpoint")).toBe(false);
    });

    it("should toggle breakpoint when clicking gutter (delegation)", () => {
        const gutter = elements[ViewID.debugGutter];

        // Mock a click event on a child element
        const lineDiv = document.createElement("div");
        lineDiv.className = "gutterLine";
        lineDiv.setAttribute("data-line", "10");

        // Simulate event delegation
        // Find the click handler attached to gutter
        const clickHandler = gutter.addEventListener.mock.calls.find((c: any[]) => c[0] === "click")[1];

        // Call it with a mock event
        clickHandler({
            target: lineDiv
        });

        expect(debuggerMock.toggleBreakpoint).toHaveBeenCalledWith(10);
    });

    it("should sync gutter scroll", () => {
        const input = elements[ViewID.inputText];
        const gutter = elements[ViewID.debugGutter];

        input.scrollTop = 100;

        const onScroll = input.addEventListener.mock.calls.find((c: any[]) => c[0] === "scroll")[1];
        onScroll();

        expect(gutter.scrollTop).toBe(100);
    });

    it("should navigate to source line when clicking call stack frame", () => {
        debuggerMock.getCallStack.mockReturnValue([
            { returnLabel: 10, depth: 1 },
            { returnLabel: 100, depth: 0 }
        ]);

        // Trigger updateCallStack via a debug event
        const onEvent = debuggerMock.on.mock.calls[0][0];
        onEvent({
            type: "paused",
            snapshot: { state: "paused", variables: {} }
        });

        const list = elements[ViewID.debugCallStackList];

        // Should have created 2 LI elements
        expect(list.appendChild).toHaveBeenCalledTimes(2);

        // Get the LI element for the second frame (line 100)
        // appendChild calls: call 0 -> frame 0 (line 10), call 1 -> frame 1 (line 100)
        const li100 = list.appendChild.mock.calls[1][0] as HTMLElement;

        expect(li100.textContent).toContain("line 100");
        expect(li100.classList.contains("clickable")).toBe(true);

        // Mock getLineRange response
        debuggerMock.getLineRange.mockReturnValue({
            line: 100,
            startPos: 50,
            endPos: 60
        });

        // Trigger click
        li100.click();

        expect(debuggerMock.getLineRange).toHaveBeenCalledWith(100);
        expect(view.setAreaSelection).toHaveBeenCalledWith(ViewID.inputText, 50, 60);
        expect(elements[ViewID.debugLineLabel].textContent).toBe("Line: 100 (stack)");
    });
});
