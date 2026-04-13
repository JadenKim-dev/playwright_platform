import { MikroORM } from '@mikro-orm/mysql';
import config from '../../mikro-orm.config.js';

let ormPromise: Promise<MikroORM> | null = null;

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
