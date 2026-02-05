
import { describe, test, expect } from 'vitest';
import { Variables } from '../../src/Variables';

describe("Variables", () => {
	test("create class", () => {
		const variables = new Variables({});
		expect(variables).toBeTruthy();
	});

	test("variable types", () => {
		const variables = new Variables({});

		variables.setVarType("a1", "I");
		expect(variables.getVarType("a1")).toBe("I");

		variables.setVarType("a2", "R");
		expect(variables.getVarType("a2")).toBe("R");

		variables.setVarType("s1", "$");
		expect(variables.getVarType("s1")).toBe("$");

		variables.setVarType("s$", "$");
		expect(variables.getVarType("s$")).toBe("$");

		expect(variables.getAllVarTypes()).toEqual({
			a1: "I",
			a2: "R",
			s1: "$",
			s$: "$"
		});
	});

	test("plain variables: get and set", () => {
		const variables = new Variables({});

		expect(variables.getAllVariables()).toEqual({});

		expect(variables.getVariable("n1")).toBeUndefined();

		variables.setVariable("a1", 11);
		expect(variables.getVariable("a1")).toBe(11);

		variables.setVariable("s$", "12");
		expect(variables.getVariable("s$")).toBe("12");

		expect(variables.getAllVariables()).toEqual({
			a1: 11,
			s$: "12"
		});

		expect(variables.variableExist("a1")).toBe(true);
		expect(variables.variableExist("s$")).toBe(true);
		expect(variables.variableExist("n1")).toBe(false);

		expect(variables.getVariableIndex("a1")).toBe(0);
		expect(variables.getVariableIndex("s$")).toBe(1);
		expect(variables.getVariableIndex("n1")).toBe(-1);

		expect(variables.getVariableByIndex(0)).toBe(11);
		expect(variables.getVariableByIndex(1)).toBe("12");
		expect(variables.getVariableByIndex(2)).toBeUndefined();

		expect(variables.getAllVariableNames()).toEqual(["a1", "s$"]);

		variables.initVariable("i1");
		expect(variables.getVariable("i1")).toBe(0);
		variables.initVariable("i$");
		expect(variables.getVariable("i$")).toBe("");

variables.initAllVariables();

		expect(variables.getAllVariables()).toEqual({
			a1: 0,
			s$: "",
			i1: 0,
			i$: ""
		});

		variables.removeAllVariables();
		expect(variables.getAllVariables()).toEqual({});
	});

function createListOfItems<T>(item: T, length: number): T[] {
		return new Array(length).fill(item);
	}

	function createListOfListWithZeros(count: number, count2: number): number[][] {
		return Array.from({ length: count }, () => createListOfItems<number>(0, count2));
	}

	test("array variables", () => {
		const variables = new Variables({});

		expect(variables.getAllVariables()).toEqual({});

		const zeros11 = createListOfItems<number>(0, 11);

		variables.initVariable("a1A");
		expect(variables.getVariable("a1A")).toEqual(zeros11);

		variables.initVariable("sA$");
		expect(variables.getVariable("sA$")).toEqual(["", "", "", "", "", "", "", "", "", "", ""]);

		const zero11x11 = createListOfListWithZeros(11, 11);

		variables.initVariable("bAA");
		expect(variables.getVariable("bAA")).toEqual(zero11x11);

		const zero11x11x11 = [];

		for (let i = 0; i < 11; i += 1) {
			zero11x11x11.push(createListOfListWithZeros(11, 11));
		}

		variables.initVariable("bAAA");
		expect(variables.getVariable("bAAA")).toEqual(zero11x11x11);

		const zero2x5 = createListOfListWithZeros(2, 5);

		variables.dimVariable("cAA", [2, 5]);

		expect(variables.getVariable("cAA")).toEqual(zero2x5);
	});
});

describe("Variables: determineStaticVarType", () => {
	/* eslint-disable quote-props */
	const allTests: Record<string, Record<string, string>> = {
		determineStaticVarType: {
			"a": "a",
			"aI": "aI",
			"aR": "aR",
			"a$": "a$",
			"abcI": "aI",
			"bcR": "bR",
			"z7$": "z$",
			"aAI[b]": "aI",
			"_a": "a",
			"v.a": "a",
			"v.aI": "aI",
			"v.aR": "aR",
			"v.a$": "a$",
			'v["a" + t.a]': "a",
			'v["aA" + t.a][b]': "a"
		}
	};
	/* eslint-enable quote-props */

	const category = "determineStaticVarType";
	const tests = allTests[category];

	for (const key in tests) {
		if (tests.hasOwnProperty(key)) {
			const expected = tests[key];
			test(`${key} -> ${expected}`, () => {
				const variables = new Variables({});
				const result = variables.determineStaticVarType(key);
				expect(result).toBe(expected);
			});
		}
	}
});
