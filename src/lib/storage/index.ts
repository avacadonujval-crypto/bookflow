import { BlobStorageAdapter } from "./blob";
import { LocalStorageAdapter } from "./local";
import type { StorageAdapter } from "./types";

let adapter: StorageAdapter | null = null;

export function getStorage(): StorageAdapter {
  if (!adapter) {
    adapter = process.env.BLOB_READ_WRITE_TOKEN
      ? new BlobStorageAdapter()
      : new LocalStorageAdapter();
  }
  return adapter;
}

export type { StorageAdapter, StoredObject } from "./types";
