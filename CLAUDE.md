# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es esto

Tetris en JavaScript vanilla (HTML5 Canvas), sin dependencias, sin build, sin tests. Tres archivos: `index.html`, `style.css`, `game.js`.

## Ejecutar

```bash
open index.html                # macOS, directo
python3 -m http.server 8000    # o servidor local, luego http://localhost:8000
```

No hay `package.json`, linter ni test runner configurados. Verificar cambios abriendo el juego en el navegador.

## Arquitectura

Todo el estado y lógica vive en `game.js` como variables globales de módulo (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, etc.) — no hay clases ni módulos separados.

- **Tablero**: matriz `ROWS × COLS` (20×10) donde cada celda es `0` (vacía) o índice de color 1–7.
- **Piezas**: matrices cuadradas en `PIECES`. La rotación (`rotateCW`) transpone + invierte filas; no usa tablas de rotación SRS.
- **Wall kicks** (`tryRotate`): prueba desplazamientos `[0, -1, 1, -2, 2]` antes de descartar el giro.
- **Colisión** (`collide`): única fuente de verdad para límites del tablero y solapamiento con bloques fijados; se reutiliza para movimiento, rotación y cálculo del ghost piece.
- **Game loop** (`loop`): un único `requestAnimationFrame` acumula `dt` y compara contra `dropInterval`; no hay loop de física separado del de render.
- **Flujo de pieza**: `spawn()` mueve `next` → `current` y genera nueva `next`; si la nueva pieza colisiona al aparecer, dispara `endGame()`.
- **Niveles/velocidad**: el nivel sube cada 10 líneas (`clearLines`); `dropInterval = max(100, 1000 - (level-1)*90)`.
- **Rendering**: `draw()` dibuja grid → tablero fijado → ghost piece (alpha 0.2) → pieza actual, en ese orden, todo con el mismo canvas 2D context.

Al modificar `COLS`, `ROWS` o `BLOCK` en `game.js`, hay que actualizar también `width`/`height` del `<canvas id="board">` en `index.html` para que coincidan (`COLS × BLOCK`, `ROWS × BLOCK`).
