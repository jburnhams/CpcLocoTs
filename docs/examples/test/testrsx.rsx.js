/* globals CpcLoco */

"use strict";

CpcLoco.addItem("", function () { /*
*/ });

CpcLoco.addRsx("", function () {
	return {
		getRsxCommands: function () {
			return {
				testrsx: function (s1, n1) { // define RSX name (use lower case)
					this.print(0, s1, n1);
				},
				"&a28f": function (s1, n1) { // define CALL address (use lower case)
					this.print(0, s1, n1);
				}
			};
		}
	};
});

