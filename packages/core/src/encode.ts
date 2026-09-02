export type SnapshotImageType = `image/${'png' | 'webp' | 'jpeg'}`;

export interface EncodeOptions {
  /** Output format. Defaults to `image/webp`, falling back to `image/png` where WebP encoding isn't available. */
  type?: SnapshotImageType;
  /** Lossy quality, 0-1. Ignored for `image/png`. Default 0.8. */
  quality?: number;
  /** Longest edge in px — downscales to fit, never upscales. */
  maxEdge?: number;
}

const DEFAULT_TYPE: SnapshotImageType = 'image/webp';
const DEFAULT_QUALITY = 0.8;

function targetSize(width: number, height: number, maxEdge: number | undefined) {
  if (!maxEdge || maxEdge <= 0) return { width, height };
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };
  const ratio = maxEdge / longest;
  return { width: Math.max(1, Math.round(width * ratio)), height: Math.max(1, Math.round(height * ratio)) };
}

/**
 * Re-encodes (and optionally downscales) a snapshot blob off the layout path,
 * via `createImageBitmap` + `OffscreenCanvas` — so a full-resolution PNG from
 * html2canvas becomes a small WebP suitable for a thumbnail or an upload.
 *
 * Deliberately never throws: a browser missing either API, a decode failure, or
 * an encoder that doesn't know the requested type all resolve with the *input*
 * blob. A thumbnail that's bigger than intended beats no thumbnail at all.
 */
export async function encodeSnapshot(blob: Blob, opts: EncodeOptions = {}): Promise<Blob> {
  const type = opts.type ?? DEFAULT_TYPE;
  const quality = opts.quality ?? DEFAULT_QUALITY;

  if (typeof createImageBitmap !== 'function' || typeof OffscreenCanvas !== 'function') return blob;

  let bitmap: ImageBitmap | undefined;
  try {
    bitmap = await createImageBitmap(blob);
    const { width, height } = targetSize(bitmap.width, bitmap.height, opts.maxEdge);
    // Nothing to do: same format already, no downscale needed, and either quality
    // doesn't apply (png) or the caller didn't ask for a specific one — we can't
    // tell what quality the existing blob was actually encoded at, so a caller
    // who *did* specify one always gets a fresh encode at that quality.
    const sameDimsAndType = width === bitmap.width && height === bitmap.height && blob.type === type;
    if (sameDimsAndType && (type === 'image/png' || opts.quality === undefined)) return blob;

    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return blob;
    ctx.drawImage(bitmap, 0, 0, width, height);

    let encoded = await canvas.convertToBlob({ type, quality });
    // Chrome/Safari silently fall back to image/png for a type they can't
    // encode, so trust the *result's* type rather than a feature probe.
    if (encoded.type !== type && type !== 'image/png') {
      encoded = await canvas.convertToBlob({ type: 'image/png' });
    }
    return encoded;
  } catch {
    return blob;
  } finally {
    bitmap?.close();
  }
}
