// UiModel.ts
// (c) Marco Vieth, 2019
// https://benchmarko.github.io/cpclocots/

import { Utils, Model, ModelPropID, ICpcVmRsx, DatabaseEntry, ExampleEntry } from "cpclocots"; // Assuming imports will be resolved from library

export type DatabasesType = Record<string, DatabaseEntry>;
type ExamplesType = Record<string, Record<string, ExampleEntry>>;

export class UiModel {
    private readonly model: Model;
    private databases: DatabasesType;
    private examples: ExamplesType;

    constructor(model: Model) {
        this.model = model;
        this.databases = {};
        this.examples = {};
    }

    addDatabases(db: DatabasesType): void {
        for (const par in db) {
            if (db.hasOwnProperty(par)) {
                const entry = db[par];

                this.databases[par] = entry;
                this.examples[par] = {};
            }
        }
    }

    getAllDatabases(): DatabasesType {
        return this.databases;
    }

    getDatabase(): DatabaseEntry {
        const database = this.model.getProperty<string>(ModelPropID.database);
        return this.databases[database];
    }

    getAllExamples(): { [x: string]: ExampleEntry; } {
        const database = this.model.getProperty<string>(ModelPropID.database);
        return this.examples[database];
    }

    getExample(key: string): ExampleEntry {
        const database = this.model.getProperty<string>(ModelPropID.database);
        return this.examples[database][key];
    }

    setExample(example: ExampleEntry): void {
        const database = this.model.getProperty<string>(ModelPropID.database),
            key = example.key;

        if (!this.examples[database][key]) {
            if (Utils.debug > 1) {
                Utils.console.debug("setExample: creating new example:", key);
            }
        }
        this.examples[database][key] = example;
    }

    removeExample(key: string): void {
        const database = this.model.getProperty<string>(ModelPropID.database);

        if (!this.examples[database][key]) {
            Utils.console.warn("removeExample: example does not exist: " + key);
        }
        delete this.examples[database][key];
    }

    getProperty<T>(property: ModelPropID): T {
        return this.model.getProperty<T>(property);
    }

    setProperty<T>(property: ModelPropID, value: T): void {
        this.model.setProperty(property, value);
    }

    getChangedProperties() {
        return this.model.getChangedProperties();
    }
}
