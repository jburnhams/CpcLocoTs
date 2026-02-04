// Sound.test.ts - Vitest tests for CpcLoco Sound
//

import { describe, test, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import { Utils } from "../../src/Utils";
import { Sound, SoundData, ToneEnvData, VolEnvData } from "../../src/Sound";

type TestFunctionInputType = string | number | undefined;

type TestFunctionType = (sound: Sound, input: TestFunctionInputType[]) => number | string | void;

const lastTestFunctions: Record<string, TestFunctionInputType[]>[] = [];

function clearLastTestFunctions() {
	lastTestFunctions.length = 0;
}

function combineLastTestFunctions() {
	return lastTestFunctions.map((lastTestFunction) => Object.keys(lastTestFunction)[0] + ":" + Object.values(lastTestFunction)[0]).join(" , ") || undefined;
}

function combineResult(result: string | number | void) {
	const combinedTestFunctions = combineLastTestFunctions(),
		combinedResult: (string | number)[] = [];

	if (combinedTestFunctions !== undefined) {
		combinedResult.push(combinedTestFunctions);
	}

	if (result !== undefined) {
		combinedResult.push(result);
	}

	return combinedResult.join(" -- ");
}

/* eslint-disable class-methods-use-this *//* eslint-disable class-methods-use-this */
class AudioContextMock {
	currentTime: number;
	sampleRate = 24000; // 48000;

	constructor() {
		this.currentTime = 0;
	}

	createChannelMerger(...args: any[]) {
		lastTestFunctions.push({
			createChannelMerger: args
		});
		return {
			connect: function (...args2: any[]) {
				lastTestFunctions.push({
					"channelMerger:connect": args2 as any
				});
				return this;
			},
			disconnect: function (...args2: any[] /* destinationNode: AudioNode */) {
				lastTestFunctions.push({
					"channelMerger:disconnect": args2 as any
				});
			},
			toString: function () {
				return "[obj channelMerger]";
			}
		} as unknown as ChannelMergerNode;
	}

	createGain() {
		lastTestFunctions.push({
			createGain: []
		});
		return {
			connect: function (...args: any[]) {
				lastTestFunctions.push({
					"gain:connect": args as any
				});
			},
			gain: {
				setValueAtTime: function (...args: any[]) {
					lastTestFunctions.push({
						"gain:gain.setValueAtTime": args as any
					});
				},
				linearRampToValueAtTime: function (...args: any[]) {
					lastTestFunctions.push({
						"gain:gain.linearRampToValueAtTime": args
					});
				}
			} as AudioParam,
			toString: function () {
				return "[obj gain]";
			}
		} as unknown as GainNode;
	}

	createBuffer(...args: number[]) { // numberOfChannels: number, length: number, sampleRate: number
		lastTestFunctions.push({
			createBuffer: args
		});
		const length = args[1],
			buffer = new Float32Array(length);

		return {
			getChannelData: function (...args2: any[] /* channel: number */) {
				lastTestFunctions.push({
					"createBuffer:getChannelData": args2
				});
				return buffer; // TODO: new Float32Array()
			}
		} as unknown as AudioBuffer;
	}

	createBufferSource() {
		lastTestFunctions.push({
			createBufferSource: []
		});
		return {
			start: function (...args: any[]) {
				lastTestFunctions.push({
					"bufferSource:start": args
				});
			},
			stop: function (...args: any[]) {
				lastTestFunctions.push({
					"bufferSource:stop": args
				});
			},
			connect: function (...args: any[]) {
				lastTestFunctions.push({
					"bufferSource.connect": args as any
				});
				return this as AudioNode;
			}
		} as unknown as AudioBufferSourceNode;
	}

	createBiquadFilter() {
		lastTestFunctions.push({
			createBiquadFilter: []
		});
		return {
			frequency: {
				value: 0
			},
			toString: function () {
				return "[obj BiquadFilterNode]";
			}
		} as unknown as BiquadFilterNode;
	}

	createOscillator() {
		lastTestFunctions.push({
			createOscillator: []
		});
		return {
			frequency: {
				value: 0,
				setValueAtTime: function (...args: any[]) {
					lastTestFunctions.push({
						"oscillator.frequency.setValueAtTime": args
					});
				}
			},
			connect: function (...args: any[]) {
				lastTestFunctions.push({
					"oscillator.connect": args as any
				});
			},
			start: function (...args: any[]) {
				lastTestFunctions.push({
					"oscillator.start": args
				});
			},
			stop: function (...args: any[]) {
				lastTestFunctions.push({
					"oscillator.stop": args
				});
			},
			disconnect: function (...args: any[]) {
				lastTestFunctions.push({
					"oscillator.disconnect": args as any
				});
			}
		} as unknown as OscillatorNode;
	}
}
/* eslint-enable class-methods-use-this */

describe("Sound: Tests1", function () {
	let sound: Sound;

	beforeEach(function () {
		sound = new Sound({
			AudioContextConstructor: AudioContextMock as unknown as typeof window.AudioContext
		});
	});

	test("create class", function () {
		expect(sound).toBeDefined();
	});

	test("reset", function () {
		sound.reset();
		expect(sound.testCanQueue(0)).toBe(true);
	});

	test("soundOn", function () {
		expect(sound.isActivatedByUser()).toBe(false);

		sound.soundOn();
		expect(sound.testCanQueue(0)).toBe(false);
		expect(sound.isActivatedByUser()).toBe(false);

		sound.setActivatedByUser();
		expect(sound.isActivatedByUser()).toBe(true);
		expect(sound.testCanQueue(0)).toBe(true);

		sound.soundOff();
	});
});

describe("Sound: Tests", function () {
    type AllTestsType = Record<string, Record<string, string>>;

	const allTests: AllTestsType = {
		sound: {
			"1,100,3,12": "createOscillator: , oscillator.connect:[obj gain] , gain:gain.setValueAtTime:0.6400000000000001,0 , oscillator.start:0 , oscillator.stop:0.03 -- undefined",
			"1,100,20,10,0,0,5": "oscillator.stop: , oscillator.disconnect: , createOscillator: , oscillator.connect:[obj gain] , gain:gain.setValueAtTime:0.4444444444444444,0 , oscillator.start:0 , oscillator.stop:0.2 , createBuffer:1,4800,24000 , createBuffer:getChannelData:0 , createBufferSource: , createBiquadFilter: , bufferSource.connect:[obj BiquadFilterNode] , bufferSource.connect:[obj gain] , bufferSource:start:0 , bufferSource:stop:0.2 -- undefined",
			"135,90,20,12,0,0,0": "oscillator.stop: , oscillator.disconnect: , createOscillator: , oscillator.connect:[obj gain] , gain:gain.setValueAtTime:0.6400000000000001,0 , oscillator.start:0 , oscillator.stop:0.2 , createOscillator: , oscillator.connect:[obj gain] , gain:gain.setValueAtTime:0.6400000000000001,0 , oscillator.start:0 , oscillator.stop:0.2 , createOscillator: , oscillator.connect:[obj gain] , gain:gain.setValueAtTime:0.6400000000000001,0 , oscillator.start:0 , oscillator.stop:0.2 -- undefined"
		},
		setToneEnv: {
			"1,3,2,2": "undefined"
		},
		setVolEnv: {
			"1,3,2,2": "undefined"
		}
	};

    const allTestFunctions: Record<string, TestFunctionType> = {
			sound: function (sound: Sound, input: TestFunctionInputType[]) {
				const soundData = {
					state: input[0],
					period: input[1],
					duration: input[2],
					volume: input[3],
					volEnv: input[4],
					toneEnv: input[5],
					noise: input[6]
				} as SoundData;

				return String(sound.sound(soundData));
			},
			setToneEnv: function (sound: Sound, input: TestFunctionInputType[]) {
				const toneEnv = input[0] as number,
					toneEnvList: ToneEnvData[] = [];

				for (let i = 1; i < input.length - 1; i += 3) {
					let toneEnvData: ToneEnvData;

					if (input[i] !== "=") {
						toneEnvData = {
							steps: input[i] as number,
							diff: input[i + 1] as number,
							time: input[i + 2] as number,
							repeat: (input[i + 2] as number) < 0
						};
					} else {
						toneEnvData = {
							period: input[i + 1] as number,
							time: input[i + 2] as number
						};
					}
					toneEnvList.push(toneEnvData);
				}
				return String(sound.setToneEnv(toneEnv, toneEnvList));
			},
			setVolEnv: function (sound: Sound, input: TestFunctionInputType[]) {
				const volEnv = input[0] as number,
					volEnvList: VolEnvData[] = [];

				for (let i = 1; i < input.length - 1; i += 3) {
					let volEnvData: VolEnvData;

					if (input[i] !== "=") {
						volEnvData = {
							steps: input[i] as number,
							diff: input[i + 1] as number,
							time: input[i + 2] as number
						};
					} else {
						volEnvData = {
							register: input[i + 1] as number,
							period: input[i + 2] as number
						};
					}
					volEnvList.push(volEnvData);
				}
				return String(sound.setVolEnv(volEnv, volEnvList));
			}
		};

	function adaptParameters(a: string[]) {
		const b = [];

		for (let i = 0; i < a.length; i += 1) {
			if (a[i].startsWith('"') && a[i].endsWith('"')) { // string in quotes?
				b.push(a[i].substring(1, 1 + a[i].length - 2)); // remove quotes
			} else if (a[i] !== "") { // non empty string => to number
				b.push(Number(a[i]));
			} else {
				b.push(undefined);
			}
		}
		return b;
	}

	function runSingleTest(testFunction: TestFunctionType, sound: Sound, key: string, expected: string, category: string) {
		clearLastTestFunctions();
		sound.reset();

		const input = key === "" ? [] : adaptParameters(key.split(","));
		let result: string;

		try {
			if (!testFunction) {
				throw new Error("Undefined testFunction: " + category);
			}
			const result0 = testFunction(sound, input);

			result = combineResult(result0);
		} catch (e) {
			result = String(e);
			result = combineResult(result);
			if (result !== expected) {
				Utils.console.error(e); // only if not expected
			}
		}

		return result;
	}

    for (const category in allTests) {
        describe(category, () => {
            const tests = allTests[category];
            const testFunction = allTestFunctions[category];
            let sound: Sound;

            beforeAll(() => {
                sound = new Sound({
                    AudioContextConstructor: AudioContextMock as unknown as typeof window.AudioContext
                });
                sound.soundOn();
                sound.setActivatedByUser();
            });

            afterAll(() => {
                sound.soundOff();
            });

            for (const key in tests) {
                if (Object.prototype.hasOwnProperty.call(tests, key)) {
                    test(key, () => {
                        const expected = tests[key];
                        const result = runSingleTest(testFunction, sound, key, expected, category);

                        expect(result).toBe(expected);
                    });
                }
            }
        });
    }
});
