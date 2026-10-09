import { test } from "node:test";
import assert from "node:assert/strict";
import { CPU, assemble, adderBits, EXAMPLES } from "../src/cpu.ts";

function run(source: string) {
  const cpu = new CPU(source);
  for (let n = 0; n < 2000 && !cpu.state.halted; n++) cpu.step();
  assert.equal(cpu.state.halted, true, "program must halt");
  return cpu;
}
test("real RV32I encodings, labels and aliases", () => {
  const p = assemble(
    "addi ra, zero, 5\nadd x3, x1, x2\nsw x3, 256(x0)\nebREAK",
  );
  assert.deepEqual(
    p.map((i) => i.word),
    [0x00500093, 0x002081b3, 0x10302023, 0x00100073],
  );
  assert.equal(assemble("top: nop\nbne x1,x0,top")[1].word, 0xfe009ee3);
});
test("sum reaches registers and RAM with six-cycle instructions", () => {
  const cpu = run(EXAMPLES.sum.source);
  assert.equal(cpu.state.registers[3], 8);
  assert.equal(cpu.state.memory[64], 8);
  assert.equal(cpu.state.cycle, 30);
});
test("backwards branch executes the loop and halts", () => {
  const cpu = run(EXAMPLES.loop.source);
  assert.equal(cpu.state.registers[2], 15);
  assert.equal(cpu.state.memory[64], 15);
});
test("loads, logic and shifts", () => {
  assert.equal(run(EXAMPLES.memory.source).state.memory[65], 50);
  const cpu = run(EXAMPLES.bits.source);
  assert.deepEqual(cpu.state.registers.slice(3, 6), [8, 6, 16]);
});
test("x0 stays zero, addition wraps and shifts distinguish signed/unsigned", () => {
  const cpu = run(
    "addi x0,x0,10\naddi x1,x0,-1\naddi x2,x1,1\nsrli x3,x1,1\nsrai x4,x1,1\nsltiu x5,x0,-1",
  );
  assert.deepEqual(
    cpu.state.registers.slice(0, 6),
    [0, 0xffffffff, 0, 0x7fffffff, 0xffffffff, 1],
  );
});
test("writeback is distinct from ALU computation; back restores exact state", () => {
  const cpu = new CPU("addi x1,x0,5");
  for (let n = 0; n < 4; n++) cpu.step();
  assert.equal(cpu.state.result, 5);
  assert.equal(cpu.state.registers[1], 0);
  const before = structuredClone(cpu.state);
  cpu.step();
  cpu.back();
  assert.deepEqual(cpu.state, before);
  cpu.stepInstruction();
  assert.equal(cpu.state.registers[1], 5);
});
test("full-adder carry chain matches arithmetic, including subtraction", () => {
  for (const [a, b] of [
    [5, 3],
    [0xffffffff, 1],
    [0x80000000, 0x80000000],
    [0, 0],
    [12, 42],
  ]) {
    for (const sub of [false, true]) {
      const bits = adderBits(a, b, sub);
      const result = bits.reduce(
        (n, bit) => (n | (bit.sum << bit.index)) >>> 0,
        0,
      );
      assert.equal(result, (sub ? a - b : a + b) >>> 0);
    }
  }
});
test("invalid source and memory faults produce useful errors", () => {
  assert.throws(() => assemble("addi x32,x0,1"), /Línea 1/);
  assert.throws(() => assemble("addi x1,x0,2048"), /rango/);
  assert.throws(() => assemble("j missing"), /Número/);
  assert.throws(() => assemble("a: nop\na: nop"), /duplicada/);
  assert.equal(run("lw x1,1(x0)").state.reason, "Error");
  assert.equal(run("addi x1,x0,-4\nlw x2,0(x1)").state.reason, "Error");
  assert.equal(run("beq x0,x0,2").state.reason, "Error");
});
test("JAL/JALR preserve return address and skip instructions", () => {
  const cpu = run(
    "jal ra,target\naddi x3,x0,99\nebreak\ntarget: addi x2,x0,7\njalr x0,0(ra)",
  );
  assert.equal(cpu.state.registers[1], 4);
  assert.equal(cpu.state.registers[2], 7);
  assert.equal(cpu.state.registers[3], 99);
});
