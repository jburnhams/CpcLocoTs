import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcDir = path.resolve(__dirname, '../basic');
const destDir = path.resolve(__dirname, '../docs/public/basic');

if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
}

const files = fs.readdirSync(srcDir);
const examples = [];

files.forEach(file => {
    if (path.extname(file).toLowerCase() === '.bas') {
        const basename = path.basename(file, '.BAS'); // Assuming uppercase extension based on ls output, but handling case insensitivity is safer
        const key = basename.toLowerCase();
        const content = fs.readFileSync(path.join(srcDir, file), 'utf8');

        // Wrap content in CpcLoco.addItem
        const jsContent = `/* globals CpcLoco */
"use strict";

CpcLoco.addItem("${key}", function () { /*
${content}
*/ });
`;

        fs.writeFileSync(path.join(destDir, `${key}.js`), jsContent);

        examples.push({
            key: key,
            title: basename,
            meta: "B" // Metadata type for Basic? checking existing examples. 1st.js has no meta. cpcbasic.js has no meta. 0index.js for cpcbasic has no meta. 
            // 0index.js for test/testpage.dat has "meta": "D". 
            // Let's omit meta or use "B" if it helps. Re-checking 0index.js...
            // "title": "First Program (empty)" -> no meta
            // "title": "CPC Basic TS" -> no meta
        });
        console.log(`Processed ${file} -> ${key}.js`);
    }
});

// Generate 0index.js
const indexContent = `/* 0index.js - index file for BASIC examples */
/* globals CpcLoco */
/* eslint-disable quote-props, strict */

"use strict";

CpcLoco.addItem("", function () { /*
*/ }); // Some index files have this? No, checked 0index.js in examples. It has CpcLoco.addIndex.

CpcLoco.addIndex("./basic", {
	"examples": ${JSON.stringify(examples, null, '\t')}
});
`;

// Wait, the index file I saw (examples/0index.js) uses CpcLoco.addIndex.
// Let's match that format.

const indexJsContent = `/* 0index.js - index file for BASIC examples */
/* globals CpcLoco */
/* eslint-disable quote-props, strict */

"use strict";

CpcLoco.addIndex("./basic", {
	"examples": ${JSON.stringify(examples, null, '\t')}
});
`;

fs.writeFileSync(path.join(destDir, '0index.js'), indexJsContent);
console.log(`Generated 0index.js with ${examples.length} examples.`);
