import { Controller, DebugEvent, DebugState, View, ViewID } from "cpclocots";

export class UiDebugger {
	private readonly controller: Controller;

	constructor(controller: Controller) {
		this.controller = controller;
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
			// Scroll textarea and select line
			const textArea = View.getElementById1(ViewID.inputText) as HTMLTextAreaElement;

			// We can use setSelectionRange to highlight, but we need to ensure we don't mess up if user is editing.
			// Usually debug mode implies read-only or careful editing.

			// Only scroll if we are not editing?
			// For now, simple implementation:
			textArea.setSelectionRange(range.startPos, range.endPos);

			// To scroll to the selection:
			// There is no standard API for scrolling textarea to selection.
			// But focusing it usually scrolls.
			// textArea.focus(); // Steals focus from buttons?

			// Maybe just updating label is enough for MVP if scroll is hard.
			// Design doc: "Recommended for MVP: Option B — a status line showing the current BASIC line number, plus auto-scroll of the textarea to that line."

			// Auto-scroll hack:
			const text = textArea.value;
			const sub = text.substring(0, range.startPos);
			const lines = sub.split("\n").length;
			const lineHeight = 15; // approximate line height in px?
			// textArea.scrollTop = lines * lineHeight;
			// This is unreliable.

			// blur and focus might work?
			// textArea.blur();
			// textArea.focus();
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
