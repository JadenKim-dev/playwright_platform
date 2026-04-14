export interface ObjectStorageClient {
  presignedGetUrl(key: string, expiresInSeconds: number): Promise<string>;
}

/**
 * Deterministic noop URL generator for use before MinIO is wired up.
 * Phase 3b replaces this with an AWS SDK v3 client backed by MinIO.
 */
export class NoopObjectStorageClient implements ObjectStorageClient {
  async presignedGetUrl(key: string, expiresInSeconds: number): Promise<string> {
    return `noop://object/${encodeURIComponent(key)}?expires=${expiresInSeconds}`;
  }
}
