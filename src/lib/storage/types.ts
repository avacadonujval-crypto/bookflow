export interface StoredObject {
  key: string;
  url: string;
  contentType: string;
  size: number;
}

export interface StorageAdapter {
  upload(params: {
    key: string;
    data: Buffer | Uint8Array;
    contentType: string;
  }): Promise<StoredObject>;
  delete(key: string): Promise<void>;
  getPublicUrl(key: string): string;
}
