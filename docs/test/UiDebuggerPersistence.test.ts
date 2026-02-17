import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { UiDebugger } from "../src/UiDebugger";
import { View, ViewID } from "cpclocots";

describe("UiDebugger Persistence", () => {
    let controller: any;
    let view: any;
    let debuggerMock: any;
    let uiDebugger: UiDebugger;
    let elements: Record<string, any>;
    let localStorageMock: Record<string, string>;

    beforeEach(() => {
        elements = {};
        localStorageMock = {};

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
                    selectionStart: 0,
                    scrollTop: 0
                };
            }
            return elements[id];
        });

        // Mock getElementByIdAs for toggleBreakpointAtCursor
        vi.spyOn(View, "getElementByIdAs").mockImplementation((id: string) => {
             return elements[id] as any;
        });


        // Mock document.addEventListener
        vi.spyOn(document, "addEventListener").mockImplementation(() => {});

        // Mock localStorage
        vi.stubGlobal("localStorage", {
            getItem: vi.fn((key: string) => localStorageMock[key] || null),
            setItem: vi.fn((key: string, value: string) => {
                localStorageMock[key] = value;
            }),
            removeItem: vi.fn((key: string) => {
                delete localStorageMock[key];
            }),
            clear: vi.fn(() => {
                localStorageMock = {};
            })
        });

        debuggerMock = {
            pause: vi.fn(),
            resume: vi.fn(),
            stepInto: vi.fn(),
            stepOver: vi.fn(),
            stepOut: vi.fn(),
            setSpeed: vi.fn(),
            on: vi.fn(),
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
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it("should load breakpoints from localStorage on init", () => {
        const savedBreakpoints = {
            breakpoints: [
                { line: 10, enabled: true, condition: "x%>5" },
                { line: 20, enabled: false }
            ]
        };
        localStorageMock["cpc_breakpoints"] = JSON.stringify(savedBreakpoints);

        uiDebugger = new UiDebugger(controller, view);

        expect(localStorage.getItem).toHaveBeenCalledWith("cpc_breakpoints");
        expect(debuggerMock.importBreakpoints).toHaveBeenCalledWith(savedBreakpoints);
    });

    it("should save breakpoints to localStorage when adding a breakpoint", () => {
        uiDebugger = new UiDebugger(controller, view);

        // Simulate add breakpoint
        debuggerMock.addBreakpoint.mockImplementation(() => {
            // Mock that the breakpoint is added and returned in subsequent calls
             debuggerMock.getBreakpoints.mockReturnValue([{ line: 30, enabled: true }]);
             debuggerMock.exportBreakpoints.mockReturnValue({ breakpoints: [{ line: 30, enabled: true }] });
        });

        // Ensure element exists in mock by calling getElementById1
        const input = View.getElementById1(ViewID.debugBreakpointInput) as any;
        input.value = "30";

        const addBtn = elements[ViewID.debugAddBreakpointButton];
        const clickHandler = addBtn.addEventListener.mock.calls.find((c: any[]) => c[0] === "click")[1];
        clickHandler();

        expect(debuggerMock.addBreakpoint).toHaveBeenCalledWith(30, undefined);
        expect(debuggerMock.exportBreakpoints).toHaveBeenCalled();
        expect(localStorage.setItem).toHaveBeenCalledWith("cpc_breakpoints", JSON.stringify({ breakpoints: [{ line: 30, enabled: true }] }));
    });

    it("should save breakpoints when removing a breakpoint", () => {
        // Setup initial state
        debuggerMock.getBreakpoints.mockReturnValue([{ line: 10, enabled: true }]);
        uiDebugger = new UiDebugger(controller, view);

        // Find the remove button for the breakpoint
        // updateBreakpointList is called in init, so elements should exist in the list
        const list = elements[ViewID.debugBreakpointList];
        // In our mock, list.appendChild puts elements in no structured way in `elements`,
        // but the mock implementation of appendChild is just a stub.
        // We need to inspect how appendChild was called.

        // Wait, UiDebugger calls list.appendChild(div).
        // Our mock View.getElementById1 returns an object where appendChild is a mock function.
        // We can inspect calls to that mock function.

        expect(list.appendChild).toHaveBeenCalled();
        const div = list.appendChild.mock.calls[0][0] as HTMLElement;
        const removeBtn = div.querySelectorAll("button")[0] as HTMLButtonElement; // The 'x' button is the only button?
        // Wait, document.createElement is not mocked in my test file to return full DOM elements with querySelectorAll support unless JSDOM is working.
        // Vitest uses jsdom environment, so document.createElement creates real JSDOM elements.

        // The remove button is the last child: checkbox, span, button.
        // But let's check the code: div.appendChild(btn)

        // Since I'm using JSDOM environment, the elements created inside UiDebugger are real JSDOM elements.
        // But `list` (the container) is a mock object from `elements`.
        // So `div` is real.

        // However, `removeBtn` needs to be clicked.
        // Since `div` is real, `div.children` works.
        // btn is the 3rd child (index 2).

        expect(div.children.length).toBe(3);
        const btn = div.children[2] as HTMLButtonElement;

        // Simulate remove
        debuggerMock.removeBreakpoint.mockImplementation(() => {
             debuggerMock.getBreakpoints.mockReturnValue([]);
             debuggerMock.exportBreakpoints.mockReturnValue({ breakpoints: [] });
        });

        btn.click(); // Trigger click event

        expect(debuggerMock.removeBreakpoint).toHaveBeenCalledWith(10);
        expect(localStorage.setItem).toHaveBeenCalledWith("cpc_breakpoints", JSON.stringify({ breakpoints: [] }));
    });

    it("should save breakpoints when toggling via gutter", () => {
         uiDebugger = new UiDebugger(controller, view);

         const gutter = elements[ViewID.debugGutter];
         const clickHandler = gutter.addEventListener.mock.calls.find((c: any[]) => c[0] === "click")[1];

         const lineDiv = document.createElement("div");
         lineDiv.className = "gutterLine";
         lineDiv.setAttribute("data-line", "50");

         debuggerMock.toggleBreakpoint.mockImplementation(() => {
             debuggerMock.exportBreakpoints.mockReturnValue({ breakpoints: [{line: 50, enabled: true}] });
         });

         clickHandler({ target: lineDiv });

         expect(debuggerMock.toggleBreakpoint).toHaveBeenCalledWith(50);
         expect(localStorage.setItem).toHaveBeenCalledWith("cpc_breakpoints", expect.stringContaining('"line":50'));
    });
});
