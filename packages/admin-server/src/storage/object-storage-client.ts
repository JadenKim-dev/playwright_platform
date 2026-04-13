export interface ObjectStorageClient {
  presignedGetUrl(key: string, expiresInSeconds: number): Promise<string>;
}

export class NoopObjectStorageClient implements ObjectStorageClient {
  async presignedGetUrl(key: string, expiresInSeconds: number): Promise<string> {
    return `noop://object/${encodeURIComponent(key)}?expires=${expiresInSeconds}`;
  }
}
