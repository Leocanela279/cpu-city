import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-500.css";
import "@fontsource/ibm-plex-mono/latin-600.css";
import "./style.css";
import "./instrument.css";
import { UNITS } from "./units.ts";
import type { City } from "./city.ts";
import { EXAMPLES, PHASES, adderBits, hex } from "./cpu.ts";
import type { Snapshot, Unit } from "./cpu.ts";

const icons = {
  chip: '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4m6-4v4M9 18v4m6-4v4M2 9h4m-4 6h4m12-6h4m-4 6h4"/><path d="M10 10h4v4h-4z"/>',
  play: '<path d="m8 5 11 7-11 7z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  step: '<path d="m5 5 10 7L5 19zM19 5v14"/>',
  next: '<path d="m3 5 8 7-8 7zM12 5l8 7-8 7z"/>',
  back: '<path d="M5 5v14m14-14L8 12l11 7z"/>',
  reset: '<path d="M3 10a9 9 0 1 1 2 8M3 4v6h6"/>',
  code: '<path d="m8 6-6 6 6 6m8-12 6 6-6 6m-3-15-2 18"/>',
  city: '<path d="M3 21V10h6v11m0-16h7v16m0-8h5v8M1 21h22M12 8h1m-1 4h1m-1 4h1M5 13h1m-1 4h1"/>',
  circuit:
    '<path d="M3 5h6v6m-6 8h6v-6m0-5h6v8H9zM15 12h6"/><circle cx="3" cy="5" r="1"/><circle cx="3" cy="19" r="1"/><circle cx="21" cy="12" r="1"/>',
  focus:
    '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/><circle cx="12" cy="12" r="3"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 4 3c-1 .4-1 1-1 2m0 3h.01"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
};
const icon = (name: keyof typeof icons, cls = "") =>
  `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const phaseNames: Record<string, string> = {
  ready: "Preparado",
  fetch: "Buscar",
  decode: "Decodificar",
  read: "Leer",
  execute: "Ejecutar",
  memory: "Memoria",
  writeback: "Escribir",
};
const phaseShort = ["IF", "ID", "RD", "EX", "MEM", "WB"];

$("app").innerHTML = `
  <header class="topbar">
    <a class="brand" href="#" aria-label="CPU City, vista general">${icon("chip")}<span>CPU CITY</span></a>
    <nav class="view-nav" aria-label="Vistas"><button id="processor-view" class="view-tab selected" aria-pressed="true">Procesador</button><button id="city-view" class="view-tab" aria-pressed="false">Arquitectura</button><button id="circuit-view" class="view-tab" aria-pressed="false">Circuito ALU</button></nav>
    <div class="topbar-right"><button id="code-toggle" class="drawer-toggle" aria-expanded="false" aria-controls="code-sidebar">${icon("code")}<span>Código</span></button><button id="data-toggle" class="drawer-toggle" aria-expanded="false" aria-controls="data-sidebar">Datos</button><button id="guide-button" class="icon-button" title="Guía del prototipo" aria-label="Abrir guía">${icon("help")}</button></div>
  </header>
  <main class="workspace">
    <aside id="code-sidebar" class="left-sidebar" aria-label="Programa y registros">
      <section class="program-panel">
        <div class="panel-heading"><span>${icon("code")} PROGRAMA</span><span class="mini-tag">RISC-V</span></div>
        <label class="sr-only" for="example-select">Programa de ejemplo</label><div class="example-select-wrap"><select id="example-select">${Object.entries(
          EXAMPLES,
        )
          .map(([key, val]) => `<option value="${key}">${val.title}</option>`)
          .join("")}</select></div>
        <div class="filebar"><span class="file-dot"></span><span id="filename">suma.asm</span><span class="file-language">ASM</span></div>
        <div class="code-editor"><div id="line-numbers" aria-hidden="true"></div><div id="current-line" aria-hidden="true"></div><textarea id="source" aria-label="Editor de ensamblador RISC-V" spellcheck="false" autocomplete="off" autocapitalize="off" wrap="off"></textarea></div>
        <div class="editor-actions"><span id="code-status">Código cargado</span><button id="load" class="text-button">Cargar ${icon("arrow")}</button></div>
        <p id="editor-error" class="error-message" role="alert" hidden></p>
      </section>
      <section class="register-panel">
        <div class="panel-heading"><span>REGISTROS <span class="dim">/ 32</span></span><button id="register-format" class="format-button" title="Cambiar representación de registros">DEC</button></div>
        <div id="registers" class="register-grid" aria-label="Valores de los 32 registros"></div>
        <div class="register-legend"><span class="tiny-dot"></span> Último registro escrito <span class="dim">x0 = 0</span></div>
      </section>
      <div class="sidebar-bottom">RV32I · 32 registros · 32 bits</div>
    </aside>
    <section class="stage" aria-label="Exploración de la CPU">
      <div class="scene-heading"><div class="eyebrow" id="scale-label">SUPERFICIE</div><h1 id="scene-title">El procesador.</h1><p id="scene-description">Acércate para descubrir lo que ocurre dentro.</p><button id="enter-chip" class="enter-chip">Explorar el interior <span>↘</span></button></div>
      <div id="city-canvas" class="city-canvas"></div>
      <div id="scene-loading" class="scene-loading" role="status"><span class="loader" aria-hidden="true"></span><span id="loading-text">Cargando el motor 3D…</span></div>
      <div id="circuit-panel" class="circuit-panel" hidden>
        <div class="circuit-header"><div><span class="eyebrow">DENTRO DE LA ALU</span><h2 id="circuit-title">Sumador de 32 bits</h2></div><span id="circuit-operation" class="operation-tag">ADD</span></div>
        <div id="binary-operands" class="binary-operands"></div>
        <div class="bit-selector"><label for="bit-index">Inspeccionar bit <strong id="bit-number">0</strong></label><input id="bit-index" type="range" min="0" max="31" value="0"/><span>31</span></div>
        <div id="gate-visual" class="gate-visual"></div>
        <p id="gate-description" class="gate-description"></p>
        <div class="circuit-note"><span class="status-dot"></span>Puertas lógicas del modelo · valores de la operación actual</div>
      </div>
      <div class="scene-tools"><div class="scene-toggles"><button id="signals-toggle" class="tool-toggle active" aria-pressed="true"><span class="toggle-dot"></span>Señales</button><button id="labels-toggle" class="tool-toggle active" aria-pressed="true"><span class="toggle-dot"></span>Etiquetas</button></div><div class="scene-tools-right"><button id="quality-toggle" class="quality-button" title="Alternar calidad de renderizado">Calidad alta</button><button id="home-camera" class="icon-button" title="Volver al procesador" aria-label="Restablecer cámara">${icon("focus")}</button></div></div>
      <div class="camera-controls" aria-label="Controles de cámara"><button id="pan-mode" class="pan-mode" aria-pressed="false" title="Desplazar sin girar: activa y arrastra con el botón izquierdo">Desplazar</button><button id="rotate-left" title="Girar a la izquierda" aria-label="Girar a la izquierda">↶</button><button id="rotate-right" title="Girar a la derecha" aria-label="Girar a la derecha">↷</button><button id="tilt-up" title="Inclinar hacia arriba" aria-label="Inclinar hacia arriba">↑</button><button id="tilt-down" title="Inclinar hacia abajo" aria-label="Inclinar hacia abajo">↓</button><button id="zoom-out" title="Alejar" aria-label="Alejar">−</button><button id="zoom-in" title="Acercar" aria-label="Acercar">+</button><label class="sr-only" for="camera-angle">Ángulo de cámara</label><select id="camera-angle"><option value="" disabled selected>Vistas</option><option value="perspective">Perspectiva</option><option value="top">Superior</option><option value="front">Frontal</option><option value="side">Lateral</option></select></div>
      <div class="camera-help" id="camera-help">Scroll: desplazar <span>·</span> Arrastrar: girar <span>·</span> Pellizco o Ctrl + rueda: zoom</div><div class="zoom-depth" aria-hidden="true"><span>SUPERFICIE</span><div><i id="zoom-fill"></i></div><span>INTERIOR</span></div>
    </section>
    <aside id="data-sidebar" class="right-sidebar" aria-label="Inspector de componentes">
      <div class="panel-heading"><span>INSPECTOR</span><button id="close-data" class="icon-button" aria-label="Cerrar inspector">${icon("close")}</button></div>
      <div class="component-tabs" aria-label="Seleccionar componente">${(Object.keys(UNITS) as Unit[]).map((unit) => `<button data-unit="${unit}" class="component-tab ${unit === "alu" ? "selected" : ""}" aria-pressed="${unit === "alu"}">${unit === "registers" ? "REG" : unit === "control" ? "CTRL" : unit.toUpperCase()}</button>`).join("")}</div>
      <section class="inspector-main"><div class="component-symbol">${icon("chip")}</div><div class="component-kicker" id="inspector-kicker">DISTRITO DE CÁLCULO</div><h2 id="inspector-title">La ALU</h2><p id="inspector-description">Aquí los bits se convierten en resultados.</p><div id="inspector-content"></div></section>
      <section class="memory-panel"><div class="panel-heading"><span>MEMORIA DE DATOS</span><span class="dim">4 KiB</span></div><div class="memory-table-head"><span>DIRECCIÓN</span><span>VALOR · HEX</span></div><div id="memory-rows"></div></section>
      <div class="inspector-tip">${icon("help")}<span id="context-tip">Entra en la ALU para seguir la suma bit a bit.</span></div>
    </aside>
  </main>
  <section class="execution-dock" aria-label="Control de ejecución">
    <div class="execution-top"><div class="execution-title"><span class="status-dot" id="execution-dot"></span><span id="execution-state">PREPARADO</span><span class="dock-divider"></span><code id="current-instruction">Esperando primera instrucción</code></div><div class="execution-counters"><span>CICLO <b id="cycle-count">0000</b></span><span>PC <b id="pc-value">0x00000000</b></span><span>INSTR. <b id="retired-count">0</b></span></div></div>
    <div class="execution-bottom"><div class="playback"><button id="play" class="play-button">${icon("play")}<span>Ejecutar</span></button><button id="step" class="icon-button" title="Avanzar un ciclo" aria-label="Avanzar un ciclo">${icon("step")}</button><button id="instruction" class="icon-button" title="Completar una instrucción" aria-label="Completar una instrucción">${icon("next")}</button><button id="back" class="icon-button" title="Retroceder un ciclo (hasta 128)" aria-label="Retroceder un ciclo">${icon("back")}</button><button id="reset" class="icon-button" title="Reiniciar programa" aria-label="Reiniciar programa">${icon("reset")}</button></div><div id="pipeline" class="pipeline">${PHASES.map((p, i) => `<div class="phase" data-phase="${p}"><span class="phase-code">${phaseShort[i]}</span><span>${phaseNames[p]}</span><span class="phase-index">0${i + 1}</span></div>`).join("")}</div><div class="speed-control"><label for="speed">RELOJ DIDÁCTICO <b id="speed-label">2 ciclos/s</b></label><input id="speed" type="range" min="1" max="10" value="2"/></div></div>
    <div class="execution-message"><span id="cycle-message" role="status" aria-live="polite">Programa cargado. La ciudad está lista.</span><span class="render-status" title="Fotogramas por segundo y escala de resolución. La escena no se dibuja cuando está quieta."><span id="fps">—</span><span id="fps-unit"> FPS</span> <span class="dim">/</span> WEBGL 2 <span id="render-scale"></span></span></div>
  </section>
  <dialog id="guide-dialog"><div class="guide-top"><span class="eyebrow">BIENVENIDO A CPU CITY</span><button id="close-guide" class="icon-button" aria-label="Cerrar guía">${icon("close")}</button></div><h2>Del código a los circuitos<span>.</span></h2><p>Una CPU educativa de 32 bits, representada como una ciudad. Su estado se calcula en tu navegador y cada cambio alimenta la visualización.</p><ol><li><strong>Ejecuta un programa.</strong> Elige un ejemplo o edita el ensamblador y pulsa Cargar.</li><li><strong>Sigue la instrucción.</strong> Usa Ejecutar, avanza un ciclo o completa una instrucción. Puedes retroceder hasta 128 ciclos.</li><li><strong>Entra en la ALU.</strong> Abre Circuito ALU y selecciona un bit para ver cómo se genera el resultado.</li></ol><h3>Qué representa este MVP</h3><p>Un núcleo multiciclo de seis fases por instrucción, sin cachés, pipeline ni sistema operativo. El programa es de solo lectura; la memoria de datos es un espacio separado de 4 KiB. El circuito detallado cubre sumas, restas y operaciones AND, OR y XOR. Los ciclos son del modelo educativo, no de tu CPU física.</p><h3>Ensamblador disponible</h3><p class="instruction-list">ADD · SUB · AND · OR · XOR · SLL · SRL · SRA · SLT · SLTU<br>ADDI · ANDI · ORI · XORI · SLLI · SRLI · SRAI · SLTI · SLTIU<br>LW · SW · BEQ · BNE · BLT · BGE · BLTU · BGEU<br>LUI · AUIPC · JAL · JALR · EBREAK</p><p>También: etiquetas, alias de registros, comentarios con # o ; y pseudoinstrucciones MV, NOP, J y LI (inmediatos de −2048 a 2047). C y compilación a RISC-V quedan para la siguiente fase.</p><div class="guide-shortcut"><kbd>Espacio</kbd> ejecutar / pausar <kbd>→</kbd> un ciclo <kbd>←</kbd> retroceder <span>Fuera del editor</span></div></dialog>
  <div id="toast" class="toast" role="status" hidden></div>
`;

let state: Snapshot | null = null;
let city: City | null = null;
let selectedUnit: Unit = "alu";
let running = false,
  pending = false,
  dirty = false;
let timer: ReturnType<typeof setTimeout> | undefined;
let hexRegisters = false,
  circuit = false,
  selectedBit = 0;
let depth = 0;
let loadedSource = EXAMPLES.sum.source;
let requestedSource: string | null = null;
let sourceScroll = 0;
let lastMemoryHtml = "";
const source = $<HTMLTextAreaElement>("source");
const worker = new Worker(new URL("./simulation.worker.ts", import.meta.url), {
  type: "module",
});

source.value = loadedSource;
function numberLines() {
  $("line-numbers").innerHTML = source.value
    .split("\n")
    .map((_, i) => `<span>${String(i + 1).padStart(2, "0")}</span>`)
    .join("");
}
numberLines();
$("registers").innerHTML = Array.from(
  { length: 32 },
  (_, i) =>
    `<div class="register-cell" id="reg-${i}" title="x${i}"><span>x${i}</span><b>0</b></div>`,
).join("");

function stop() {
  running = false;
  clearTimeout(timer);
  updateButtons();
}
function send(type: string, text?: string) {
  if (pending) return;
  pending = true;
  worker.postMessage({ type, source: text });
  updateButtons();
}
function schedule() {
  clearTimeout(timer);
  if (running && !pending && !dirty && !state?.halted)
    timer = setTimeout(
      () => send("step"),
      1000 / Number($<HTMLInputElement>("speed").value),
    );
}
function updateButtons() {
  $("play").innerHTML =
    `${icon(running ? "pause" : "play")}<span>${running ? "Pausar" : "Ejecutar"}</span>`;
  $<HTMLButtonElement>("play").disabled =
    dirty || (!running && (pending || !!state?.halted));
  for (const id of ["step", "instruction"])
    $<HTMLButtonElement>(id).disabled = dirty || pending || !!state?.halted;
  $<HTMLButtonElement>("back").disabled = pending || dirty || !state?.canBack;
  $<HTMLButtonElement>("reset").disabled = pending;
  $<HTMLButtonElement>("load").disabled = pending;
  $<HTMLSelectElement>("example-select").disabled = pending;
  $("execution-state").textContent = dirty
    ? "CÓDIGO EDITADO"
    : state?.reason === "Error"
      ? "ERROR"
      : state?.halted
        ? "FINALIZADO"
        : running
          ? "EN EJECUCIÓN"
          : state?.cycle
            ? "EN PAUSA"
            : "PREPARADO";
  $("execution-dot").classList.toggle("pulsing", running);
  city?.setRunning(running);
  // Announcing every cycle at up to 10 per second floods screen readers.
  $("cycle-message").setAttribute("aria-live", running ? "off" : "polite");
}
function loadProgram(text: string) {
  stop();
  requestedSource = text;
  $("editor-error").hidden = true;
  send("load", text);
}
worker.onmessage = (
  event: MessageEvent<{ type: string; state?: Snapshot; message?: string }>,
) => {
  pending = false;
  if (event.data.type === "error") {
    stop();
    dirty = true;
    requestedSource = null;
    $("editor-error").textContent = event.data.message!;
    $("editor-error").hidden = false;
    $("code-status").textContent = "Revisa el programa";
    updateButtons();
    return;
  }
  state = event.data.state!;
  if (requestedSource !== null) {
    loadedSource = requestedSource;
    requestedSource = null;
  }
  if (state.cycle === 0) {
    dirty = source.value !== loadedSource;
    $("code-status").textContent = dirty
      ? "Cambios sin cargar"
      : "Código cargado";
  }
  if (state.halted) stop();
  renderState();
  schedule();
};
worker.onerror = () => {
  pending = false;
  stop();
  $("editor-error").textContent =
    "No se pudo iniciar el simulador. Recarga la página.";
  $("editor-error").hidden = false;
};

function renderState() {
  if (!state) return;
  city?.setState(state);
  $("cycle-count").textContent = String(state.cycle).padStart(4, "0");
  $("pc-value").textContent = hex(state.pc);
  $("retired-count").textContent = String(state.retired);
  $("current-instruction").textContent =
    state.current?.text.replace(/\s+/g, " ") ?? "Esperando primera instrucción";
  $("cycle-message").textContent = state.message;
  $("cycle-message").classList.toggle("has-error", state.reason === "Error");
  document.querySelectorAll<HTMLElement>(".phase").forEach((el) => {
    el.classList.toggle("current", el.dataset.phase === state!.phase);
    const idx = PHASES.indexOf(state!.phase as (typeof PHASES)[number]);
    el.classList.toggle(
      "completed",
      PHASES.indexOf(el.dataset.phase as (typeof PHASES)[number]) < idx,
    );
  });
  for (let n = 0; n < 32; n++) {
    const el = $(`reg-${n}`),
      value = state.registers[n];
    el.querySelector("b")!.textContent = hexRegisters
      ? value.toString(16).toUpperCase().padStart(8, "0")
      : String(value);
    el.title = `x${n} · ${hex(value)} · con signo ${value | 0}`;
    el.classList.toggle("written", state.writeRegister === n);
    el.classList.toggle("nonzero", value !== 0);
  }
  updateCurrentLine();
  const memoryHtml = state.memory
    .map(
      (row) =>
        `<div class="memory-row ${row.address === state!.address ? "accessed" : ""}"><span>${hex(row.address).replace("0x0000", "0x")}</span><code>${row.value.toString(16).toUpperCase().padStart(8, "0")}</code></div>`,
    )
    .join("");
  // Rebuilding the table on every cycle is wasted work when nothing changed.
  if (memoryHtml !== lastMemoryHtml) {
    $("memory-rows").innerHTML = memoryHtml;
    lastMemoryHtml = memoryHtml;
  }
  renderInspector();
  if (circuit) renderCircuit();
  updateButtons();
}
function updateCurrentLine() {
  const line = state?.current?.line;
  $("current-line").hidden = !line || dirty;
  if (line)
    $("current-line").style.top = `${12 + (line - 1) * 24 - sourceScroll}px`;
  Array.from($("line-numbers").children).forEach((el, index) =>
    el.classList.toggle("current", index === (line ?? 0) - 1 && !dirty),
  );
}

function renderInspector() {
  if (!state) return;
  const copy: Record<Unit, [string, string, string]> = {
    alu: [
      "DISTRITO DE CÁLCULO",
      "La ALU",
      "Aquí los bits se convierten en resultados.",
    ],
    registers: [
      "MEMORIA INMEDIATA",
      "Los registros",
      "32 lugares para los valores con los que trabaja el núcleo.",
    ],
    control: [
      "CENTRO DE COORDINACIÓN",
      "El control",
      "Una instrucción. Seis fases. Cada señal a su destino.",
    ],
    memory: [
      "DISTRITO DE ALMACENAMIENTO",
      "La memoria",
      "Los datos persisten entre instrucciones.",
    ],
  };
  const [kicker, title, description] = copy[selectedUnit];
  $("inspector-kicker").textContent = kicker;
  $("inspector-title").textContent = title;
  $("inspector-description").textContent = description;
  document
    .querySelector(".component-symbol")!
    .setAttribute("style", `--component-color:${UNITS[selectedUnit].color}`);
  const content = $("inspector-content");
  if (selectedUnit === "alu") {
    content.innerHTML = `<div class="operand-row"><span>Entrada A</span><b>${state.a}</b><small>${hex(state.a)}</small></div><div class="operand-row"><span>Entrada B</span><b>${state.b}</b><small>${hex(state.b)}</small></div><div class="alu-result"><div><span>${state.operation}</span><span>RESULTADO</span></div><strong>${state.result}</strong><small>${hex(state.result)}</small></div><button id="enter-alu" class="outline-button">${icon("circuit")}Explorar circuito ${icon("arrow")}</button>`;
    $("enter-alu").onclick = () => setView(true);
    $("context-tip").textContent =
      state.phase === "read"
        ? "Operandos preparados. El resultado se actualiza en la fase Ejecutar."
        : "Entra en la ALU para seguir la operación bit a bit.";
  } else if (selectedUnit === "control") {
    content.innerHTML = `<div class="operand-row"><span>Contador de programa</span><b class="small-value">${hex(state.pc)}</b></div><div class="operand-row"><span>Fase actual</span><b class="small-value">${phaseNames[state.phase]}</b></div><div class="code-word"><span>INSTRUCCIÓN BINARIA</span><code>${state.current ? state.current.word.toString(2).padStart(32, "0").match(/.{8}/g)!.join(" ") : "—"}</code></div>`;
    $("context-tip").textContent =
      "El PC indica la dirección de la instrucción. Cada instrucción ocupa 4 bytes.";
  } else if (selectedUnit === "registers") {
    const current = state.current;
    content.innerHTML = `<div class="operand-row"><span>Fuente rs1</span><b>${current ? "x" + current.rs1 : "—"}</b></div><div class="operand-row"><span>Fuente rs2</span><b>${current ? "x" + current.rs2 : "—"}</b></div><div class="operand-row"><span>Última escritura</span><b>${state.writeRegister !== null ? "x" + state.writeRegister : "—"}</b></div><p class="component-note">Los 32 valores aparecen en el panel izquierdo. x0 siempre contiene cero. La interpretación de rs1 y rs2 depende del tipo de instrucción.</p>`;
    $("context-tip").textContent =
      "Las entradas se leen en RD. El resultado se guarda en WB.";
  } else {
    content.innerHTML = `<div class="operand-row"><span>Dirección efectiva</span><b class="small-value">${state.address === null ? "—" : hex(state.address)}</b></div><div class="operand-row"><span>Operación</span><b class="small-value">${state.current?.op === "lw" ? "Lectura · LW" : state.current?.op === "sw" ? "Escritura · SW" : "Sin acceso"}</b></div><p class="component-note">Espacio de datos: 0x0000–0x0FFF. Cada palabra contiene 32 bits. Los ejemplos guardan datos a partir de 0x0100.</p>`;
    $("context-tip").textContent =
      "En este MVP, la memoria de datos está separada del programa de solo lectura.";
  }
}
function selectUnit(unit: Unit, move = true) {
  selectedUnit = unit;
  document.querySelectorAll<HTMLButtonElement>("[data-unit]").forEach((btn) => {
    btn.classList.toggle("selected", btn.dataset.unit === unit);
    btn.setAttribute("aria-pressed", String(btn.dataset.unit === unit));
  });
  renderInspector();
  if (move) city?.focus(unit);
}

function drawer(name: "code" | "data", open: boolean) {
  if (open && innerWidth < 1050) {
    const other = name === "code" ? "data" : "code";
    document.querySelector(".workspace")!.classList.remove(`${other}-open`);
    $(other + "-toggle").setAttribute("aria-expanded", "false");
  }
  document.querySelector(".workspace")!.classList.toggle(`${name}-open`, open);
  $(name + "-toggle").setAttribute("aria-expanded", String(open));
}
function updateDepth(value: number) {
  depth = value;
  $("zoom-fill").style.width = `${value * 100}%`;
  if (circuit) return;
  const inside = value > 0.55;
  $("scene-title").textContent = inside ? "La arquitectura." : "El procesador.";
  $("scale-label").textContent = inside
    ? "INTERIOR · MODELO EDUCATIVO"
    : "SUPERFICIE";
  $("scene-description").textContent = inside
    ? "Selecciona un componente o ejecuta el programa."
    : "Acércate para descubrir lo que ocurre dentro.";
  $("enter-chip").hidden = inside;
  $("processor-view").classList.toggle("selected", !inside);
  $("city-view").classList.toggle("selected", inside);
  $("processor-view").setAttribute("aria-pressed", String(!inside));
  $("city-view").setAttribute("aria-pressed", String(inside));
  document.querySelector(".stage")!.classList.toggle("inside-chip", inside);
}

function setView(showCircuit: boolean) {
  circuit = showCircuit;
  $("circuit-panel").hidden = !circuit;
  document.querySelector(".stage")!.classList.toggle("circuit-mode", circuit);
  city?.setDimmed(circuit);
  for (const [id, selected] of [
    ["city-view", !circuit],
    ["circuit-view", circuit],
  ] as const) {
    $(id).classList.toggle("selected", selected);
    $(id).setAttribute("aria-pressed", String(selected));
  }
  if (circuit) {
    $("processor-view").classList.remove("selected");
    $("processor-view").setAttribute("aria-pressed", "false");
    $("scene-title").textContent = "El circuito.";
    $("scale-label").textContent = "ALU · LÓGICA DIGITAL";
    $("enter-chip").hidden = true;
    selectUnit("alu", false);
    renderCircuit();
  } else updateDepth(depth);
}
function renderCircuit() {
  if (!state) return;
  const isSubtract = state.operation === "SUB";
  const isAdder = ["ADD", "SUB"].includes(state.operation);
  const isLogic = ["AND", "OR", "XOR"].includes(state.operation);
  const bits = adderBits(state.a, state.b, isSubtract),
    bit = bits[selectedBit];
  const computed = isAdder
    ? bits.reduce((n, b) => (n | (b.sum << b.index)) >>> 0, 0)
    : state.operation === "AND"
      ? (state.a & state.b) >>> 0
      : state.operation === "OR"
        ? (state.a | state.b) >>> 0
        : state.operation === "XOR"
          ? (state.a ^ state.b) >>> 0
          : state.result;
  $("circuit-title").textContent = isAdder
    ? isSubtract
      ? "Resta por complemento a dos"
      : "Sumador de 32 bits"
    : isLogic
      ? `Puertas ${state.operation}`
      : "Operación de la ALU";
  $("circuit-operation").textContent = state.operation;
  $("binary-operands").innerHTML = [
    ["A", state.a],
    ["B", state.b],
    ["Σ", computed],
  ]
    .map(
      ([label, value]) =>
        `<div class="binary-row"><span>${label}</span><code>${(value as number)
          .toString(2)
          .padStart(32, "0")
          .split("")
          .map(
            (bit, index) =>
              `<span class="${bit === "1" ? "one" : ""} ${31 - index === selectedBit ? "selected-bit" : ""} ${index % 8 === 0 ? "byte-start" : ""}">${bit}</span>`,
          )
          .join("")}</code><b>${value}</b></div>`,
    )
    .join("");
  $("bit-number").textContent = String(selectedBit);
  const pin = (x: number, y: number, label: string, value: number) =>
    `<g class="pin ${value ? "high" : ""}"><circle cx="${x}" cy="${y}" r="17"/><text x="${x}" y="${y + 5}" text-anchor="middle">${value}</text><text class="pin-label" x="${x}" y="${y - 28}" text-anchor="middle">${label}</text></g>`;
  const gate = (x: number, y: number, label: string, value: number) =>
    `<g class="logic-gate ${value ? "high" : ""}"><rect x="${x - 35}" y="${y - 23}" width="70" height="46" rx="7"/><text x="${x}" y="${y + 5}" text-anchor="middle">${label}</text></g>`;
  const wire = (d: string, high: number) =>
    `<path class="wire ${high ? "high" : ""}" d="${d}"/>`;
  if (isAdder) {
    $("gate-visual").innerHTML =
      `<svg viewBox="0 0 560 260" role="img" aria-label="Sumador completo del bit ${selectedBit}: A ${bit.a}, B ${bit.b}, acarreo de entrada ${bit.cin}, suma ${bit.sum}, acarreo de salida ${bit.cout}">
      ${wire("M47 60H125V88H155", bit.a)}${wire("M47 150H105V112H155", bit.b)}${wire("M225 100H300V80H325", bit.propagate)}${wire("M47 225H275V105H325", bit.cin)}${wire("M395 92H510", bit.sum)}
      ${wire("M80 60V155H155", bit.a)}${wire("M105 150V180H155", bit.b)}${wire("M225 167H420V189H440", bit.generate)}${wire("M250 100V155H325", bit.propagate)}${wire("M275 225V180H325", bit.cin)}${wire("M395 167H410V211H440", bit.propagate & bit.cin)}${wire("M510 200H525", bit.cout)}
      ${pin(30, 60, `A${selectedBit}`, bit.a)}${pin(30, 150, `${isSubtract ? "¬B" : "B"}${selectedBit}`, bit.b)}${pin(30, 225, "Cin", bit.cin)}
      ${gate(190, 100, "XOR", bit.propagate)}${gate(190, 167, "AND", bit.generate)}${gate(360, 92, "XOR", bit.sum)}${gate(360, 167, "AND", bit.propagate & bit.cin)}${gate(475, 200, "OR", bit.cout)}
      ${pin(530, 92, "SUMA", bit.sum)}${pin(535, 245, "Cout", bit.cout)}${wire("M525 200H535V228", bit.cout)}
    </svg>`;
    $("gate-description").textContent = isSubtract
      ? `A + ¬B + 1 · Bit ${selectedBit}: ${bit.a} + ${bit.b} + ${bit.cin} = ${bit.sum}, acarreo ${bit.cout}.`
      : `Bit ${selectedBit}: ${bit.a} + ${bit.b} + acarreo ${bit.cin} → suma ${bit.sum}, acarreo ${bit.cout}.`;
  } else if (isLogic) {
    const a = (state.a >>> selectedBit) & 1,
      b = (state.b >>> selectedBit) & 1,
      result = (computed >>> selectedBit) & 1;
    $("gate-visual").innerHTML =
      `<svg viewBox="0 0 560 260" role="img" aria-label="Puerta ${state.operation}: entradas ${a} y ${b}, salida ${result}">${wire("M100 80H190V115H245", a)}${wire("M100 180H190V145H245", b)}${wire("M315 130H460", result)}${pin(83, 80, "A", a)}${pin(83, 180, "B", b)}${gate(280, 130, state.operation, result)}${pin(477, 130, "SALIDA", result)}</svg>`;
    $("gate-description").textContent =
      `Bit ${selectedBit}: ${a} ${state.operation} ${b} = ${result}. Cada bit se calcula de forma independiente.`;
  } else {
    $("gate-visual").innerHTML =
      `<div class="circuit-empty">${icon("circuit")}<strong>${state.operation}</strong><p>Resultado disponible en el inspector.</p><span>El circuito detallado de esta operación llegará en una siguiente versión.</span></div>`;
    $("gate-description").textContent =
      "Prueba el ejemplo de suma para explorar las puertas del sumador.";
  }
}

$("play").onclick = () => {
  if (running) stop();
  else {
    if (!circuit && depth < 0.5) city?.focus();
    running = true;
    updateButtons();
    send("step");
  }
};
$("step").onclick = () => {
  stop();
  send("step");
};
$("instruction").onclick = () => {
  stop();
  send("instruction");
};
$("back").onclick = () => {
  stop();
  send("back");
};
$("reset").onclick = () => loadProgram(loadedSource);
$("load").onclick = () => loadProgram(source.value);
$("city-view").onclick = () => {
  setView(false);
  city?.focus();
};
$("processor-view").onclick = () => {
  setView(false);
  city?.surface();
};
$("enter-chip").onclick = () => city?.focus();
$("code-toggle").onclick = () =>
  drawer("code", $("code-toggle").getAttribute("aria-expanded") !== "true");
$("data-toggle").onclick = () =>
  drawer("data", $("data-toggle").getAttribute("aria-expanded") !== "true");
$("close-data").onclick = () => drawer("data", false);
$("circuit-view").onclick = () => setView(true);
$("home-camera").onclick = () => {
  setView(false);
  city?.surface();
};
$("rotate-left").onclick = () => city?.rotate(-Math.PI / 6, 0);
$("pan-mode").onclick = () => {
  const pan = $("pan-mode").getAttribute("aria-pressed") !== "true";
  $("pan-mode").setAttribute("aria-pressed", String(pan));
  city?.setPanMode(pan);
  $("camera-help").textContent = pan
    ? "Arrastrar o scroll: desplazar · pellizco o Ctrl + rueda: zoom"
    : "Scroll: desplazar · arrastrar: girar · pellizco o Ctrl + rueda: zoom";
};
$("zoom-in").onclick = () => city?.zoom(true);
$("zoom-out").onclick = () => city?.zoom(false);
$("rotate-right").onclick = () => city?.rotate(Math.PI / 6, 0);
$("tilt-up").onclick = () => city?.rotate(0, -Math.PI / 12);
$("tilt-down").onclick = () => city?.rotate(0, Math.PI / 12);
$("camera-angle").onchange = (event) => {
  const select = event.target as HTMLSelectElement;
  city?.angle(select.value);
  select.value = "";
};
document.querySelector(".brand")!.addEventListener("click", (event) => {
  event.preventDefault();
  setView(false);
  city?.surface();
});
$<HTMLSelectElement>("example-select").onchange = (event) => {
  const example =
    EXAMPLES[
      (event.target as HTMLSelectElement).value as keyof typeof EXAMPLES
    ];
  source.value = example.source;
  $("filename").textContent = example.file;
  numberLines();
  loadProgram(example.source);
};
source.oninput = () => {
  stop();
  dirty = source.value !== loadedSource;
  $("code-status").textContent = dirty
    ? "Cambios sin cargar"
    : "Código cargado";
  numberLines();
  updateCurrentLine();
  updateButtons();
};
source.onscroll = () => {
  sourceScroll = source.scrollTop;
  $("line-numbers").style.transform = `translateY(${-sourceScroll}px)`;
  updateCurrentLine();
};
source.onkeydown = (event) => {
  if (event.key === "Tab") {
    event.preventDefault();
    source.setRangeText(
      "  ",
      source.selectionStart,
      source.selectionEnd,
      "end",
    );
    source.dispatchEvent(new Event("input"));
  }
};
$("register-format").onclick = () => {
  hexRegisters = !hexRegisters;
  $("register-format").textContent = hexRegisters ? "HEX" : "DEC";
  $("registers").classList.toggle("hex-format", hexRegisters);
  renderState();
};
document
  .querySelectorAll<HTMLButtonElement>("[data-unit]")
  .forEach((btn) => (btn.onclick = () => selectUnit(btn.dataset.unit as Unit)));
$("bit-index").oninput = (event) => {
  selectedBit = Number((event.target as HTMLInputElement).value);
  renderCircuit();
};
$("speed").oninput = (event) => {
  $("speed-label").textContent =
    `${(event.target as HTMLInputElement).value} ciclos/s`;
  schedule();
};
for (const id of ["signals-toggle", "labels-toggle"])
  $(id).onclick = () => {
    const active = $(id).getAttribute("aria-pressed") !== "true";
    $(id).setAttribute("aria-pressed", String(active));
    $(id).classList.toggle("active", active);
    if (id === "signals-toggle") city?.setSignals(active);
    else city?.setLabels(active);
  };
const QUALITY_KEY = "cpu-city:quality";
let qualityHigh = true;
try {
  qualityHigh = localStorage.getItem(QUALITY_KEY) !== "light";
} catch {}
function showQuality() {
  $("quality-toggle").textContent = qualityHigh ? "Calidad alta" : "Modo ligero";
  $("quality-toggle").setAttribute("aria-pressed", String(!qualityHigh));
}
showQuality();
$("quality-toggle").onclick = () => {
  qualityHigh = !qualityHigh;
  city?.setQuality(qualityHigh);
  showQuality();
  try {
    localStorage.setItem(QUALITY_KEY, qualityHigh ? "high" : "light");
  } catch {}
};
const guide = $<HTMLDialogElement>("guide-dialog");
$("guide-button").onclick = () => {
  stop();
  guide.showModal();
};
$("close-guide").onclick = () => guide.close();
guide.addEventListener("click", (event) => {
  if (event.target === guide) {
    const box = guide.getBoundingClientRect();
    if (
      event.clientX < box.left ||
      event.clientX > box.right ||
      event.clientY < box.top ||
      event.clientY > box.bottom
    )
      guide.close();
  }
});
window.addEventListener("keydown", (event) => {
  if (
    event.target instanceof HTMLInputElement ||
    event.target instanceof HTMLTextAreaElement ||
    event.target instanceof HTMLSelectElement ||
    guide.open ||
    event.target instanceof HTMLButtonElement
  )
    return;
  const action =
    event.code === "Space"
      ? "play"
      : event.code === "ArrowRight"
        ? "step"
        : event.code === "ArrowLeft"
          ? "back"
          : null;
  if (action) {
    event.preventDefault();
    if (!$<HTMLButtonElement>(action).disabled) $(action).click();
  }
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) stop();
});
loadProgram(loadedSource);
function showFps(fps: number | null, ratio: number) {
  $("fps").textContent = fps === null ? "EN REPOSO" : String(fps);
  $("fps-unit").hidden = fps === null;
  $("render-scale").textContent = `· ${Number(ratio.toFixed(2))}×`;
}
function showSceneError(title: string, text: string, retry: boolean) {
  $("scene-loading").innerHTML =
    `<div class="webgl-error">${icon("chip")}<strong>${title}</strong><p>${text}</p><div class="webgl-error-actions">${retry ? `<button class="outline-button" id="retry-scene">Reintentar</button>` : ""}<button class="outline-button" id="fallback-circuit">Abrir circuito ALU</button></div></div>`;
  $("fallback-circuit").onclick = () => {
    $("scene-loading").hidden = true;
    setView(true);
  };
  if (retry) $("retry-scene").onclick = () => location.reload();
  $("fps").textContent = "—";
}
// Three.js is loaded as a separate chunk so the interface and the simulator are
// usable before the 3D engine has downloaded.
const stage = document.querySelector<HTMLElement>(".stage")!;
stage.classList.add("scene-pending");
import("./city.ts")
  .then(({ City }) => {
    $("loading-text").textContent = "Construyendo la ciudad…";
    // Let the new text paint before the synchronous scene build.
    requestAnimationFrame(() =>
      setTimeout(() => {
        try {
          performance.mark("city:start");
          city = new City(
            $("city-canvas"),
            (unit) => {
              selectUnit(unit, false);
              drawer("data", true);
            },
            showFps,
            updateDepth,
          );
          performance.measure("city:build", "city:start");
          if (!qualityHigh) city.setQuality(false);
          if (state) city.setState(state);
          city.setRunning(running);
          city.setDimmed(circuit);
          stage.classList.remove("scene-pending");
          $("scene-loading").classList.add("is-done");
          setTimeout(() => ($("scene-loading").hidden = true), 400);
        } catch {
          stage.classList.remove("scene-pending");
          showSceneError(
            "La vista 3D necesita WebGL 2",
            "Activa la aceleración gráfica o prueba otro navegador. Puedes seguir usando el simulador y el circuito ALU.",
            false,
          );
        }
      }),
    );
  })
  .catch(() =>
    showSceneError(
      "No se pudo descargar la vista 3D",
      "Comprueba la conexión y vuelve a intentarlo. El simulador y el circuito ALU siguen disponibles.",
      true,
    ),
  );
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    stop();
    worker.terminate();
    city?.dispose();
  });
