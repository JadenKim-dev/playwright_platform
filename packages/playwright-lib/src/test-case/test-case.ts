import {
  test as defaultTest,
  type PlaywrightTestArgs,
  type PlaywrightTestOptions,
  type PlaywrightWorkerArgs,
  type PlaywrightWorkerOptions,
} from '@playwright/test';
import type { ResolvedTestCaseDto } from '@platform/shared';
import { AdminClient } from '../admin/admin-client.js';
import { loadPlatformEnv, type PlatformEnv } from '../env/platform-env.js';

export type PlaywrightFixtures = PlaywrightTestArgs &
  PlaywrightTestOptions &
  PlaywrightWorkerArgs &
  PlaywrightWorkerOptions;

export interface PlatformFixtures {
  params: Record<string, unknown>;
  expected: Record<string, unknown>;
}

export type TestCaseCallback = (
  args: PlaywrightFixtures & PlatformFixtures,
) => Promise<void> | void;

export interface CreateTestCaseOptions {
  test: typeof defaultTest;
  createAdminClient: (env: PlatformEnv) => AdminClient;
  loadPlatformEnv: () => PlatformEnv;
}

/**
 * Factory that builds a `testCase` function from the given dependencies.
 *
 * The returned function wraps Playwright's `test()`: it resolves the case
 * against the Admin server by id, then merges `params`/`expected` into the
 * fixtures passed to the user callback.
 */
export function createTestCase({
  test,
  createAdminClient,
  loadPlatformEnv,
}: CreateTestCaseOptions) {
  return function testCase(id: string, fn: TestCaseCallback): void {
    test(id, async (fixtures) => {
      const env = loadPlatformEnv();
      const client = createAdminClient(env);
      let resolved: ResolvedTestCaseDto | undefined;
      await test.step(`resolve test case ${id}`, async () => {
        resolved = await client.resolve(id);
      });
      await fn({ ...fixtures, params: resolved!.params, expected: resolved!.expected });
    });
  };
}

/**
 * Default production `testCase` instance.
 *
 * Wired with Playwright's `test`, the real `AdminClient`, and `loadPlatformEnv`.
 * Use it directly in test files:
 * `testCase(id, async ({ params, expected, page }) => { ... })`.
 */
export const testCase = createTestCase({
  test: defaultTest,
  createAdminClient: (env) =>
    new AdminClient({
      adminUrl: env.adminUrl,
      runId: env.runId,
      itemId: env.itemId,
      internalApiToken: env.internalApiToken,
    }),
  loadPlatformEnv,
});
