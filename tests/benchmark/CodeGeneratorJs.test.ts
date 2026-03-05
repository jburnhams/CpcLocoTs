
import { describe, test } from 'vitest';
import { BasicLexer } from "../../src/BasicLexer";
import { BasicParser } from "../../src/BasicParser";
import { CodeGeneratorJs } from "../../src/CodeGeneratorJs";
import { Variables } from "../../src/Variables";

const prg = `100 'Das Raetsel
110 '21.5.1988 Kopf um Kopf
120 'ab*c=de  de+fg=hi   [dabei sind a-i verschiedene Ziffern 1-9!!]
130 MODE 1:PRINT"Please wait ...  ( ca. 1 min 34 sec )"
140 CLEAR:DEFINT a-y
150 '
155 z=TIME
160 FOR a=1 TO 9:FOR b=1 TO 9:FOR c=1 TO 9:FOR f=1 TO 9:FOR g=1 TO 9
170 de=(a*10+b)*c:IF de>99 THEN 320
180 hi=de+(f*10+g):IF hi>99 THEN 320
190 d=INT(de/10):e=de MOD 10:h=INT(hi/10):i=hi MOD 10
200 IF a=b OR a=c OR a=d OR a=e OR a=f OR a=g OR a=h OR a=i THEN 320
210 IF b=c OR b=d OR b=e OR b=f OR b=g OR b=h OR b=i THEN 320
220 IF c=d OR c=e OR c=f OR c=g OR c=h OR c=i THEN 320
230 IF d=e OR d=f OR d=g OR d=h OR d=i THEN 320
240 IF e=f OR e=g OR e=h OR e=i THEN 320
250 IF f=g OR f=h OR f=i THEN 320
260 IF g=h OR g=i THEN 320
270 IF h=i THEN 320
280 IF i=0 THEN 320
285 z=TIME-z
290 CLS:PRINT"Die Loesung:":PRINT
300 PRINT a*10+b"*"c"="de" / "de"+"f*10+g"="hi
310 PRINT z,z/300:STOP
320 NEXT g,f,c,b,a
`;

const basicParser = new BasicParser({ quiet: true });
const lexer = new BasicLexer({
    keywords: basicParser.getKeywords(),
    quiet: true
});

const codeGeneratorJs = new CodeGeneratorJs({
    lexer: lexer,
    parser: basicParser,
    quiet: true
});

const variables = new Variables({});

describe('CodeGeneratorJs Micro-benchmark', () => {
  test('measure generate PRG', () => {
    const iterations = 1000;
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
        codeGeneratorJs.generate(prg, variables);
    }
    const end = performance.now();
    console.log(`CodeGeneratorJs.generate took ${(end - start).toFixed(2)}ms for ${iterations} iterations (${((end - start) / iterations).toFixed(4)}ms per iteration)`);
  });
});
