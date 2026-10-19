import { LocalStorageAdapter } from "./local";
import type { StorageAdapter } from "./types";

let adapter: StorageAdapter | null = null;

export function getStorage(): StorageAdapter {
  if (!adapter) {
    adapter = new LocalStorageAdapter();
  }
  return adapter;
}

export type { StorageAdapter, StoredObject } from "./types";
