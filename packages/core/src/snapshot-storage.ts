import { get, set, del } from 'idb-keyval';

export interface SnapshotStorage {
  save(id: string, blob: Blob): Promise<string>; // returns URL/dataURL to display
  load(id: string): Promise<string | null>;
  remove?(id: string): Promise<void>;
}

/**
 * Default storage: browser-local IndexedDB. Does NOT sync across devices.
 *
 * Blobs are stored natively (IndexedDB supports them directly) instead of
 * base64-encoding into a data URL — that would cost ~33% extra storage and
 * an encode/decode pass on every save/render. Displayable URLs are minted
 * via `URL.createObjectURL`, cached per id so a re-capture of the same id
 * revokes its old URL instead of leaking one per capture.
 */
export class IndexedDbSnapshotStorage implements SnapshotStorage {
  private objectUrls = new Map<string, string>();

  async save(id: string, blob: Blob) {
    await set(`snapshot:${id}`, blob);
    return this.mintObjectUrl(id, blob);
  }

  async load(id: string) {
    const cached = this.objectUrls.get(id);
    if (cached) return cached;
    const blob = await get<Blob>(`snapshot:${id}`);
    return blob ? this.mintObjectUrl(id, blob) : null;
  }

  async remove(id: string) {
    this.revoke(id);
    await del(`snapshot:${id}`);
  }

  private mintObjectUrl(id: string, blob: Blob) {
    this.revoke(id);
    const url = URL.createObjectURL(blob);
    this.objectUrls.set(id, url);
    return url;
  }

  private revoke(id: string) {
    const existing = this.objectUrls.get(id);
    if (existing) {
      URL.revokeObjectURL(existing);
      this.objectUrls.delete(id);
    }
  }
}
