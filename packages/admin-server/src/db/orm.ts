import { MikroORM } from '@mikro-orm/mysql';
import config from '../../mikro-orm.config.js';

let ormPromise: Promise<MikroORM> | null = null;

// Overrides apply only on first init per process. Integration tests must call
// closeOrm() before passing a new clientUrl, otherwise the override is ignored.
export function getOrm(overrides?: { clientUrl?: string }): Promise<MikroORM> {
  if (!ormPromise) {
    ormPromise = MikroORM.init({
      ...config,
      ...(overrides?.clientUrl ? { clientUrl: overrides.clientUrl } : {}),
    });
  }
  return ormPromise;
}

export async function closeOrm(): Promise<void> {
  if (!ormPromise) return;
  const orm = await ormPromise;
  await orm.close(true);
  ormPromise = null;
}
