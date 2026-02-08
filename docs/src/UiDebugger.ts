import { Controller, DebugEvent, DebugState, View, ViewID } from "cpclocots";

export class UiDebugger {
	private readonly controller: Controller;
	private readonly view: View;

	constructor(controller: Controller, view: View) {
		this.controller = controller;
		this.view = view;
		this.init();
	}

	private init() {
		// Wire up buttons
		const pauseBtn = View.getElementById1(ViewID.debugPauseButton);
		const resumeBtn = View.getElementById1(ViewID.debugResumeButton);
		const stepBtn = View.getElementById1(ViewID.debugStepIntoButton);
		const speedInput = View.getElementById1(ViewID.debugSpeedInput) as HTMLInputElement;
		const debugModeInput = View.getElementById1(ViewID.debugModeInput) as HTMLInputElement;

		pauseBtn.addEventListener("click", () => this.controller.getDebugger().pause());
		resumeBtn.addEventListener("click", () => this.controller.getDebugger().resume());
		stepBtn.addEventListener("click", () => this.controller.getDebugger().stepInto());

		speedInput.addEventListener("input", () => {
			const speed = Number(speedInput.value);
			this.controller.getDebugger().setSpeed(speed);
		});

		debugModeInput.addEventListener("change", () => {
			this.updateVisibility();
			// We assume UiEventHandler or UiController handles the actual property update and fnDebugMode call
		});

		this.controller.getDebugger().on(this.onDebugEvent.bind(this));

		// Initial state
		this.updateVisibility();
		this.updateControls("idle");
	}

	private onDebugEvent(event: DebugEvent) {
		if (event.type === "stateChange" || event.type === "paused" || event.type === "resumed") {
			this.updateControls(event.snapshot.state);
		}

		if (event.type === "step" || event.type === "paused" || event.type === "breakpoint") {
			this.updateLineHighlight();
		}
	}

	private updateControls(state: DebugState) {
		const pauseBtn = View.getElementById1(ViewID.debugPauseButton) as HTMLButtonElement;
		const resumeBtn = View.getElementById1(ViewID.debugResumeButton) as HTMLButtonElement;
		const stepBtn = View.getElementById1(ViewID.debugStepIntoButton) as HTMLButtonElement;

		if (state === "running") {
			pauseBtn.disabled = false;
			resumeBtn.disabled = true;
			stepBtn.disabled = true;
		} else if (state === "paused" || state === "stepping") {
			pauseBtn.disabled = true;
			resumeBtn.disabled = false;
			stepBtn.disabled = false;
		} else { // idle
			pauseBtn.disabled = true;
			resumeBtn.disabled = true;
			stepBtn.disabled = true;
		}
	}

	private updateLineHighlight() {
		const range = this.controller.getDebugger().getCurrentLineRange();
		const label = View.getElementById1(ViewID.debugLineLabel);

		if (range) {
			label.textContent = "Line: " + range.line;
			this.view.setAreaSelection(ViewID.inputText, range.startPos, range.endPos);
		} else {
			label.textContent = "Line: -";
		}
	}

	public updateVisibility() {
		const debugModeInput = View.getElementById1(ViewID.debugModeInput) as HTMLInputElement;
		const debugArea = View.getElementById1(ViewID.debugArea);

		if (debugModeInput.checked) {
			debugArea.classList.remove("displayNone");
		} else {
			debugArea.classList.add("displayNone");
		}
	}
}
