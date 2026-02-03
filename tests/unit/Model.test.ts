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


describe("Model: Databases", () => {
	beforeEach(() => {
		// empty
	});

	test("databases", () => {
		const model = new Model({}),
			exampleDatabases = {
				db1: {
					text: "text1",
					title: "title1",
					src: "src1"
				},
				db2: {
					text: "text1",
					title: "title2",
					src: ""
				}
			},
			databases = model.getAllDatabases();

		expect(Object.keys(databases).length).toBe(0);

		model.addDatabases(exampleDatabases);

		expect(Object.keys(databases).join(" ")).toBe("db1 db2");

		model.setProperty(ModelPropID.database, "db1");

		expect(model.getDatabase()).toBe(exampleDatabases.db1);

		model.setProperty(ModelPropID.database, "db2");

		expect(model.getDatabase()).toBe(exampleDatabases.db2);

		model.setProperty(ModelPropID.database, "");

		expect(model.getDatabase()).toBeUndefined();
	});
});


describe("Model: Examples", () => {
	const context = {} as { model: Model };

	beforeEach(() => {
		context.model = new Model({});

		const exampleDatabases = {
				db1: {
					text: "db1Text",
					title: "db1Title",
					src: "db1Src"
				},
				db2: {
					text: "db2text",
					title: "",
					src: ""
				}
			},
			example1 = {
				key: "ex1",
				title: "ex1",
				type: "",
				meta: ""
			},
			example2 = {
				key: "ex2",
				title: "ex2",
				type: "",
				meta: ""
			};

		context.model.addDatabases(exampleDatabases);
		context.model.setProperty(ModelPropID.database, "db1");
		context.model.setExample(example1);
		context.model.setExample(example2);
	});

	test("examples", () => {
		const model = context.model;

		expect(model.getExample("ex1").key).toBe("ex1");
		expect(model.getExample("ex2").key).toBe("ex2");

		expect(Object.keys(model.getAllExamples()).join()).toBe("ex1,ex2");
	});
});
