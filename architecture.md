# Architecture of CpcLocoTs

## Overview
CpcLocoTs is a high-level emulator and interpreter for the Amstrad CPC Locomotive BASIC 1.1 environment. Unlike traditional emulators that simulate the Z80 CPU hardware, CpcLocoTs works by **transpiling BASIC source code directly into JavaScript**, which is then executed by the browser's JavaScript engine.

This approach allows for high-performance execution of BASIC programs but trades off binary compatibility with Z80 machine code applications.

## Deep Dive: The VM and Interpreter

The architecture consists of three main pillars: the **Parser**, the **Code Generator (Compiler)**, and the **Virtual Machine (Runtime)**.

### 1. The Parser
Located in `BasicParser.ts` (and `BasicLexer.ts` for tokenization), the parser is responsible for understanding BASIC syntax.
*   **Lexer:** Breaks the raw text stream into tokens (keywords, variables, literals).
*   **Parser:** Implements a Top Down Operator Precedence (TDOP) parser to build an Abstract Syntax Tree (AST) from the tokens. It handles BASIC specificities like line numbers, optional `LET` keywords, and command syntax.

### 2. The Code Generator (Compiler)
Located in `CodeGeneratorJs.ts`, this component takes the AST produced by the parser and generates equivalent JavaScript code.
*   **State Machine for Control Flow:** Since JavaScript lacks `GOTO` (a staple of BASIC), the compiler wraps the generated code in a large `switch` statement or state machine. Line numbers become `case` labels, and `GOTO`s update a state variable (`this.line`) before `break`ing to the dispatcher.
*   **Variable Mapping:** BASIC variables (e.g., `A%`, `B$`) are mapped to properties of a managed variable object (e.g., `v.A_I`, `v.B_S`) handled by `Variables.ts`. This ensures correct type handling (Integer vs Real vs String) and array bounds checking.
*   **Operator Mapping:** BASIC operators are translated to their JS equivalents (e.g., `AND` to `&`, `OR` to `|`), with special handling for integer division and exponentiation.

### 3. The Virtual Machine (Runtime)
Located primarily in `CpcVm.ts`, the VM provides the environment in which the compiled JS code interacts. It acts as the "Standard Library" and "Hardware Abstraction Layer" for the translated BASIC.
*   **State Management:** It holds the global state of the emulated machine, including the cursor position, current ink/paper settings, and stream status.
*   **Memory Abstraction:** While there is no Z80 CPU, there is a `mem` array (in `CpcVm.ts`) exposed via `peek` and `poke` methods. This allows BASIC programs to interact with "memory" in a way that creates persistent side effects where supported (e.g., storing data), though it may not trigger hardware interrupts like a real CPC.
*   **Subsystems:**
    *   **Graphics/Text:** `Canvas.ts` implements the CPC's display modes (0, 1, 2) and pixel operations.
    *   **Sound:** `Sound.ts` uses the Web Audio API to emulate the AY-3-8912 sound chip commands (`SOUND`, `ENV`).
    *   **Input:** `Keyboard.ts` and `VirtualKeyboard.ts` buffer input for `INKEY$` and `INPUT` commands.
    *   **File System:** `RsxAmsdos.ts` and `DiskImage.ts` simulate the disc interface (AMSDOS), allowing file loading/saving via browser local storage or imported files.

## Comparison with Traditional Emulation

| Feature | CpcLocoTs (High-Level) | Traditional Z80 Emulator |
| :--- | :--- | :--- |
| **Execution Unit** | JavaScript Instruction | Z80 Opcode |
| **Speed** | **Very High** (Native JS speed) | Slower (Software decode dispatch) |
| **Compatibility** | **BASIC Only** (mostly) | 100% Binary (BASIC + Assembly) |
| **Accuracy** | Functional (Behavioral) | Cycle-Accurate (Hardware) |
| **GOTO Handling** | State machine compilation | Program Counter (PC) register |
| **Memory** | Array abstraction | Byte-addressable virtual RAM |

*   **Traditional Emulation:** Fetches a byte, decodes `0x3E` as `LD A, n`, and updates the virtual A register. Very accurate but computationally expensive per instruction.
*   **CpcLocoTs:** Translates `PRINT "HELLO"` directly to `v.print(0, "HELLO")`. The browser executes this instantly.

## Limitations and Opportunities

### Limitations
1.  **Z80 Assembly Support:** The biggest limitation is the inability to run native Z80 machine code. Games or demos using `CALL &xxxx` to jump to assembly routines will fail unless that specific address is hooked in `CpcVm.ts` or `Z80Disass.ts` (which seems to be a disassembler, not a full runner).
2.  **Hardware Tricks:** Raster interrupts, hardware scrolling tricks, and CRTC register abuse common in advanced demos cannot be emulated accurately because the rendering is abstracted to Canvas calls, not beam-synchronized pixel generation.
3.  **Timing:** `WAIT FRAME` is approximated. Code relying on precise cycle counting for visual effects will likely desynchronize.

### Opportunities for Extension
1.  **Hybrid Emulation (Fix/Extension):**
    *   **Idea:** Integrate a lightweight Z80 interpreter (like the one hinted at in `Z80Disass.ts`) to handle `CALL` instructions. When the high-level VM encounters a `CALL`, it could hand control over to the Z80 emulator until a `RET` is hit.
    *   **Benefit:** Would allow mixing BASIC with small assembly routines (common in magazine type-ins).
2.  **Performance Optimization:**
    *   **Optimization:** The "State Machine" for flow control can be slow for tight loops. Identifying "safe" blocks of BASIC (no `GOTO` targets inside) could allow compiling them into native JS `for`/`while` loops instead of the `case` dispatcher, significantly speeding up math-heavy programs.
    *   **WASM:** Moving the `Canvas` pixel manipulation to WebAssembly could speed up `PLOT`/`DRAW` commands significantly.
3.  **Modern Interop (Extension):**
    *   **Idea:** Expose more Browser APIs to the BASIC environment via new `|RSX` commands (e.g., `|FETCH` to get data from the web, or `|GPU` to access WebGL).
4.  **Language Extensions:**
    *   **Idea:** Since the parser is custom (`BasicParser.ts`), it is trivial to add new non-standard commands (e.g., `SPRITE`, `COLLISION`) that map to optimized JS functions, effectively creating a "Super BASIC" engine.
