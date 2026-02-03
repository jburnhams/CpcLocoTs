// Polyfills.ts - Some Polyfills for old browsers, e.g. IE8, and nodeJS
//

/* globals globalThis */

var Polyfills = {
	list: [] as string[],
	getList: function (): string[] {
		return Polyfills.list;
	},
	log: function (part: string): void {
		Polyfills.list.push(part);
	},
	console: (typeof window !== "undefined" && window.console) ? window.console : globalThis.console,

	localStorage: (function () {
		let rc: Storage | undefined;

		if (typeof window !== "undefined") {
			try {
				rc = window.localStorage;
			} catch (_e) {
				// empty
			}
		}
		return rc as Storage; // if it is undefined, localStorage is set in Polyfills
	}()),

	isNodeAvailable: (function () {
		// eslint-disable-next-line no-new-func
		const myGlobalThis = (typeof globalThis !== "undefined") ? globalThis : Function("return this")(); // for old IE
		let nodeJs = false;

		// https://www.npmjs.com/package/detect-node
		// Only Node.JS has a process variable that is of [[Class]] process
		try {
			if (Object.prototype.toString.call(myGlobalThis.process) === "[object process]") {
				nodeJs = true;
			}
		} catch (e) {
			// empty
		}
		return nodeJs;
	}()),

	isDefinePropertyOk: true // Modern browsers support this
};

// Polyfill console if completely missing
if (!Polyfills.console && typeof window !== "undefined") {
	const polyFillConsole: any = {
		CpcLocoLog: "LOG:\n",
		log: function () { // varargs
			if (polyFillConsole.CpcLocoLog) {
				polyFillConsole.CpcLocoLog += Array.prototype.slice.call(arguments).join(" ") + "\n";
			}
		}
	};
	polyFillConsole.info = polyFillConsole.log;
	polyFillConsole.warn = polyFillConsole.log;
	polyFillConsole.error = polyFillConsole.log;
	polyFillConsole.debug = polyFillConsole.log;

	Polyfills.console = polyFillConsole;
	Polyfills.log("window.console");
}


if ((typeof globalThis !== "undefined") && !globalThis.window) { // nodeJS
	Polyfills.log("window");
	(globalThis as any).window = globalThis;
}
(globalThis as any).Polyfills = Polyfills;


// For IE and Edge, localStorage is only available if page is hosted on web server, so we simulate it (do not use property "length" or method names as keys!)
// Also for Node.js
if (!Polyfills.localStorage) {
	Polyfills.log("window.localStorage");
	(function () {
		class Storage {
			length = 0;

			clear() {
				for (const key in this) {
					if (this.hasOwnProperty(key)) {
						delete this[key];
					}
				}
				this.length = 0;
			}

			key(index: number) {
				let i = 0;

				for (const key in this) {
					if (this.hasOwnProperty(key) && key !== "length") {
						if (i === index) {
							return key;
						}
						i += 1;
					}
				}
				return null;
			}

			getItem(key: string) {
				return this.hasOwnProperty(key) ? (this as any)[key] : null;
			}

			setItem(key: string, value: string) {
				if (this.getItem(key) === null) {
					this.length += 1;
				}
				(this as any)[key] = String(value);
			}

			removeItem(key: string) {
				if (this.getItem(key) !== null) {
					delete (this as any)[key];
					this.length -= 1;
				}
			}
		}

		Polyfills.localStorage = new Storage();
	}());
}

if (!window.requestAnimationFrame) {
	// Node.js fallback
	(function () {
		let lastTime = 0;

		Polyfills.log("window.requestAnimationFrame, cancelAnimationFrame");
		window.requestAnimationFrame = function (callback /* , element */) {
			const currTime = Date.now(),
				frameDuration = 1000 / 60, // e.g. 60 Hz
				timeToCall = Math.max(0, frameDuration - (currTime - lastTime)),
				id = window.setTimeout(function () { callback(currTime + timeToCall); }, timeToCall);

			lastTime = currTime + timeToCall;
			return id;
		};
		window.cancelAnimationFrame = function (id) {
			clearTimeout(id);
		};
	}());
}

(Polyfills.console || window.console).debug("Polyfills: (" + Polyfills.getList().length + ") " + Polyfills.getList().join("; "));

window.Polyfills = Polyfills; // for nodeJs

// end
