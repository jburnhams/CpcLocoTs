// Model.test.ts - Vitest tests for CpcLoco Model

import { describe, test, expect, beforeEach } from 'vitest';
import { ModelPropID } from "../../src/Constants";
import { Model } from "../../src/Model";

describe("Model: Properties", () => {
	const context = {} as { model: Model };

	function convId(id: string) {
		return id as ModelPropID;
	}

	beforeEach(() => {
		const config = {
			p1: "v1"
		};

		context.model = new Model(config);
	});

	test("init without options", () => {
		const model = new Model({});

		expect(model).toBeTruthy();
	});

	test("properties", () => {
		const model = context.model,
			prop1 = convId("p1"),
			prop2 = convId("p2"),
			prop3 = convId("p3");

		context.model.setProperty(prop2, "v2");

		let allProperties = model.getAllInitialProperties();

		expect(Object.keys(allProperties).join(" ")).toBe("p1");

		expect(model.getProperty(prop1)).toBe("v1");
		expect(model.getProperty(prop2)).toBe("v2");
		expect(model.getProperty(convId(""))).toBeUndefined();

		allProperties = model.getAllProperties();
		expect(Object.keys(allProperties).join(" ")).toBe("p1 p2");
		expect(allProperties.p1).toBe("v1");
		expect(allProperties.p2).toBe("v2");

		model.setProperty(prop1, "v1.2");
		expect(model.getProperty(prop1)).toBe("v1.2");

		model.setProperty(prop3, "v3");
		expect(model.getProperty(prop3)).toBe("v3");

		allProperties = model.getAllProperties();
		expect(Object.keys(allProperties).join(" ")).toBe("p1 p2 p3");

		allProperties = model.getAllInitialProperties();
		expect(Object.keys(allProperties).join(" ")).toBe("p1");
	});
});


