import { mkdir, writeFile, unlink } from "fs/promises";
import path from "path";
import type { StorageAdapter, StoredObject } from "./types";

export class LocalStorageAdapter implements StorageAdapter {
  private root: string;

  constructor(root = process.env.UPLOAD_DIR || "uploads") {
    this.root = path.isAbsolute(root)
      ? root
      : path.join(/* turbopackIgnore: true */ process.cwd(), root);
  }

  async upload(params: {
    key: string;
    data: Buffer | Uint8Array;
    contentType: string;
  }): Promise<StoredObject> {
    const fullPath = path.join(this.root, params.key);
    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, params.data);
    return {
      key: params.key,
      url: this.getPublicUrl(params.key),
      contentType: params.contentType,
      size: params.data.byteLength,
    };
  }

  async delete(key: string): Promise<void> {
    const fullPath = path.join(this.root, key);
    try {
      await unlink(fullPath);
    } catch {
      // ignore missing files
    }
  }

  getPublicUrl(key: string): string {
    return `/api/files/${key.split(path.sep).join("/")}`;
  }
}
