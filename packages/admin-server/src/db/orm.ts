import { MikroORM, type EntityClass } from '@mikro-orm/mysql';
import config from '../../mikro-orm.config.js';

let ormPromise: Promise<MikroORM> | null = null;

// Overrides apply only on first init per process. Integration tests must call
// closeOrm() before passing a new clientUrl, otherwise the override is ignored.
export function getOrm(overrides?: {
  clientUrl?: string;
  entities?: EntityClass<object>[];
}): Promise<MikroORM> {
  if (!ormPromise) {
    ormPromise = MikroORM.init({
      ...config,
      ...(overrides?.clientUrl ? { clientUrl: overrides.clientUrl } : {}),
      ...(overrides?.entities
        ? // Pass class references directly so Vitest (esbuild) doesn't need to
          // resolve the TS glob through Node's ESM loader, which fails on raw .ts.
          { entities: overrides.entities, entitiesTs: overrides.entities }
        : {}),
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
