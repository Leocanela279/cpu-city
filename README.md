# CPU City

Un procesador explorable en 3D que revela una ciudad al acercar la cámara. Ejecuta ensamblador RISC-V en un Web Worker y sigue cada instrucción hasta el circuito de la ALU.

## Desarrollo

Node.js 22.12 o posterior de la rama 22; la versión se indica en `.nvmrc`.

```sh
npm ci
npm run dev
```

Abrir la URL que imprime Vite. Todos los comandos se ejecutan desde la raíz del repositorio.

```sh
npm test
npm run build
npm run preview
```

## Desplegar en Vercel

El repositorio incluye `vercel.json` y un único lockfile en la raíz. No necesita variables de entorno, base de datos ni servicios de servidor.

1. Sube los archivos del proyecto a tu repositorio de GitHub.
2. En Vercel, selecciona **Add New → Project** e importa `Leocanela279/cpu-city`.
3. Mantén **Root Directory** en la raíz (`./`), no en `app`.
4. El archivo de configuración establece **Framework: Vite**, **Install: npm ci**, **Build: npm run build** y **Output: app/dist**.
5. Pulsa **Deploy**. Los siguientes pushes a la rama de producción actualizarán el sitio si mantienes la integración de Git.

Alternativa desde la raíz con la CLI oficial, iniciando sesión en tu cuenta cuando lo solicite:

```sh
npx vercel
# Después de revisar la URL de preview:
npx vercel --prod
```

URL de producción: https://cpu-city.vercel.app/. Referencia de configuración: https://vercel.com/docs/project-configuration/vercel-json

### Vista previa al compartir

El HTML inicial incluye Open Graph y Twitter Card con título, descripción en español, URL canónica e imagen JPEG de 1200 × 630. No requiere ejecutar JavaScript para leer las etiquetas. La imagen se sirve desde `app/public/og-image.jpg` y se copia a la salida de producción durante el build.

Si se cambia el dominio, hay que actualizar las URL absolutas de `app/index.html`. El diseño original de la portada está en `app/social-preview.html`: con el servidor de desarrollo abierto, visitar `/social-preview.html` y capturar el área de 1200 × 630 para regenerar la imagen. Esta página de diseño no forma parte de la compilación de producción.

### Dependencias en Linux

El lockfile incluye los paquetes opcionales de Rollup y esbuild para todas las plataformas, incluido Linux en Vercel. Al regenerarlo, hacerlo sin un `node_modules` previo para evitar que npm conserve solamente las dependencias nativas del ordenador local.

## Controles

- Arrastrar: rotación orbital. Scroll con dos dedos: desplazamiento horizontal y vertical sin cambiar el zoom. Rueda de ratón: desplazar en vertical; Mayús + rueda: desplazar en horizontal.
- Pellizco en trackpad, Ctrl + rueda o botones **+ / −**: zoom continuo del encapsulado a la ciudad.
- **Desplazar** cambia el arrastre izquierdo a movimiento en paralelo, sin modificar orientación ni zoom. El botón derecho permite desplazar en cualquier modo. En pantallas táctiles, el modo Desplazar permite mover con un dedo.
- Flechas de cámara: girar e inclinar conservando la distancia. Selector de vistas: perspectiva, superior, frontal y lateral.
- **Procesador** vuelve al exterior; **Arquitectura** entra en la ciudad; **Circuito ALU** muestra sus puertas lógicas.
- **Código** abre el editor y los registros; **Datos** abre el inspector.
- Ejecutar/pausar, avanzar un ciclo, completar una instrucción, retroceder hasta 128 ciclos y reiniciar.
- Atajos fuera de los campos y botones: espacio para ejecutar/pausar, derecha para avanzar y izquierda para retroceder.

## Alcance del MVP

- TypeScript, Three.js y Vite. Geometrías agrupadas e instancias para componentes repetidos; materiales PBR, iluminación de entorno, sombras y calidad reducida opcional.
- CPU educativa multiciclo: seis fases por instrucción. 32 registros de 32 bits; x0 es constante. Sumas, restas, lógica, desplazamientos, comparaciones, saltos, LW/SW y EBREAK.
- Ensamblador con codificaciones binarias RV32I, etiquetas, alias, comentarios, y pseudoinstrucciones limitadas. No utiliza `eval` ni ejecuta código nativo del usuario.
- Memoria de datos de 4 KiB separada del programa de solo lectura; instrucciones alineadas a 4 bytes. Errores de ensamblado y accesos inválidos se muestran en la interfaz.
- Circuitos detallados para ADD, SUB, AND, OR y XOR. Los valores y acarreos del sumador proceden de los operandos de la simulación.
- El encapsulado es una representación genérica; la ciudad es una metáfora educativa. No representa la distribución física de un chip comercial ni observa la CPU real del ordenador.
- Todavía no incluye C, cachés, pipeline, sistema operativo ni simulación eléctrica analógica de transistores.

## Archivos

- `app/src/cpu.ts`: ensamblador y máquina determinista.
- `app/src/simulation.worker.ts`: ejecución fuera del hilo de la interfaz.
- `app/src/city.ts`: procesador, placa, ciudad y cámara.
- `app/src/main.ts`: editor, reproducción e inspección de circuitos.
- `app/tests/cpu.test.ts`: pruebas del conjunto de instrucciones, memoria y acarreos.

La compilación produce `app/dist`, incluidos los recursos del Web Worker. WebGL 2 es necesario para la escena 3D; el circuito y el simulador disponen de una alternativa cuando no está disponible. Las fuentes externas tienen alternativas locales.
