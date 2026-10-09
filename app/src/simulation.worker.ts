import { CPU } from "./cpu.ts";

let cpu: CPU | null = null;
self.onmessage = (event: MessageEvent<{ type: string; source?: string }>) => {
  try {
    const { type, source } = event.data;
    if (type === "load") cpu = new CPU(source!);
    if (!cpu) return;
    if (type === "step") cpu.step();
    if (type === "instruction") cpu.stepInstruction();
    if (type === "back") cpu.back();
    self.postMessage({ type: "state", state: cpu.snapshot() });
  } catch (error) {
    self.postMessage({ type: "error", message: (error as Error).message });
  }
};
