import {
  test as defaultTest,
  type PlaywrightTestArgs,
  type PlaywrightTestOptions,
  type PlaywrightWorkerArgs,
  type PlaywrightWorkerOptions,
} from '@playwright/test';
import type { ResolvedTestCaseDto } from '@platform/shared';
import { AdminClient } from './client.js';
import { loadPlatformEnv, type PlatformEnv } from './env.js';

export interface PlatformFixtures {
  params: Record<string, unknown>;
  expected: Record<string, unknown>;
}

export type PlaywrightFixtures = PlaywrightTestArgs &
  PlaywrightTestOptions &
  PlaywrightWorkerArgs &
  PlaywrightWorkerOptions;

export type TestCaseCallback = (args: PlaywrightFixtures & PlatformFixtures) => Promise<void> | void;

export interface TestCaseDeps {
  test: typeof defaultTest;
  createClient: (env: PlatformEnv) => AdminClient;
  loadEnv: () => PlatformEnv;
}

export function createTestCase(deps: TestCaseDeps) {
  return function testCase(id: string, fn: TestCaseCallback): void {
    deps.test(id, async (fixtures) => {
      const env = deps.loadEnv();
      const client = deps.createClient(env);
      let resolved: ResolvedTestCaseDto | undefined;
      await deps.test.step(`resolve test case ${id}`, async () => {
        resolved = await client.resolve(id);
      });
      await fn({ ...fixtures, params: resolved!.params, expected: resolved!.expected });
    });
  };
}

export const testCase = createTestCase({
  test: defaultTest,
  createClient: (env) =>
    new AdminClient({
      adminUrl: env.adminUrl,
      runId: env.runId,
      internalApiToken: env.internalApiToken,
    }),
  loadEnv: () => loadPlatformEnv(),
});
