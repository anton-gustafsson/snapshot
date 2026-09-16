/**
 * A `<canvas>`-based chart (Chart.js, and most others) typically paints
 * through its own `ResizeObserver` + `requestAnimationFrame` cycle, entirely
 * decoupled from the framework's own change detection — so the tick-plus-
 * one-frame `injectSnapshotCapture()` waits for can still race a chart's own
 * pending redraw. html2canvas only ever copies whatever is currently in a
 * canvas's pixel buffer, so losing that race produces a capture with a fully
 * blank chart: no error, nothing logged, just an empty rectangle where the
 * chart should be.
 *
 * Polls every `<canvas>` under `root` (one requestAnimationFrame per
 * attempt) until each either has non-transparent pixel data or `maxFrames`
 * is exhausted, whichever comes first. Best-effort: a canvas that's still
 * blank after `maxFrames` is left as-is rather than blocking the capture
 * indefinitely — a bad thumbnail isn't worth stalling navigation over. Call
 * this before `capture()`, on the live element (unlike `neutralizeOklchColors`,
 * which needs the clone — this needs the canvas that's actually still
 * painting).
 */
export async function waitForCanvasesToPaint(root: HTMLElement, maxFrames = 6): Promise<void> {
  const canvases = Array.from(root.querySelectorAll('canvas'));
  if (canvases.length === 0) return;

  for (let frame = 0; frame < maxFrames; frame++) {
    if (canvases.every((canvas) => !isBlank(canvas))) return;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
}

function isBlank(canvas: HTMLCanvasElement): boolean {
  if (canvas.width === 0 || canvas.height === 0) return false;

  try {
    // Only 2D canvases can be cheaply inspected this way — a WebGL canvas
    // with `preserveDrawingBuffer: false` reads back as empty regardless of
    // what's on screen, so treat anything non-2D as "can't tell, assume it's
    // fine" rather than waiting forever.
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;

    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    for (let i = 0; i < data.length; i++) {
      if (data[i] !== 0) return false;
    }
    return true;
  } catch {
    // A tainted canvas throws on getImageData — not something this check
    // can resolve either way, so don't block the capture over it.
    return false;
  }
}
