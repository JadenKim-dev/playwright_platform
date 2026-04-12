import { z } from 'zod/v4';

export interface PlatformEnv {
  runId: string;
  itemId: string;
  adminUrl: string;
  internalApiToken: string;
  reporterChunkSize: number;
  reporterFlushIntervalMs: number;
}

const requiredString = z.string().min(1);
const numberWithDefault = (fallback: number) =>
  z.preprocess((v) => (v === undefined || v === '' ? fallback : Number(v)), z.number());

const schema = z.object({
  PLATFORM_RUN_ID: requiredString,
  PLATFORM_ITEM_ID: requiredString,
  PLATFORM_ADMIN_URL: requiredString,
  PLATFORM_INTERNAL_API_TOKEN: requiredString,
  PLATFORM_REPORTER_CHUNK_SIZE: numberWithDefault(50),
  PLATFORM_REPORTER_FLUSH_INTERVAL_MS: numberWithDefault(2000),
});

export function loadPlatformEnv(source: NodeJS.ProcessEnv = process.env): PlatformEnv {
  const result = schema.safeParse(source);
  if (!result.success) {
    const [issue] = result.error.issues;
    if (!issue) throw new Error('Invalid env');
    throw new Error(`Invalid env ${issue.path.join('.')}: ${issue.message}`);
  }
  const parsed = result.data;
  return {
    runId: parsed.PLATFORM_RUN_ID,
    itemId: parsed.PLATFORM_ITEM_ID,
    adminUrl: parsed.PLATFORM_ADMIN_URL,
    internalApiToken: parsed.PLATFORM_INTERNAL_API_TOKEN,
    reporterChunkSize: parsed.PLATFORM_REPORTER_CHUNK_SIZE,
    reporterFlushIntervalMs: parsed.PLATFORM_REPORTER_FLUSH_INTERVAL_MS,
  };
}
