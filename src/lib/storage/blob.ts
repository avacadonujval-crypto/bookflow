import { del, put } from "@vercel/blob";
import type { StorageAdapter, StoredObject } from "./types";

/**
 * Production storage for Vercel — files persist across deploys.
 * Requires BLOB_READ_WRITE_TOKEN.
 */
export class BlobStorageAdapter implements StorageAdapter {
  async upload(params: {
    key: string;
    data: Buffer | Uint8Array;
    contentType: string;
  }): Promise<StoredObject> {
    const body = Buffer.isBuffer(params.data)
      ? params.data
      : Buffer.from(params.data);

    const result = await put(params.key, body, {
      access: "public",
      contentType: params.contentType,
      addRandomSuffix: false,
      allowOverwrite: true,
    });

    return {
      key: params.key,
      url: result.url,
      contentType: params.contentType,
      size: body.byteLength,
    };
  }

  async delete(keyOrUrl: string): Promise<void> {
    try {
      // Vercel Blob delete accepts the public URL.
      const url =
        keyOrUrl.startsWith("http://") || keyOrUrl.startsWith("https://")
          ? keyOrUrl
          : undefined;
      if (url) {
        await del(url);
      } else {
        // Best-effort: construct is not needed if we always store full URLs.
        await del(keyOrUrl);
      }
    } catch {
      // ignore missing / already deleted
    }
  }

  getPublicUrl(key: string): string {
    // Uploads return absolute blob URLs; this is only a fallback key path.
    return key;
  }
}
