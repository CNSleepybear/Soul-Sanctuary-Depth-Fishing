// ===== src/renderer/rendering/Pipeline.ts =====
// CSS pixelated upscale pipeline + letterbox for 400×300 → window.

export class RenderPipeline {
  /** Apply pixelated scaling CSS to the canvas element. */
  static apply(canvas: HTMLCanvasElement): void {
    // REF-4: prefer pixelated for Electron/Chromium; crisp-edges as fallback in CSS
    canvas.classList.add('pixelated');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.objectFit = 'contain';
    canvas.style.display = 'block';
  }

  /** Calculate CSS to letterbox the canvas within the window. */
  static getContainerStyle(windowW: number, windowH: number): Record<string, string> {
    const targetAspect = 400 / 300; // 4:3
    const windowAspect = windowW / windowH;

    if (windowAspect > targetAspect) {
      // Window is wider → letterbox sides
      const scale = windowH / 300;
      const canvasW = Math.floor(400 * scale);
      return {
        width: `${canvasW}px`,
        height: `${windowH}px`,
        margin: '0 auto',
      };
    } else {
      // Window is taller → letterbox top/bottom
      const scale = windowW / 400;
      const canvasH = Math.floor(300 * scale);
      return {
        width: `${windowW}px`,
        height: `${canvasH}px`,
        margin: 'auto 0',
      };
    }
  }
}
