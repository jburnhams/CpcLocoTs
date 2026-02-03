/* cpcconfig.ts - configuration file for cpclocots */

export const cpcconfig = { // eslint-disable-line no-unused-vars
	databaseDirs: "./examples,https://benchmarko.github.io/CpcLocoApps/apps,https://benchmarko.github.io/LocoBasic/examples=locobasic,https://benchmarko.github.io/CpcLocoApps/rosetta,storage",
	//databaseDirs: "./examples,../../CpcLocoApps/apps,../../LocoBasic/dist/examples=locobasic,../../CpcLocoApps/rosetta,storage", // local test

	// just an example, not the full list of moved examples...
	redirectExamples: {
		"examples/art": {
			database: "apps",
			example: "demo/art"
		},
		"examples/blkedit": {
			database: "apps",
			example: "apps/blkedit"
		}
	}
};



