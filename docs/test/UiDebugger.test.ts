import { describe, it, expect, vi, beforeEach } from "vitest";
import { UiDebugger } from "../src/UiDebugger";
import { View, ViewID } from "cpclocots";

describe("UiDebugger", () => {
    let controller: any;
    let view: any;
    let debuggerMock: any;
    let uiDebugger: UiDebugger;
    let elements: Record<string, any>;

    beforeEach(() => {
        elements = {};

        // Mock View methods
        view = {
            setAreaSelection: vi.fn(),
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
                    checked: false
                };
            }
            return elements[id];
        });

        debuggerMock = {
            pause: vi.fn(),
            resume: vi.fn(),
            stepInto: vi.fn(),
            setSpeed: vi.fn(),
            on: vi.fn(),
            getCurrentLineRange: vi.fn().mockReturnValue(null)
        };

        controller = {
            getDebugger: () => debuggerMock
        };

        uiDebugger = new UiDebugger(controller, view);
    });

    it("should initialize controls", () => {
        // Check if event listeners are attached
        expect(elements[ViewID.debugPauseButton].addEventListener).toHaveBeenCalledWith("click", expect.any(Function));
        expect(elements[ViewID.debugSpeedInput].addEventListener).toHaveBeenCalledWith("input", expect.any(Function));
        expect(debuggerMock.on).toHaveBeenCalled();
    });

    it("should update controls when running", () => {
        // Trigger event
        const onEvent = debuggerMock.on.mock.calls[0][0];
        onEvent({
            type: "stateChange",
            snapshot: { state: "running" }
        });

        expect(elements[ViewID.debugPauseButton].disabled).toBe(false);
        expect(elements[ViewID.debugResumeButton].disabled).toBe(true);
        expect(elements[ViewID.debugStepIntoButton].disabled).toBe(true);
    });

    it("should update controls when paused", () => {
        const onEvent = debuggerMock.on.mock.calls[0][0];
        onEvent({
            type: "paused",
            snapshot: { state: "paused" }
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
            snapshot: { state: "paused" }
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
});
