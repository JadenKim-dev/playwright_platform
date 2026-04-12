export interface PlatformEnv {
  runId: string;
  itemId: string;
  adminUrl: string;
  internalApiToken: string;
  reporterChunkSize: number;
  reporterFlushIntervalMs: number;
}

const DEFAULT_CHUNK_SIZE = 50;
const DEFAULT_FLUSH_INTERVAL_MS = 2000;

function required(source: NodeJS.ProcessEnv, key: string): string {
  const value = source[key];
  if (!value) throw new Error(`Missing required env: ${key}`);
  return value;
}

function parseInt(value: string | undefined, fallback: number, key: string): number {
  if (value === undefined || value === '') return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error(`Invalid numeric env ${key}: ${value}`);
  return n;
}

export function loadPlatformEnv(source: NodeJS.ProcessEnv = process.env): PlatformEnv {
  return {
    runId: required(source, 'PLATFORM_RUN_ID'),
    itemId: required(source, 'PLATFORM_ITEM_ID'),
    adminUrl: required(source, 'PLATFORM_ADMIN_URL'),
    internalApiToken: required(source, 'PLATFORM_INTERNAL_API_TOKEN'),
    reporterChunkSize: parseInt(source.PLATFORM_REPORTER_CHUNK_SIZE, DEFAULT_CHUNK_SIZE, 'PLATFORM_REPORTER_CHUNK_SIZE'),
    reporterFlushIntervalMs: parseInt(
      source.PLATFORM_REPORTER_FLUSH_INTERVAL_MS,
      DEFAULT_FLUSH_INTERVAL_MS,
      'PLATFORM_REPORTER_FLUSH_INTERVAL_MS',
    ),
  };
}
