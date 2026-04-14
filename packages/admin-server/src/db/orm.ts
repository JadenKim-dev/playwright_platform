import { MikroORM, type Options } from '@mikro-orm/mysql';
import config from '../../mikro-orm.config';

let ormPromise: Promise<MikroORM> | null = null;

export function initOrm(overrideConfig?: Partial<Options>): Promise<MikroORM> {
  if (ormPromise) {
    throw new Error('ORM already initialized; call closeOrm() before initOrm().');
  }
  ormPromise = MikroORM.init({ ...config, ...overrideConfig });
  return ormPromise;
}

export function getOrm(): Promise<MikroORM> {
  if (!ormPromise) {
    ormPromise = MikroORM.init(config);
  }
  return ormPromise;
}

export async function closeOrm(): Promise<void> {
  if (!ormPromise) return;
  const orm = await ormPromise;
  await orm.close(true);
  ormPromise = null;
}
