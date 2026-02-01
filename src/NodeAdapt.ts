// NodeAdapt.ts - Adaptations for nodeJS
//

import { ViewID } from "./Constants";
import { Utils } from "./Utils";
import { View } from "./View";
import { Controller } from "./Controller";

// examples:
// npm run build:one
// node dist/cpclocots.js sound=false canvasType=text debug=0 example=test/testpage
// node dist/cpclocots.js sound=false canvasType=text debug=0 databaseDirs=https://benchmarko.github.io/CpcLocoApps/apps database=apps example=math/euler
interface NodeHttps {
	get: (url: string, fn: (res: any) => void) => any
}

interface NodeFs {
	readFile: (name: string, encoding: string, fn: (res: any) => void) => any
}

export class NodeAdapt {
	static doAdapt(): void {
		let https: NodeHttps, // nodeJs
			fs: NodeFs,
			module: any,
			audioContext: any;

		const domElements: Record<string, any> = {},
			myCreateElement = function (id: string) {
                const el: any = {
					className: "",
					style: {
						borderwidth: "",
						borderStyle: ""
					},
					addEventListener: () => {
						// nothing
					},
					options: [],
					getAttribute: () => {
						// nothing
					},
					setAttribute: () => {
						// nothing
					},
                    disabled: false,
                    value: "",
                    childNodes: [],
                    appendChild: () => {},
                    removeChild: () => {},
                    lastChild: null,
                    firstChild: null,
                    childElementCount: 0,
                    width: 640,
                    height: 400,
                    add: (option: any) => {
                        el.options.push(option);
                        if (el.options.length === 1 || option.selected) {
                            el.value = el.options[el.options.length - 1].value;
                        }
                    },
                    getContext: (type: string) => {
                         if (type === '2d') {
                             return {
                                 getImageData: () => ({ data: { buffer: new ArrayBuffer(el.width * el.height * 4) } }),
                                 putImageData: () => {},
                                 fillRect: () => {},
                                 // Add other methods as needed
                             };
                         }
                         return null;
                    },
                    focus: () => {}
				};
				domElements[id] = el;

				// old syntax for getter with "get length() { ... }"
				Object.defineProperty(domElements[id], "length", {
					get() {
						return domElements[id].options.length;
					},
					set(len: number) {
						domElements[id].options.length = len;
					},
					enumerable: true,
					configurable: true
				});
				return domElements[id];
			};

		function fnEval(code: string) {
			try {
				return eval(code); // eslint-disable-line no-eval
			} catch (e) {
				Utils.console.warn("fnEval failed for: " + code, e);
				return undefined;
			}
		}

		if (!audioContext) {
			// fnEval('audioContext = require("web-audio-api").AudioContext;'); // has no createChannelMerger()
			if (!audioContext) {
				audioContext = function() {
					throw new Error("AudioContext not supported");
				};
			}
		}

        const hasRealDom = typeof window !== 'undefined' && window.document && typeof window.document.createElement === 'function';

        if (!hasRealDom) {
		// Ensure window exists (it should in jsdom, but maybe not in pure node)
		if (typeof window !== 'undefined') {
			Object.assign(window, {
				console: console,
				    document: {
					    addEventListener: () => {
						    // nothing
					    },
					getElementById: (id: string) => domElements[id] || myCreateElement(id),
					createElement: (type: string) => {
						if (type === "option") {
							return {};
						}
						Utils.console.error("createElement: unknown type", type);
						    return {};
					}
				},
				AudioContext: audioContext
			    });
		}

            // Patch View
            const view = View;
            const setSelectOptionsOrig = view.prototype.setSelectOptions;

            // fast hacks...

            view.prototype.setSelectOptions = function(id: string, options: any[]) {
                const element = domElements[id] || myCreateElement(id);

                if (!element.options.add) {
                    element.add = (option: any) => {
                        // eslint-disable-next-line no-invalid-this
                        element.options.push(option);
                        if (element.options.length === 1 || option.selected) {
                            element.value = element.options[element.options.length - 1].value;
                        }
                    };
                }
                // @ts-ignore
                return setSelectOptionsOrig.call(this, id, options);
            };


            const setAreaValueOrig = view.prototype.setAreaValue;

            view.prototype.setAreaValue = function(id: string, value: string) {
                if (id === ViewID.resultText) {
                    if (value) {
                        Utils.console.log(value);
                    }
                }
                // @ts-ignore
                return setAreaValueOrig.call(this, id, value);
            };
        } else {
            // Real DOM available (e.g. jsdom)
             if (typeof window !== 'undefined') {
                 if (!(window as any).AudioContext) {
                    (window as any).AudioContext = audioContext;
                 }

                 // Patch getElementById to fallback to fake elements
                 if (window.document) {
                     const originalGetElementById = window.document.getElementById;
                     window.document.getElementById = function(id: string) {
                         const el = originalGetElementById.call(this, id);
                         if (el) return el;
                         // Fallback
                         return domElements[id] || myCreateElement(id);
                     }
                 }
             }
        }

		// https://nodejs.dev/learn/accept-input-from-the-command-line-in-nodejs
		// readline?
		const controller = Controller;

		// @ts-ignore
		controller.prototype.startWithDirectInput = function () {
			this.stopUpdateCanvas();
			Utils.console.log("We are ready.");
		};

		function isUrl(s: string) {
			return s.startsWith("http"); // http or https
		}

		function nodeReadUrl(url: string, fnDataLoaded: (error: Error | undefined, data?: string) => void) {
			if (!https) {
				fnEval('https = require("https");'); // to trick TypeScript
			}
			https.get(url, (resp) => {
				let data = "";

				// A chunk of data has been received.
				resp.on("data", (chunk: string) => {
					data += chunk;
				});

				// The whole response has been received. Print out the result.
				resp.on("end", () => {
					fnDataLoaded(undefined, data);
				});
			}).on("error", (err: Error) => {
				Utils.console.log("Error: " + err.message);
				fnDataLoaded(err);
			});
		}

		let modulePath: string;

		function nodeReadFile(name: string, fnDataLoaded: (error: Error | undefined, data?: string) => void) {
			if (!fs) {
				fnEval('fs = require("fs");'); // to trick TypeScript
			}

			if (!module) {
				fnEval('module = require("module");'); // to trick TypeScript

                if (module) {
				    modulePath = module.path || "";
                } else {
                    modulePath = "";
                }

				if (!modulePath) {
					Utils.console.warn("nodeReadFile: Cannot determine module path");
				}
			}

			const name2 = modulePath ? modulePath + "/" + name : name;

			fs.readFile(name2, "utf8", fnDataLoaded);
		}

		const utils = Utils;

		utils.loadScript = (fileOrUrl: string, fnSuccess: ((url2: string, key: string) => void), _fnError: ((url2: string, key: string) => void), key: string) => {
			const fnLoaded = (error: Error | undefined, data?: string) => {
				if (error) {
					Utils.console.error("file error: ", error);
				}
				if (data) {
					fnEval(data); // load js (for nodeJs)
				}
				fnSuccess(fileOrUrl, key);
			};

			if (isUrl(fileOrUrl)) {
				nodeReadUrl(fileOrUrl, fnLoaded);
			} else {
				nodeReadFile(fileOrUrl, fnLoaded);
			}
		};
	}
}
// end
