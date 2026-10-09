// A deterministic, educational RV32I subset. One instruction takes six model cycles.
// Instruction storage is read-only; data memory is a separate 4 KiB region in this MVP.
export const PHASES = [
  "fetch",
  "decode",
  "read",
  "execute",
  "memory",
  "writeback",
] as const;
export type Phase = "ready" | (typeof PHASES)[number];
export type Unit = "control" | "registers" | "alu" | "memory";
export type Instruction = {
  address: number;
  line: number;
  text: string;
  op: string;
  rd: number;
  rs1: number;
  rs2: number;
  imm: number;
  word: number;
};
export type CpuState = {
  registers: number[];
  memory: number[];
  pc: number;
  phase: Phase;
  cycle: number;
  retired: number;
  halted: boolean;
  reason: string;
  a: number;
  b: number;
  result: number;
  operation: string;
  nextPc: number;
  address: number | null;
  writeRegister: number | null;
  active: Unit[];
  message: string;
  current: Instruction | null;
};
export type Snapshot = Omit<CpuState, "memory"> & {
  memory: { address: number; value: number }[];
  program: Instruction[];
  canBack: boolean;
};

const R_OPS = [
  "add",
  "sub",
  "and",
  "or",
  "xor",
  "sll",
  "srl",
  "sra",
  "slt",
  "sltu",
];
const I_OPS = [
  "addi",
  "andi",
  "ori",
  "xori",
  "slli",
  "srli",
  "srai",
  "slti",
  "sltiu",
];
const BRANCHES = ["beq", "bne", "blt", "bge", "bltu", "bgeu"];
const aliases: Record<string, number> = {
  zero: 0,
  ra: 1,
  sp: 2,
  gp: 3,
  tp: 4,
  t0: 5,
  t1: 6,
  t2: 7,
  s0: 8,
  fp: 8,
  s1: 9,
  a0: 10,
  a1: 11,
  a2: 12,
  a3: 13,
  a4: 14,
  a5: 15,
  a6: 16,
  a7: 17,
  s2: 18,
  s3: 19,
  s4: 20,
  s5: 21,
  s6: 22,
  s7: 23,
  s8: 24,
  s9: 25,
  s10: 26,
  s11: 27,
  t3: 28,
  t4: 29,
  t5: 30,
  t6: 31,
};
function register(token: string): number {
  const value = token.toLowerCase();
  if (/^x(?:[0-9]|[12][0-9]|3[01])$/.test(value)) return Number(value.slice(1));
  if (value in aliases) return aliases[value];
  throw new Error(
    `Registro desconocido: ${token}. Usa x0–x31 o un alias RISC-V.`,
  );
}
function integer(token: string): number {
  if (!/^-?(?:0x[0-9a-f]+|0b[01]+|\d+)$/i.test(token))
    throw new Error(`Número no válido: ${token}.`);
  const n = token.startsWith("-") ? -Number(token.slice(1)) : Number(token);
  if (!Number.isSafeInteger(n))
    throw new Error("El número está fuera de rango.");
  return n;
}
function range(n: number, min: number, max: number): number {
  if (n < min || n > max)
    throw new Error(`Inmediato fuera de rango (${min}…${max}).`);
  return n;
}
function encode(i: Instruction): number {
  const { op, rd, rs1, rs2, imm } = i;
  const f3: Record<string, number> = {
    add: 0,
    sub: 0,
    sll: 1,
    slt: 2,
    sltu: 3,
    xor: 4,
    srl: 5,
    sra: 5,
    or: 6,
    and: 7,
    addi: 0,
    slli: 1,
    slti: 2,
    sltiu: 3,
    xori: 4,
    srli: 5,
    srai: 5,
    ori: 6,
    andi: 7,
    beq: 0,
    bne: 1,
    blt: 4,
    bge: 5,
    bltu: 6,
    bgeu: 7,
  };
  if (R_OPS.includes(op))
    return (
      (((op === "sub" || op === "sra" ? 0x20 : 0) << 25) |
        (rs2 << 20) |
        (rs1 << 15) |
        (f3[op] << 12) |
        (rd << 7) |
        0x33) >>>
      0
    );
  if (I_OPS.includes(op) || op === "lw" || op === "jalr") {
    const immediate = op === "srai" ? imm | 0x400 : imm;
    return (
      (((immediate & 0xfff) << 20) |
        (rs1 << 15) |
        ((op === "lw" ? 2 : (f3[op] ?? 0)) << 12) |
        (rd << 7) |
        (op === "lw" ? 3 : op === "jalr" ? 0x67 : 0x13)) >>>
      0
    );
  }
  if (op === "sw")
    return (
      (((imm & 0xfe0) << 20) |
        (rs2 << 20) |
        (rs1 << 15) |
        (2 << 12) |
        ((imm & 31) << 7) |
        0x23) >>>
      0
    );
  if (BRANCHES.includes(op))
    return (
      ((((imm >> 12) & 1) << 31) |
        (((imm >> 5) & 63) << 25) |
        (rs2 << 20) |
        (rs1 << 15) |
        (f3[op] << 12) |
        (((imm >> 1) & 15) << 8) |
        (((imm >> 11) & 1) << 7) |
        0x63) >>>
      0
    );
  if (op === "lui" || op === "auipc")
    return ((imm << 12) | (rd << 7) | (op === "lui" ? 0x37 : 0x17)) >>> 0;
  if (op === "jal")
    return (
      ((((imm >> 20) & 1) << 31) |
        (((imm >> 1) & 1023) << 21) |
        (((imm >> 11) & 1) << 20) |
        (((imm >> 12) & 255) << 12) |
        (rd << 7) |
        0x6f) >>>
      0
    );
  return 0x00100073; // EBREAK
}

export function assemble(source: string): Instruction[] {
  if (source.length > 32000)
    throw new Error("El programa supera el límite de 32 KB de texto.");
  const labels = new Map<string, number>();
  const lines: { text: string; line: number }[] = [];
  for (const [index, raw] of source.split("\n").entries()) {
    let text = raw.replace(/[#;].*$/, "").trim();
    const label = text.match(/^([a-zA-Z_]\w*):/);
    if (label) {
      if (labels.has(label[1]))
        throw new Error(
          `Línea ${index + 1}: etiqueta duplicada «${label[1]}».`,
        );
      labels.set(label[1], lines.length * 4);
      text = text.slice(label[0].length).trim();
    }
    if (text) lines.push({ text, line: index + 1 });
  }
  if (!lines.length) throw new Error("Escribe al menos una instrucción.");
  if (lines.length > 512)
    throw new Error("Máximo 512 instrucciones en este prototipo.");
  return lines.map(({ text, line }, index) => {
    try {
      const tokens = text.replace(/,/g, " ").split(/\s+/);
      let op = tokens.shift()!.toLowerCase();
      let args = tokens;
      const original = text;
      if (op === "li") {
        op = "addi";
        args = [args[0], "x0", ...args.slice(1)];
      }
      if (op === "mv") {
        op = "addi";
        args = [...args, "0"];
      }
      if (op === "nop" && !args.length) {
        op = "addi";
        args = ["x0", "x0", "0"];
      }
      if (op === "j") {
        op = "jal";
        args = ["x0", ...args];
      }
      const i: Instruction = {
        address: index * 4,
        line,
        text: original,
        op,
        rd: 0,
        rs1: 0,
        rs2: 0,
        imm: 0,
        word: 0,
      };
      const count = (n: number) => {
        if (args.length !== n)
          throw new Error(`${op.toUpperCase()} necesita ${n} operandos.`);
      };
      const offset = (arg: string, min: number, max: number) => {
        const n = range(
          labels.has(arg) ? labels.get(arg)! - i.address : integer(arg),
          min,
          max,
        );
        if (n % 2)
          throw new Error("El desplazamiento de salto debe ser múltiplo de 2.");
        return n;
      };
      if (R_OPS.includes(op)) {
        count(3);
        [i.rd, i.rs1, i.rs2] = args.map(register);
      } else if (I_OPS.includes(op)) {
        count(3);
        i.rd = register(args[0]);
        i.rs1 = register(args[1]);
        i.imm = range(
          integer(args[2]),
          ["slli", "srli", "srai"].includes(op) ? 0 : -2048,
          ["slli", "srli", "srai"].includes(op) ? 31 : 2047,
        );
      } else if (op === "lw" || op === "sw" || op === "jalr") {
        count(2);
        const match = args[1].match(/^([^()]+)\(([^()]+)\)$/);
        if (!match)
          throw new Error("Usa desplazamiento(registro), por ejemplo 256(x0).");
        if (op === "sw") i.rs2 = register(args[0]);
        else i.rd = register(args[0]);
        i.rs1 = register(match[2]);
        i.imm = range(integer(match[1]), -2048, 2047);
      } else if (BRANCHES.includes(op)) {
        count(3);
        i.rs1 = register(args[0]);
        i.rs2 = register(args[1]);
        i.imm = offset(args[2], -4096, 4094);
      } else if (op === "jal") {
        count(2);
        i.rd = register(args[0]);
        i.imm = offset(args[1], -1048576, 1048574);
      } else if (op === "lui" || op === "auipc") {
        count(2);
        i.rd = register(args[0]);
        i.imm = range(integer(args[1]), 0, 0xfffff);
      } else if (op === "ebreak") {
        count(0);
      } else
        throw new Error(
          `Instrucción no disponible: ${op}. Consulta la guía del MVP.`,
        );
      i.word = encode(i);
      return i;
    } catch (error) {
      throw new Error(`Línea ${line}: ${(error as Error).message}`);
    }
  });
}

export class CPU {
  program: Instruction[];
  state: CpuState;
  history: CpuState[] = [];
  constructor(source: string) {
    this.program = assemble(source);
    this.state = {
      registers: Array(32).fill(0),
      memory: Array(1024).fill(0),
      pc: 0,
      phase: "ready",
      cycle: 0,
      retired: 0,
      halted: false,
      reason: "",
      a: 0,
      b: 0,
      result: 0,
      operation: "ADD",
      nextPc: 4,
      address: null,
      writeRegister: null,
      active: [],
      message: "Programa cargado. La ciudad está lista.",
      current: null,
    };
  }
  snapshot(): Snapshot {
    const { memory, ...rest } = this.state;
    const start =
      this.state.address === null
        ? 256
        : Math.min(4064, Math.floor(this.state.address / 32) * 32);
    return {
      ...structuredClone(rest),
      memory: Array.from({ length: 8 }, (_, i) => ({
        address: start + i * 4,
        value: memory[(start >>> 2) + i] ?? 0,
      })),
      program: this.program,
      canBack: this.history.length > 0,
    };
  }
  back(): void {
    const previous = this.history.pop();
    if (previous) this.state = previous;
  }
  step(): void {
    const s = this.state;
    if (s.halted) return;
    this.history.push(structuredClone(s));
    if (this.history.length > 128) this.history.shift();
    s.writeRegister = null;
    try {
      if (s.phase === "ready" || s.phase === "writeback") {
        if (s.pc % 4 || s.pc / 4 >= this.program.length) {
          if (s.pc === this.program.length * 4) {
            s.halted = true;
            s.reason = "Fin del programa";
            s.active = [];
            s.message = "Todas las instrucciones han terminado.";
            return;
          }
          throw new Error(
            "Destino fuera del programa o no alineado a 4 bytes.",
          );
        }
        s.current = this.program[s.pc / 4];
        s.phase = "fetch";
        s.active = ["control"];
        s.address = null;
        s.nextPc = (s.pc + 4) >>> 0;
        s.message = `El PC selecciona la instrucción en ${hex(s.pc)}: ${s.current.text}.`;
      } else if (s.phase === "fetch") {
        s.phase = "decode";
        s.active = ["control"];
        s.message = `El decodificador interpreta ${hex(s.current!.word)} como ${s.current!.op.toUpperCase()}.`;
      } else if (s.phase === "decode") {
        const i = s.current!;
        s.phase = "read";
        s.active = ["registers"];
        s.a = s.registers[i.rs1];
        s.b =
          I_OPS.includes(i.op) || ["lw", "sw", "jalr"].includes(i.op)
            ? i.imm >>> 0
            : s.registers[i.rs2];
        if (i.op === "lui") {
          s.a = 0;
          s.b = (i.imm << 12) >>> 0;
        }
        if (i.op === "auipc") {
          s.a = s.pc;
          s.b = (i.imm << 12) >>> 0;
        }
        if (i.op === "jal") {
          s.a = s.pc;
          s.b = i.imm >>> 0;
        }
        s.operation = operation(i.op);
        s.message =
          i.op === "ebreak"
            ? "EBREAK solicita detener el programa."
            : `Operandos preparados: A = ${s.a >>> 0}, B = ${s.b >>> 0}.`;
      } else if (s.phase === "read") {
        s.phase = "execute";
        s.active = ["alu"];
        this.execute();
      } else if (s.phase === "execute") {
        s.phase = "memory";
        const i = s.current!;
        if (i.op === "lw" || i.op === "sw") {
          s.active = ["memory"];
          if (s.address! % 4)
            throw new Error("Acceso a memoria no alineado a 4 bytes.");
          if (s.address! > 4092)
            throw new Error("Acceso fuera de los 4 KiB de memoria de datos.");
          if (i.op === "lw") {
            s.result = s.memory[s.address! >>> 2];
            s.message = `RAM entrega ${s.result} desde ${hex(s.address!)}.`;
          } else {
            s.memory[s.address! >>> 2] = s.registers[i.rs2];
            s.message = `RAM guarda ${s.registers[i.rs2]} en ${hex(s.address!)}.`;
          }
        } else {
          s.active = [];
          s.message =
            "Esta instrucción no necesita acceder a la memoria de datos.";
        }
      } else {
        const i = s.current!;
        if (s.nextPc % 4)
          throw new Error("El destino del salto no está alineado a 4 bytes.");
        s.phase = "writeback";
        s.active = ["registers", "control"];
        if (
          !BRANCHES.includes(i.op) &&
          !["sw", "ebreak"].includes(i.op) &&
          i.rd !== 0
        ) {
          s.registers[i.rd] =
            (i.op === "jal" || i.op === "jalr" ? s.pc + 4 : s.result) >>> 0;
          s.writeRegister = i.rd;
        }
        s.registers[0] = 0;
        s.pc = s.nextPc;
        s.retired++;
        s.message =
          s.writeRegister === null
            ? `Instrucción completada. PC → ${hex(s.pc)}.`
            : `x${i.rd} ← ${s.registers[i.rd]}. PC → ${hex(s.pc)}.`;
        if (i.op === "ebreak") {
          s.halted = true;
          s.reason = "EBREAK";
          s.active = [];
          s.message = "EBREAK alcanzado. Ejecución completada.";
        } else if (s.pc === this.program.length * 4) {
          s.halted = true;
          s.reason = "Fin del programa";
        }
      }
      s.cycle++;
    } catch (error) {
      s.halted = true;
      s.reason = "Error";
      s.active = [];
      s.message = (error as Error).message;
    }
  }
  stepInstruction(): void {
    const retired = this.state.retired;
    while (!this.state.halted && this.state.retired === retired) this.step();
  }
  private execute(): void {
    const s = this.state,
      i = s.current!,
      a = s.a,
      b = s.b;
    switch (s.operation) {
      case "SUB":
        s.result = (a - b) >>> 0;
        break;
      case "AND":
        s.result = (a & b) >>> 0;
        break;
      case "OR":
        s.result = (a | b) >>> 0;
        break;
      case "XOR":
        s.result = (a ^ b) >>> 0;
        break;
      case "SLL":
        s.result = (a << (b & 31)) >>> 0;
        break;
      case "SRL":
        s.result = a >>> (b & 31);
        break;
      case "SRA":
        s.result = ((a | 0) >> (b & 31)) >>> 0;
        break;
      case "SLT":
        s.result = Number((a | 0) < (b | 0));
        break;
      case "SLTU":
        s.result = Number(a < b);
        break;
      default:
        s.result = (a + b) >>> 0;
    }
    if (i.op === "lw" || i.op === "sw") s.address = s.result;
    if (BRANCHES.includes(i.op)) {
      const take =
        i.op === "beq"
          ? a === b
          : i.op === "bne"
            ? a !== b
            : i.op === "blt"
              ? (a | 0) < (b | 0)
              : i.op === "bge"
                ? (a | 0) >= (b | 0)
                : i.op === "bltu"
                  ? a < b
                  : a >= b;
      if (take) s.nextPc = (s.pc + i.imm) >>> 0;
      s.message = `${i.op.toUpperCase()}: condición ${take ? "verdadera, salto a " + hex(s.nextPc) : "falsa, continúa el programa"}.`;
    } else if (i.op === "jal" || i.op === "jalr") {
      s.nextPc = (i.op === "jalr" ? s.result & ~1 : s.result) >>> 0;
      s.message = `Salto a ${hex(s.nextPc)}; dirección de retorno ${hex(s.pc + 4)}.`;
    } else
      s.message =
        i.op === "ebreak"
          ? "La unidad de control prepara la parada."
          : `${s.operation}: ${a} y ${b} → ${s.result}.`;
  }
}

function operation(op: string): string {
  if (BRANCHES.includes(op)) return "SUB";
  if (["lw", "sw", "jal", "jalr", "lui", "auipc", "ebreak"].includes(op))
    return "ADD";
  return (
    op.endsWith("i") ? op.slice(0, -1) : op === "sltiu" ? "sltu" : op
  ).toUpperCase();
}
export function hex(value: number): string {
  return "0x" + (value >>> 0).toString(16).padStart(8, "0").toUpperCase();
}
export function adderBits(a: number, b: number, subtract = false) {
  let carry = subtract ? 1 : 0;
  return Array.from({ length: 32 }, (_, index) => {
    const bitA = (a >>> index) & 1,
      bitB = ((b >>> index) & 1) ^ Number(subtract);
    const cin = carry,
      propagate = bitA ^ bitB,
      generate = bitA & bitB;
    const sum = propagate ^ cin;
    carry = generate | (propagate & cin);
    return {
      index,
      a: bitA,
      b: bitB,
      cin,
      propagate,
      generate,
      sum,
      cout: carry,
    };
  });
}

export const EXAMPLES = {
  sum: {
    title: "01 · Una suma en la ciudad",
    file: "suma.asm",
    source:
      "# Dos valores. Un encuentro en la ALU.\n\naddi x1, x0, 5    # A = 5\naddi x2, x0, 3    # B = 3\nadd  x3, x1, x2   # 5 + 3 = 8\nsw   x3, 256(x0)  # Guardar en RAM\nebreak           # Fin del programa",
  },
  loop: {
    title: "02 · Un bucle, cinco vueltas",
    file: "bucle.asm",
    source:
      "# Acumula 1 + 2 + 3 + 4 + 5\n\naddi x1, x0, 5\naddi x2, x0, 0\nbucle:\nadd  x2, x2, x1\naddi x1, x1, -1\nbne  x1, x0, bucle\nsw   x2, 256(x0)\nebreak",
  },
  bits: {
    title: "03 · El lenguaje de los bits",
    file: "bits.asm",
    source:
      "# Máscaras y desplazamientos\n\naddi x1, x0, 12   # 1100\naddi x2, x0, 10   # 1010\nand  x3, x1, x2   # 1000\nxor  x4, x1, x2   # 0110\nslli x5, x3, 1    # 10000\nsw   x5, 256(x0)\nebreak",
  },
  memory: {
    title: "04 · Un viaje a la memoria",
    file: "memoria.asm",
    source:
      "# Escribir, recuperar, transformar\n\naddi x1, x0, 42\nsw   x1, 256(x0)\nlw   x2, 256(x0)\naddi x3, x2, 8\nsw   x3, 260(x0)\nebreak",
  },
};
