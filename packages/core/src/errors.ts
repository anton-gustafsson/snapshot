/**
 * Typed errors, so a caller can branch on *why* a capture failed instead of
 * string-matching a prose message. Every rejection thrown by the library
 * extends `SnapshotError`.
 */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** The element passed to `capture()` was removed from the document before the render started. */
export class SnapshotDetachedElementError extends SnapshotError {
  constructor(readonly id: string) {
    super(
      `SnapshotService: the element for "${id}" is not connected to the document — ` +
        'it was removed (e.g. the view was destroyed) before the capture could run.',
    );
  }
}

/** `canvas.toBlob()` resolved null — tainted (cross-origin) content, or a zero-size element. */
export class SnapshotTaintedCanvasError extends SnapshotError {
  constructor(readonly id: string) {
    super(
      `SnapshotService: canvas.toBlob() returned null while capturing "${id}" — the element likely ` +
        'contains tainted (cross-origin, no CORS headers) content, or has zero size.',
    );
  }
}

/** A blob exceeded a configured `maxBytes` cap (see `CachedSnapshotStorage`). */
export class SnapshotTooLargeError extends SnapshotError {
  constructor(
    readonly size: number,
    readonly maxBytes: number,
  ) {
    super(`Snapshot is ${size} bytes, above the configured maxBytes of ${maxBytes} — not uploaded.`);
  }
}
