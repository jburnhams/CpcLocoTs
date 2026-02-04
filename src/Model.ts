// Model.ts - Model (MVC)
// (c) Marco Vieth, 2019
// https://benchmarko.github.io/cpclocots/

import { ModelPropID } from "./Constants";
import { ICpcVmRsx } from "./Interfaces";

export type ConfigEntryType = string | number | boolean;

export type ConfigType = Record<string, ConfigEntryType>;

export interface DatabaseEntry {
	text: string
	title: string
	src: string
	script?: string
	loaded?: boolean
}

export interface ExampleEntry {
	key: string
	title: string
	meta: string // D=data
	script?: string
	rsx?: ICpcVmRsx
	loaded?: boolean
}

export class Model {
	private config: ConfigType;
	private initialConfig: ConfigType;

	constructor(config: ConfigType) {
		this.config = config || {}; // store only a reference
		this.initialConfig = Object.assign({}, this.config); // save initial config
	}

	getProperty<T extends ConfigEntryType>(property: ModelPropID): T {
		return this.config[property] as T;
	}
	setProperty<T extends ConfigEntryType>(property: ModelPropID, value: T): void {
		this.config[property] = value;
	}
	getAllProperties(): ConfigType {
		return this.config;
	}
	getAllInitialProperties(): ConfigType {
		return this.initialConfig;
	}

	getChangedProperties(): ConfigType {
		const current = this.config,
			initial = this.initialConfig,
			changed: ConfigType = {};

		for (const name in current) {
			if (current.hasOwnProperty(name)) {
				if (current[name] !== initial[name]) {
					changed[name] = current[name];
				}
			}
		}
		return changed;
	}
}
