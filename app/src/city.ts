import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { BokehPass } from "three/addons/postprocessing/BokehPass.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { Snapshot, Unit } from "./cpu.ts";

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
const smooth = (a: number, b: number, x: number) =>
  THREE.MathUtils.smoothstep(x, a, b);
function rng(seed = 7823) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
}
function texture(
  size: number,
  paint: (ctx: CanvasRenderingContext2D, size: number) => void,
) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  paint(canvas.getContext("2d")!, size);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 16;
  return map;
}
function grainTexture() {
  return texture(512, (ctx, size) => {
    const rand = rng(),
      pixels = ctx.createImageData(size, size);
    for (let i = 0; i < pixels.data.length; i += 4) {
      const g = 135 + rand() * 45;
      pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = g;
      pixels.data[i + 3] = 255;
    }
    ctx.putImageData(pixels, 0, 0);
    for (let n = 0; n < 1400; n++) {
      const y = rand() * size;
      ctx.strokeStyle = `rgba(230,230,230,${rand() * 0.11})`;
      ctx.lineWidth = 0.35;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(size, y + rand() * 1.5);
      ctx.stroke();
    }
  });
}
function lidTexture() {
  return texture(1024, (ctx, size) => {
    const rand = rng(123),
      pixels = ctx.createImageData(size, size);
    for (let i = 0; i < pixels.data.length; i += 4) {
      const g = 185 + rand() * 12;
      pixels.data[i] = g;
      pixels.data[i + 1] = g + 1;
      pixels.data[i + 2] = g + 2;
      pixels.data[i + 3] = 255;
    }
    ctx.putImageData(pixels, 0, 0);
    for (let n = 0; n < 1000; n++) {
      ctx.strokeStyle = `rgba(115,118,121,${rand() * 0.055})`;
      const y = rand() * size;
      ctx.beginPath();
      ctx.moveTo(rand() * 100, y);
      ctx.lineTo(size, y + 0.4);
      ctx.stroke();
    }
    ctx.fillStyle = "#71777b";
    ctx.font = "500 65px sans-serif";
    ctx.fillText("CPU CITY", 157, 334);
    ctx.font = "26px monospace";
    ctx.fillText("RISC-V  /  RV32I", 161, 397);
    ctx.font = "20px monospace";
    ctx.fillText("EDUCATIONAL PROCESSOR", 161, 475);
    ctx.fillText("32-BIT  ·  SINGLE CORE", 161, 511);
    ctx.font = "18px monospace";
    ctx.fillText("CC-001   2026", 161, 659);
    ctx.fillText("ASSEMBLED IN YOUR BROWSER", 161, 697);
    for (let y = 0; y < 17; y++)
      for (let x = 0; x < 17; x++)
        if (rand() > 0.5) ctx.fillRect(715 + x * 6, 616 + y * 6, 4, 4);
    ctx.beginPath();
    ctx.moveTo(77, 913);
    ctx.lineTo(77, 944);
    ctx.lineTo(108, 944);
    ctx.closePath();
    ctx.fill();
  });
}
function boardTexture() {
  return texture(2048, (ctx, size) => {
    ctx.fillStyle = "#152827";
    ctx.fillRect(0, 0, size, size);
    const rand = rng(209),
      pixels = ctx.getImageData(0, 0, size, size);
    for (let i = 0; i < pixels.data.length; i += 4) {
      const n = (rand() - 0.5) * 5;
      pixels.data[i] += n;
      pixels.data[i + 1] += n;
      pixels.data[i + 2] += n;
    }
    ctx.putImageData(pixels, 0, 0);
    for (let n = 0; n < 600; n++) {
      const x = rand() * size,
        y = rand() * size,
        length = 30 + rand() * 330,
        direction = n % 2 ? 1 : -1;
      ctx.strokeStyle = n % 11 === 0 ? "#68624a" : "#29403b";
      ctx.lineWidth = n % 9 === 0 ? 2.5 : 1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + length, y);
      ctx.lineTo(x + length + 25, y + 25 * direction);
      ctx.lineTo(x + length + 25, y + 80 * direction);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = "#657468";
      ctx.fill();
    }
    ctx.strokeStyle = "#647569";
    ctx.fillStyle = "#879082";
    ctx.font = "12px monospace";
    for (let n = 0; n < 100; n++) {
      const x = rand() * size,
        y = rand() * size;
      ctx.strokeRect(x, y, 18 + rand() * 28, 12 + rand() * 15);
      ctx.fillText(`${n % 3 ? "R" : "C"}${100 + n}`, x, y - 5);
    }
    ctx.font = "21px monospace";
    ctx.fillStyle = "#839487";
    ctx.fillText("CPU CITY  /  MAINBOARD REV 01", 118, 1850);
    ctx.font = "15px monospace";
    ctx.fillText("SOCKET RV32", 118, 1884);
  });
}
function facadeTexture() {
  return texture(256, (ctx, size) => {
    const rand = rng(25);
    ctx.fillStyle = "#151c22";
    ctx.fillRect(0, 0, size, size);
    for (let y = 7; y < size; y += 12)
      for (let x = 6; x < size; x += 17) {
        ctx.fillStyle =
          rand() > 0.6 ? (rand() > 0.5 ? "#8b7b5b" : "#557c88") : "#263038";
        ctx.fillRect(x, y, 8, 3);
      }
    ctx.strokeStyle = "#070c11";
    ctx.lineWidth = 3;
    for (let x = 0; x < size; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, size);
      ctx.stroke();
    }
  });
}

export class City {
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(37, 1, 0.15, 500);
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private bokeh: BokehPass;
  private highQuality = true;
  private environment: THREE.WebGLRenderTarget;
  private observer: ResizeObserver;
  private clock = new THREE.Clock();
  private innerCity = new THREE.Group();
  private cover = new THREE.Group();
  private lids: THREE.Material[] = [];
  private textures: THREE.Texture[] = [];
  private unitMaterials = new Map<Unit, THREE.MeshStandardMaterial>();
  private labels = new Map<Unit, HTMLButtonElement>();
  private active: Unit[] = [];
  private signals: {
    mesh: THREE.Mesh;
    curve: THREE.Curve<THREE.Vector3>;
    unit: Unit;
    offset: number;
  }[] = [];
  private targetPosition: THREE.Vector3 | null = null;
  private targetLook: THREE.Vector3 | null = null;
  private targetOrbit: THREE.Spherical | null = null;
  private signalsVisible = true;
  private labelsVisible = true;
  private reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  private elapsed = 0;
  private frames = 0;
  private time = 0;
  private animation = 0;
  private dead = false;
  private lastDepth = -1;
  private sun: THREE.DirectionalLight;
  private previousReveal = -1;
  private shadowExtent = 65;
  private focusedUnit: Unit | null = null;
  private onWheel = (event: WheelEvent) => {
    // Trackpad two-finger scroll translates the camera. Pinch arrives as ctrl+wheel.
    if (event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    this.targetPosition = null;
    this.targetLook = null;
    this.targetOrbit = null;
    const height = this.container.clientHeight;
    const unit =
      event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? height : 1;
    let dx = event.deltaX * unit,
      dy = event.deltaY * unit;
    if (event.shiftKey && dx === 0) {
      dx = dy;
      dy = 0;
    }
    const scale =
      (2 *
        this.camera.position.distanceTo(this.controls.target) *
        Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2))) /
      height;
    this.camera.updateMatrix();
    const right = new THREE.Vector3().setFromMatrixColumn(
        this.camera.matrix,
        0,
      ),
      up = new THREE.Vector3().setFromMatrixColumn(this.camera.matrix, 1);
    const offset = right
      .multiplyScalar(dx * scale)
      .add(up.multiplyScalar(-dy * scale));
    this.camera.position.add(offset);
    this.controls.target.add(offset);
    this.controls.update();
  };
  private onVisibility = () => {
    this.clock.getDelta();
    if (!document.hidden && !this.animation && !this.dead) this.tick();
  };
  constructor(
    private container: HTMLElement,
    private onSelect: (unit: Unit) => void,
    private onFps: (fps: number) => void,
    private onDepth: (depth: number) => void = () => {},
  ) {
    this.scene.background = new THREE.Color("#0c1013");
    this.scene.fog = new THREE.FogExp2("#0c1013", 0.0037);
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = true;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.domElement.setAttribute("role", "img");
    this.renderer.domElement.setAttribute(
      "aria-label",
      "Procesador físico sobre una placa base. Arrastra para orbitar. Scroll para desplazar. Pellizco, Ctrl más rueda o botones para acercarte y revelar la ciudad de su interior.",
    );
    container.prepend(this.renderer.domElement);
    const room = new RoomEnvironment(),
      pmrem = new THREE.PMREMGenerator(this.renderer);
    this.environment = pmrem.fromScene(room, 0.02);
    this.scene.environment = this.environment.texture;
    this.scene.environmentIntensity = 0.68;
    room.dispose();
    pmrem.dispose();
    this.scene.add(new THREE.HemisphereLight("#bbcdd3", "#20211e", 0.85));
    this.sun = new THREE.DirectionalLight("#ffefd6", 3.4);
    this.sun.position.set(-30, 65, 35);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, {
      left: -65,
      right: 65,
      top: 65,
      bottom: -65,
      near: 1,
      far: 160,
    });
    this.sun.shadow.bias = -0.00012;
    this.sun.shadow.normalBias = 0.05;
    this.sun.shadow.radius = 3;
    this.scene.add(this.sun);
    const rim = new THREE.DirectionalLight("#7fabc4", 1.1);
    rim.position.set(35, 20, -20);
    this.scene.add(rim);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 3, 0);
    this.controls.enableDamping = !this.reduced;
    this.controls.dampingFactor = 0.075;
    this.controls.enablePan = true;
    this.controls.screenSpacePanning = true;
    this.controls.panSpeed = 0.7;
    this.controls.minDistance = 20;
    this.controls.maxDistance = 160;
    this.controls.minPolarAngle = 0.1;
    this.controls.maxPolarAngle = Math.PI * 0.47;
    this.controls.zoomSpeed = 0.65;
    this.renderer.domElement.addEventListener("wheel", this.onWheel, {
      passive: false,
      capture: true,
    });
    this.controls.addEventListener("start", () => {
      this.targetPosition = null;
      this.targetLook = null;
      this.targetOrbit = null;
    });
    const target = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      samples: Math.min(4, this.renderer.capabilities.maxSamples),
    });
    this.composer = new EffectComposer(this.renderer, target);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bokeh = new BokehPass(this.scene, this.camera, {
      focus: 120,
      aperture: 0.000025,
      maxblur: 0.008,
    });
    this.composer.addPass(this.bokeh);
    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(800, 600),
      0.22,
      0.4,
      1.1,
    );
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.buildHardware();
    this.buildCity();
    this.batch(this.innerCity, new Set(this.signals.map((s) => s.mesh)));
    this.batch(this.scene, new Set([this.innerCity, this.cover]));
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(container);
    document.addEventListener("visibilitychange", this.onVisibility);
    this.resize();
    this.camera.position.copy(this.homePosition());
    this.tick();
  }
  private box(
    parent: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    mat: THREE.Material,
    rounded = 0,
  ) {
    const mesh = new THREE.Mesh(
      rounded
        ? new RoundedBoxGeometry(w, h, d, 2, rounded)
        : new THREE.BoxGeometry(w, h, d),
      mat,
    );
    mesh.position.set(x, y + h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  private buildHardware() {
    const grain = grainTexture(),
      lid = lidTexture(),
      board = boardTexture();
    this.textures.push(grain, lid, board);
    const silver = new THREE.MeshStandardMaterial({
      color: "#b0b5b9",
      metalness: 1,
      roughness: 0.32,
      bumpMap: grain,
      bumpScale: 0.028,
    });
    const plastic = new THREE.MeshStandardMaterial({
        color: "#141817",
        roughness: 0.64,
        metalness: 0.1,
      }),
      ceramic = new THREE.MeshStandardMaterial({
        color: "#212828",
        roughness: 0.5,
        metalness: 0.3,
      });
    const solder = new THREE.MeshStandardMaterial({
        color: "#8d9497",
        metalness: 1,
        roughness: 0.27,
      }),
      gold = new THREE.MeshStandardMaterial({
        color: "#b69b5d",
        metalness: 1,
        roughness: 0.3,
      });
    const pcb = new THREE.MeshStandardMaterial({
      color: "#bec6bf",
      map: board,
      roughness: 0.47,
      metalness: 0.22,
      bumpMap: grain,
      bumpScale: 0.022,
    });
    this.box(this.scene, 0, -2, 0, 143, 1.5, 116, pcb, 0.4);
    this.box(this.scene, 0, -0.5, 0, 47, 0.9, 47, plastic, 0.35);
    this.box(this.scene, 0, 0.4, 0, 45, 0.85, 45, ceramic, 0.2);
    this.box(
      this.scene,
      0,
      1.25,
      0,
      42,
      0.85,
      42,
      new THREE.MeshStandardMaterial({
        color: "#173c2d",
        roughness: 0.4,
        metalness: 0.2,
        bumpMap: grain,
        bumpScale: 0.02,
      }),
      0.15,
    );
    this.box(
      this.scene,
      0,
      2.1,
      0,
      33,
      0.18,
      33,
      new THREE.MeshStandardMaterial({
        color: "#343d35",
        metalness: 0.65,
        roughness: 0.35,
      }),
      0.1,
    );
    this.box(this.scene, -23.2, 0.5, 0, 1.1, 1.8, 48, silver, 0.16);
    this.box(this.scene, 23.2, 0.5, 0, 1.1, 1.8, 48, silver, 0.16);
    this.box(this.scene, 0, 0.5, -23.4, 47.5, 1.7, 1.1, silver, 0.15);
    this.box(this.scene, 0, 0.5, 23.4, 47.5, 1.7, 1.1, silver, 0.15);
    this.box(this.scene, 25.6, 1.1, -1, 0.5, 0.6, 45, silver, 0.2);
    this.box(this.scene, 28, 1.1, 20, 5, 0.6, 0.6, silver, 0.2);
    const screwMat = new THREE.MeshStandardMaterial({
      color: "#7e8585",
      metalness: 1,
      roughness: 0.3,
    });
    for (const x of [-24, 24])
      for (const z of [-24, 24]) {
        const screw = new THREE.Mesh(
          new THREE.CylinderGeometry(0.9, 0.9, 0.38, 24),
          screwMat,
        );
        screw.position.set(x, 0.8, z);
        screw.castShadow = true;
        this.scene.add(screw);
        this.box(this.scene, x, 0.99, z, 1.1, 0.03, 0.16, plastic);
      }
    const caps = new THREE.InstancedMesh(
        new THREE.BoxGeometry(0.65, 0.32, 0.4),
        ceramic,
        160,
      ),
      pads = new THREE.InstancedMesh(
        new THREE.BoxGeometry(0.85, 0.09, 0.48),
        solder,
        160,
      ),
      matrix = new THREE.Matrix4();
    for (let n = 0; n < 160; n++) {
      const side = Math.floor(n / 40),
        p = -19 + (n % 40) * 0.97,
        x = side < 2 ? p : side === 2 ? -20 : 20,
        z = side >= 2 ? p : side === 0 ? -20 : 20;
      matrix.makeTranslation(x, 2.3, z);
      caps.setMatrixAt(n, matrix);
      matrix.makeTranslation(x, 2.13, z);
      pads.setMatrixAt(n, matrix);
    }
    caps.castShadow = true;
    this.scene.add(caps, pads);
    const contacts = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.32, 0.09, 0.7),
      gold,
      156,
    );
    for (let n = 0; n < 156; n++) {
      const side = Math.floor(n / 39),
        p = -19 + (n % 39);
      matrix.makeTranslation(
        side < 2 ? p : side === 2 ? -21.1 : 21.1,
        1.3,
        side >= 2 ? p : side === 0 ? -21.1 : 21.1,
      );
      contacts.setMatrixAt(n, matrix);
    }
    this.scene.add(contacts);
    this.scene.add(this.cover);
    const lidMetal = silver.clone();
    lidMetal.transparent = true;
    this.lids.push(lidMetal);
    this.box(this.cover, 0, 2.35, 0, 36.8, 1.85, 36.8, lidMetal, 0.55);
    const top = new THREE.MeshPhysicalMaterial({
      map: lid,
      metalness: 1,
      roughness: 0.29,
      anisotropy: 0.55,
      anisotropyRotation: Math.PI / 2,
      bumpMap: grain,
      bumpScale: 0.012,
      transparent: true,
    });
    this.lids.push(top);
    top.polygonOffset = true;
    top.polygonOffsetFactor = -1;
    top.polygonOffsetUnits = -1;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(35.3, 35.3), top);
    face.rotation.x = -Math.PI / 2;
    face.position.y = 4.235;
    face.userData.decal = true;
    this.cover.add(face);
    const rand = rng(719);
    for (let n = 0; n < 11; n++) {
      const x = -38 + n * 6.4;
      this.box(this.scene, x, -0.5, -35, 4.9, 3.1, 4.9, ceramic, 0.3);
      this.box(this.scene, x, -0.5, -42, 4.4, 1.1, 3.2, plastic, 0.14);
      for (let k = 0; k < 6; k++)
        this.box(
          this.scene,
          x - 2.2 + k * 0.86,
          -0.5,
          -45,
          0.3,
          0.15,
          1.1,
          solder,
        );
    }
    for (let row = 0; row < 2; row++) {
      const x = 38 + row * 12;
      this.box(this.scene, x, -0.5, 1, 9, 0.8, 83, plastic, 0.1);
      for (let n = 0; n < 8; n++) {
        this.box(
          this.scene,
          x,
          0.3,
          -32 + n * 9.2,
          6.8,
          1.5,
          7.6,
          ceramic,
          0.18,
        );
        for (let k = 0; k < 8; k++) {
          this.box(
            this.scene,
            x - 3.7,
            0.05,
            -34.8 + n * 9.2 + k * 0.73,
            0.7,
            0.2,
            0.2,
            solder,
          );
          this.box(
            this.scene,
            x + 3.7,
            0.05,
            -34.8 + n * 9.2 + k * 0.73,
            0.7,
            0.2,
            0.2,
            solder,
          );
        }
      }
    }
    for (let n = 0; n < 5; n++) {
      const z = -24 + n * 12;
      this.box(this.scene, -44, -0.5, z, 10, 1.2, 8, plastic, 0.2);
      for (let k = 0; k < 8; k++)
        this.box(
          this.scene,
          -48 + k * 1.1,
          0.7,
          z,
          0.42,
          4.2,
          7.6,
          ceramic,
          0.08,
        );
    }
    const resistors = new THREE.InstancedMesh(
        new THREE.BoxGeometry(0.8, 0.35, 0.45),
        ceramic,
        420,
      ),
      tips = new THREE.InstancedMesh(
        new THREE.BoxGeometry(1.1, 0.14, 0.5),
        solder,
        420,
      );
    for (let n = 0; n < 420; n++) {
      let x = (rand() - 0.5) * 134,
        z = (rand() - 0.5) * 107;
      if (Math.abs(x) < 28 && Math.abs(z) < 28)
        z = (z < 0 ? -1 : 1) * (28 + rand() * 22);
      matrix.makeTranslation(x, -0.23, z);
      resistors.setMatrixAt(n, matrix);
      matrix.makeTranslation(x, -0.46, z);
      tips.setMatrixAt(n, matrix);
    }
    this.scene.add(resistors, tips);
    for (const x of [-62, 62])
      for (const z of [-48, 48]) {
        const hole = new THREE.Mesh(
          new THREE.CylinderGeometry(1.4, 1.4, 0.1, 32),
          solder,
        );
        hole.position.set(x, -0.45, z);
        this.scene.add(hole);
        const center = new THREE.Mesh(
          new THREE.CylinderGeometry(0.8, 0.8, 0.12, 24),
          plastic,
        );
        center.position.set(x, -0.38, z);
        this.scene.add(center);
      }
  }
  private buildCity() {
    this.innerCity.position.y = 2.3;
    this.scene.add(this.innerCity);
    const metal = new THREE.MeshStandardMaterial({
        color: "#293238",
        metalness: 0.7,
        roughness: 0.4,
      }),
      dark = new THREE.MeshStandardMaterial({
        color: "#131b21",
        metalness: 0.55,
        roughness: 0.43,
      });
    const glassMap = facadeTexture();
    this.textures.push(glassMap);
    const facade = new THREE.MeshStandardMaterial({
      map: glassMap,
      emissiveMap: glassMap,
      emissive: "#8faab8",
      emissiveIntensity: 0.55,
      metalness: 0.6,
      roughness: 0.38,
    });
    this.box(
      this.innerCity,
      0,
      0,
      0,
      33,
      0.3,
      33,
      new THREE.MeshStandardMaterial({
        color: "#161d23",
        metalness: 0.7,
        roughness: 0.35,
      }),
      0.08,
    );
    const tracePositions: number[] = [];
    for (let n = 0; n < 45; n++) {
      const t = -16 + n * 0.72;
      tracePositions.push(t, 0.32, -16, t, 0.32, 16, -16, 0.32, t, 16, 0.32, t);
    }
    const traceGeo = new THREE.BufferGeometry();
    traceGeo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(tracePositions, 3),
    );
    this.innerCity.add(
      new THREE.LineSegments(
        traceGeo,
        new THREE.LineBasicMaterial({
          color: "#52636a",
          transparent: true,
          opacity: 0.3,
        }),
      ),
    );
    const rand = rng(298);
    for (const unit of Object.keys(UNITS) as Unit[]) {
      const def = UNITS[unit],
        group = new THREE.Group();
      group.position.set(def.position[0], 0.3, def.position[2]);
      this.innerCity.add(group);
      const glow = new THREE.MeshStandardMaterial({
        color: "#283233",
        emissive: def.color,
        emissiveIntensity: 0.6,
        roughness: 0.35,
        metalness: 0.3,
      });
      this.unitMaterials.set(unit, glow);
      if (unit === "registers") {
        this.box(group, 0, 0, 0, 9, 0.25, 10, dark);
        for (let y = 0; y < 8; y++)
          for (let x = 0; x < 4; x++) {
            const px = -3.2 + x * 2.1,
              pz = -4.25 + y * 1.2,
              h = 1.8 + (x % 2) * 0.7;
            this.box(group, px, 0.25, pz, 1.35, h, 0.72, facade, 0.035);
            this.box(group, px, h + 0.25, pz, 1.35, 0.08, 0.72, metal);
            this.box(group, px, h + 0.34, pz, 0.95, 0.018, 0.06, glow);
          }
      } else if (unit === "control") {
        this.box(group, 0, 0, 0, 7, 0.3, 7, dark);
        this.box(group, 0, 0.3, 0, 3.4, 8, 3.7, facade, 0.1);
        this.box(group, -2.3, 0.3, 0.8, 1.8, 5.4, 4, metal, 0.07);
        this.box(group, 2.1, 0.3, 1.1, 1.4, 6.2, 3.3, facade, 0.07);
        for (let n = 0; n < 9; n++)
          this.box(group, 0, 1 + n * 0.8, 1.92, 3.3, 0.045, 0.045, glow);
        this.box(group, 0, 8.3, 0, 3.5, 0.18, 3.8, dark);
        this.box(group, 0.7, 8.48, 0, 0.06, 1.8, 0.06, glow);
      } else if (unit === "alu") {
        this.box(group, 0, 0, 0, 8, 0.5, 7, dark, 0.12);
        this.box(group, 0, 0.5, 0, 5.2, 4.6, 4.6, facade, 0.1);
        for (let n = 0; n < 5; n++) {
          this.box(group, 0, 0.7 + n * 0.88, 0, 5.65, 0.16, 5.1, metal, 0.04);
          this.box(group, 0, 0.9 + n * 0.88, 2.57, 5.3, 0.035, 0.035, glow);
        }
        this.box(group, 0, 5.1, 0, 5.8, 0.28, 5.2, metal, 0.06);
        for (let n = 0; n < 4; n++) {
          this.box(group, -1.9 + n * 1.25, 5.38, 0, 0.8, 0.9, 3.3, dark, 0.06);
          this.box(group, -1.9 + n * 1.25, 6.3, 0, 0.05, 0.025, 3.1, glow);
        }
        for (let n = 0; n < 6; n++) {
          this.box(group, -3.25, 0.5, -2.5 + n, 0.6, 2.6, 0.55, metal, 0.04);
          this.box(group, 3.25, 0.5, -2.5 + n, 0.6, 2.6, 0.55, metal, 0.04);
        }
      } else {
        this.box(group, 0, 0, 0, 8, 0.25, 12, dark);
        for (let z = 0; z < 4; z++)
          for (let x = 0; x < 3; x++) {
            const px = -2.55 + x * 2.55,
              pz = -4.3 + z * 2.8;
            this.box(group, px, 0.25, pz, 1.7, 3.8, 2.1, facade, 0.06);
            this.box(group, px, 4.05, pz, 1.9, 0.13, 2.3, metal, 0.03);
            this.box(group, px - 0.85, 0.6, pz + 1.1, 0.025, 3.1, 0.025, glow);
          }
      }
      const label = document.createElement("button");
      label.className = "world-label";
      label.style.setProperty("--unit-color", def.color);
      label.innerHTML = `<span class="world-label-dot"></span><span>${def.name}</span><span class="world-label-arrow">↗</span>`;
      label.setAttribute("aria-label", `Explorar ${def.name.toUpperCase()}`);
      label.onclick = () => {
        this.onSelect(unit);
        this.focus(unit);
      };
      this.container.append(label);
      this.labels.set(unit, label);
    }
    for (let n = 0; n < 110; n++) {
      const side = n % 4,
        t = -15 + (Math.floor(n / 4) % 28) * 1.1,
        x = side < 2 ? t : side === 2 ? -15 : 15,
        z = side >= 2 ? t : side === 0 ? -15 : 15,
        h = 0.45 + rand() * 1.4;
      this.box(this.innerCity, x, 0.3, z, 0.6, h, 0.6, n % 3 ? metal : facade);
    }
    for (let n = 0; n < 35; n++) {
      const x = -13 + n * 0.8,
        z = 11 + (n % 3) * 1.3,
        h = 0.5 + rand() * 1.2;
      this.box(this.innerCity, x, 0.3, z, 0.55, h, 0.8, facade);
    }
    const paths: { unit: Unit; points: number[][] }[] = [
      {
        unit: "registers",
        points: [
          [-6, 1, 2],
          [-4, 1, 2],
          [-3, 1, 0],
        ],
      },
      {
        unit: "alu",
        points: [
          [1, 1, 4],
          [1, 1, 7],
          [-10, 1, 7],
        ],
      },
      {
        unit: "control",
        points: [
          [-1, 1, -10],
          [1, 1, -10],
          [1, 1, -4],
        ],
      },
      {
        unit: "memory",
        points: [
          [5, 1, 0],
          [7, 1, 0],
          [7, 1, 5],
        ],
      },
    ];
    const warm = new THREE.PointLight("#e8a35f", 55, 18, 2);
    warm.position.set(2, 5, 3);
    this.innerCity.add(warm);
    const cool = new THREE.PointLight("#6fb1cd", 42, 17, 2);
    cool.position.set(-9, 4, 0);
    this.innerCity.add(cool);
    const particle = new THREE.SphereGeometry(0.065, 5, 4);
    for (const { unit, points } of paths) {
      const curve = new THREE.CatmullRomCurve3(
        points.map(
          (p) => new THREE.Vector3(...(p as [number, number, number])),
        ),
        false,
        "centripetal",
      );
      this.innerCity.add(
        new THREE.Mesh(
          new THREE.TubeGeometry(curve, 24, 0.018, 4, false),
          new THREE.MeshBasicMaterial({
            color: UNITS[unit].color,
            transparent: true,
            opacity: 0.5,
          }),
        ),
      );
      for (let n = 0; n < 5; n++) {
        const mesh = new THREE.Mesh(
          particle,
          new THREE.MeshBasicMaterial({
            color: new THREE.Color(UNITS[unit].color).multiplyScalar(2),
          }),
        );
        this.innerCity.add(mesh);
        this.signals.push({ mesh, curve, unit, offset: n / 5 });
      }
    }
  }
  private batch(root: THREE.Object3D, exclude: Set<THREE.Object3D>) {
    root.updateWorldMatrix(true, true);
    const inverse = root.matrixWorld.clone().invert(),
      batches = new Map<THREE.Material, THREE.Mesh[]>();
    const visit = (object: THREE.Object3D) => {
      if (exclude.has(object)) return;
      if (
        object instanceof THREE.Mesh &&
        !(object instanceof THREE.InstancedMesh) &&
        !Array.isArray(object.material)
      ) {
        const meshes = batches.get(object.material) ?? [];
        meshes.push(object);
        batches.set(object.material, meshes);
      }
      object.children.forEach(visit);
    };
    root.children.forEach(visit);
    for (const [material, meshes] of batches) {
      if (meshes.length < 2) continue;
      const geometries = meshes.map((mesh) =>
        mesh.geometry
          .clone()
          .applyMatrix4(inverse.clone().multiply(mesh.matrixWorld)),
      );
      const normalized = geometries.map((g) =>
          g.index ? g.toNonIndexed() : g,
        ),
        merged = mergeGeometries(normalized);
      new Set([...geometries, ...normalized]).forEach((g) => g.dispose());
      if (!merged) continue;
      meshes.forEach((mesh) => {
        mesh.removeFromParent();
        mesh.geometry.dispose();
      });
      const mesh = new THREE.Mesh(merged, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      root.add(mesh);
    }
  }
  private homePosition() {
    return new THREE.Vector3(54, 66, 67).multiplyScalar(
      Math.min(1.2, Math.max(1, 1.15 / this.camera.aspect)),
    );
  }
  private move(position: THREE.Vector3, look: THREE.Vector3) {
    this.targetOrbit = null;
    this.targetPosition = position;
    this.targetLook = look;
    if (this.reduced) {
      this.camera.position.copy(position);
      this.controls.target.copy(look);
      this.targetPosition = null;
      this.targetLook = null;
    }
  }
  rotate(horizontal: number, vertical: number) {
    const orbit =
      this.targetOrbit?.clone() ??
      new THREE.Spherical().setFromVector3(
        this.camera.position.clone().sub(this.controls.target),
      );
    orbit.theta += horizontal;
    orbit.phi = THREE.MathUtils.clamp(
      orbit.phi + vertical,
      this.controls.minPolarAngle,
      this.controls.maxPolarAngle,
    );
    this.turnTo(orbit);
  }
  setPanMode(enabled: boolean) {
    this.controls.mouseButtons.LEFT = enabled
      ? THREE.MOUSE.PAN
      : THREE.MOUSE.ROTATE;
    this.controls.touches.ONE = enabled ? THREE.TOUCH.PAN : THREE.TOUCH.ROTATE;
    this.renderer.domElement.style.cursor = enabled ? "move" : "grab";
  }
  zoom(inward: boolean) {
    const offset = this.camera.position.clone().sub(this.controls.target);
    const distance = THREE.MathUtils.clamp(
      offset.length() * (inward ? 0.8 : 1.25),
      this.controls.minDistance,
      this.controls.maxDistance,
    );
    this.move(
      this.controls.target.clone().add(offset.setLength(distance)),
      this.controls.target.clone(),
    );
  }
  angle(view: string) {
    const orbit = new THREE.Spherical().setFromVector3(
      this.camera.position.clone().sub(this.controls.target),
    );
    if (view === "top") orbit.phi = this.controls.minPolarAngle;
    else if (view === "front") {
      orbit.theta = 0;
      orbit.phi = 1.3;
    } else if (view === "side") {
      orbit.theta = Math.PI / 2;
      orbit.phi = 1.3;
    } else {
      orbit.theta = Math.PI / 4;
      orbit.phi = 0.85;
    }
    this.turnTo(orbit);
  }
  private turnTo(orbit: THREE.Spherical) {
    this.targetPosition = null;
    this.targetLook = null;
    this.targetOrbit = orbit;
    if (this.reduced) {
      this.camera.position
        .copy(this.controls.target)
        .add(new THREE.Vector3().setFromSpherical(orbit));
      this.targetOrbit = null;
    }
  }
  surface() {
    this.focusedUnit = null;
    this.controls.minDistance = 20;
    this.move(this.homePosition(), new THREE.Vector3(0, 3, 0));
  }
  focus(unit?: Unit) {
    this.focusedUnit = unit ?? null;
    this.updateZoomLimit();
    const look = unit
      ? new THREE.Vector3(...UNITS[unit].position)
      : new THREE.Vector3(0, 4, 0);
    const offset = new THREE.Vector3(12, 12, 16)
      .normalize()
      .multiplyScalar(this.controls.minDistance * 1.25);
    this.move(
      unit ? look.clone().add(offset) : new THREE.Vector3(27, 32, 34),
      look,
    );
  }
  private updateZoomLimit() {
    if (!this.focusedUnit) {
      this.controls.minDistance = 20;
      return;
    }
    const radii: Record<Unit, number> = {
      alu: 6.3,
      control: 6.9,
      registers: 7,
      memory: 7.5,
    };
    const halfVertical = THREE.MathUtils.degToRad(this.camera.fov / 2);
    const halfFov = Math.min(
      halfVertical,
      Math.atan(Math.tan(halfVertical) * this.camera.aspect),
    );
    this.controls.minDistance = Math.min(
      60,
      (radii[this.focusedUnit] / Math.sin(halfFov)) * 1.08,
    );
  }
  setState(state: Snapshot) {
    this.active = state.active;
    for (const [unit, label] of this.labels)
      label.classList.toggle("is-active", this.active.includes(unit));
  }
  setSignals(show: boolean) {
    this.signalsVisible = show;
  }
  setLabels(show: boolean) {
    this.labelsVisible = show;
  }
  setQuality(high: boolean) {
    this.highQuality = high;
    this.renderer.setPixelRatio(high ? Math.min(devicePixelRatio, 2) : 1);
    this.bloom.enabled = high;
    this.renderer.shadowMap.enabled = high;
    this.renderer.shadowMap.needsUpdate = true;
    this.resize();
  }
  private resize() {
    const { width, height } = this.container.getBoundingClientRect();
    if (!width || !height) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.updateZoomLimit();
    this.renderer.setSize(width, height);
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(width, height);
  }
  private tick = () => {
    this.animation = 0;
    if (document.hidden || this.dead) return;
    const raw = this.clock.getDelta(),
      dt = Math.min(raw, 0.1);
    this.time += dt;
    if (this.targetPosition && this.targetLook) {
      const a = 1 - Math.exp(-dt * 3);
      this.camera.position.lerp(this.targetPosition, a);
      this.controls.target.lerp(this.targetLook, a);
      if (this.camera.position.distanceTo(this.targetPosition) < 0.015) {
        this.targetPosition = null;
        this.targetLook = null;
      }
    }
    if (this.targetOrbit) {
      const current = new THREE.Spherical().setFromVector3(
        this.camera.position.clone().sub(this.controls.target),
      );
      const delta =
        THREE.MathUtils.euclideanModulo(
          this.targetOrbit.theta - current.theta + Math.PI,
          Math.PI * 2,
        ) - Math.PI;
      const a = 1 - Math.exp(-dt * 6);
      current.theta += delta * a;
      current.phi = THREE.MathUtils.lerp(current.phi, this.targetOrbit.phi, a);
      current.radius = this.targetOrbit.radius;
      this.camera.position
        .copy(this.controls.target)
        .add(new THREE.Vector3().setFromSpherical(current));
      if (
        Math.abs(delta) < 0.001 &&
        Math.abs(current.phi - this.targetOrbit.phi) < 0.001
      )
        this.targetOrbit = null;
    }
    this.controls.update();
    const distance = this.camera.position.distanceTo(this.controls.target),
      depth = THREE.MathUtils.clamp((104 - distance) / 55, 0, 1),
      reveal = smooth(0.12, 0.9, depth);
    this.cover.visible = reveal < 0.999;
    this.cover.traverse((object) => {
      if (object instanceof THREE.Mesh)
        object.castShadow = !object.userData.decal && reveal < 0.08;
    });
    this.lids.forEach((m) => {
      m.opacity = 1 - reveal;
      m.depthWrite = reveal < 0.08;
    });
    this.innerCity.visible = depth > 0.12;
    this.innerCity.scale.y = 0.08 + 0.92 * smooth(0.15, 0.9, depth);
    const extent = depth > 0.7 ? 25 : 65;
    if (extent !== this.shadowExtent) {
      this.shadowExtent = extent;
      Object.assign(this.sun.shadow.camera, {
        left: -extent,
        right: extent,
        top: extent,
        bottom: -extent,
      });
      this.sun.shadow.camera.updateProjectionMatrix();
      this.renderer.shadowMap.needsUpdate = true;
    }
    if (Math.abs(reveal - this.previousReveal) > 0.002) {
      this.renderer.shadowMap.needsUpdate = true;
      this.previousReveal = reveal;
    }
    this.bloom.strength = 0.08 + 0.32 * depth;
    this.scene.environmentIntensity = 0.68 - 0.33 * depth;
    this.sun.intensity = 3.4 - 2.7 * depth;
    this.bokeh.enabled = this.highQuality && depth < 0.15;
    (this.bokeh.uniforms as Record<string, { value: number }>).focus.value =
      distance;
    (this.scene.fog as THREE.FogExp2).density = 0.0037 + 0.008 * depth;
    const q = Math.round(depth * 100);
    if (q !== this.lastDepth) {
      this.lastDepth = q;
      this.onDepth(depth);
    }
    for (const [unit, mat] of this.unitMaterials) {
      const target = this.active.includes(unit) ? 2.2 : 0.55;
      mat.emissiveIntensity = THREE.MathUtils.lerp(
        mat.emissiveIntensity,
        target,
        1 - Math.exp(-dt * 7),
      );
    }
    for (const s of this.signals) {
      s.mesh.visible = this.signalsVisible && this.active.includes(s.unit);
      if (s.mesh.visible)
        s.mesh.position.copy(
          s.curve.getPointAt(
            this.reduced ? s.offset : (this.time * 0.15 + s.offset) % 1,
          ),
        );
    }
    const { width, height } = this.container.getBoundingClientRect();
    for (const [unit, label] of this.labels) {
      const p = UNITS[unit].position,
        projected = new THREE.Vector3(
          p[0],
          unit === "control" ? 14 : unit === "alu" ? 11 : 9,
          p[2],
        ).project(this.camera),
        x = (projected.x * 0.5 + 0.5) * width,
        y = (-projected.y * 0.5 + 0.5) * height;
      label.hidden =
        !this.labelsVisible ||
        depth < 0.7 ||
        projected.z > 1 ||
        x < 40 ||
        x > width - 50 ||
        y < 100 ||
        y > height - 50;
      label.style.transform = `translate(${x}px,${y}px) translate(-50%,-100%)`;
    }
    this.composer.render();
    this.elapsed += raw;
    this.frames++;
    if (this.elapsed >= 1) {
      this.onFps(Math.round(this.frames / this.elapsed));
      this.elapsed = 0;
      this.frames = 0;
    }
    this.animation = requestAnimationFrame(this.tick);
  };
  dispose() {
    this.dead = true;
    cancelAnimationFrame(this.animation);
    this.observer.disconnect();
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.renderer.domElement.removeEventListener("wheel", this.onWheel, true);
    this.controls.dispose();
    const geometries = new Set<THREE.BufferGeometry>(),
      materials = new Set<THREE.Material>();
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
        geometries.add(object.geometry);
        (Array.isArray(object.material)
          ? object.material
          : [object.material]
        ).forEach((m) => materials.add(m));
      }
    });
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    this.textures.forEach((t) => t.dispose());
    this.environment.dispose();
    this.composer.dispose();
    this.renderer.dispose();
  }
}
