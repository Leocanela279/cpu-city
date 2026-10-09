import type { Unit } from "./cpu.ts";

// Kept outside city.ts so the interface can use it without pulling Three.js
// into the initial bundle.
export const UNITS: Record<
  Unit,
  {
    name: string;
    subtitle: string;
    color: string;
    position: [number, number, number];
  }
> = {
  control: {
    name: "Control",
    subtitle: "Decodificador",
    color: "#b9b7e4",
    position: [-5, 7, -10],
  },
  registers: {
    name: "Registros",
    subtitle: "32 × 32 bits",
    color: "#9fcdbb",
    position: [-10, 4, 2],
  },
  alu: {
    name: "ALU",
    subtitle: "Unidad de cálculo",
    color: "#d8ad73",
    position: [1, 6, 0],
  },
  memory: {
    name: "Memoria",
    subtitle: "4 KiB · datos",
    color: "#87b9ce",
    position: [11, 4.5, 5],
  },
};
