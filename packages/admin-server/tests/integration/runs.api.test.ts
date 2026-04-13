import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { startMysqlHarness, type MysqlHarness } from './setup-mysql.js';
import {
  setContainerOverrides,
  resetContainerOverrides,
} from '../../src/container.js';
import { NoopRunQueuePublisher } from '../../src/queue/run-queue-publisher.js';
import { Deployment } from '../../src/entities/deployment.entity.js';
import { TestCase } from '../../src/entities/test-case.entity.js';
import { TestFile } from '../../src/entities/test-file.entity.js';
import { TestCaseMapping } from '../../src/entities/test-case-mapping.entity.js';
import { TestRun } from '../../src/entities/test-run.entity.js';
import { TestRunItem } from '../../src/entities/test-run-item.entity.js';
import {
  DeploymentStatus,
  RunStatus,
  RunItemStatus,
} from '@platform/shared';

let harness: MysqlHarness;
let publisher: NoopRunQueuePublisher;

beforeAll(async () => {
  harness = await startMysqlHarness();
});

afterAll(async () => {
  await harness.stop();
  resetContainerOverrides();
});

beforeEach(async () => {
  await harness.reset();
  publisher = new NoopRunQueuePublisher();
  setContainerOverrides({ publisher, adminBaseUrl: 'http://admin:3000' });
});

async function seedDeploymentWithTc(): Promise<{ depId: string; tcId: string; fileId: string }> {
  const em = harness.orm.em.fork();
  const dep = em.create(
    Deployment,
    { gitRef: 'main', status: DeploymentStatus.Success, finishedAt: new Date() } as Partial<Deployment>,
    { partial: true },
  );
  const tc = em.create(
    TestCase,
    {
      id: 'TC-1',
      name: 'cart',
      params: { qty: 1 },
      expected: { count: 1 },
      tags: [],
      autoCreated: true,
    },
    { partial: true },
  );
  const file = em.create(
    TestFile,
    {
      deployment: dep,
      sourcePath: 'cart.spec.ts',
      bundleKey: 'deployments/x/files/cart.spec.js',
    } as Partial<TestFile>,
    { partial: true },
  );
  em.create(
    TestCaseMapping,
    { deployment: dep, testCase: tc, testFile: file } as Partial<TestCaseMapping>,
    { partial: true },
  );
  await em.flush();
  return { depId: dep.id, tcId: tc.id, fileId: file.id };
}

describe('POST /api/runs', () => {
  it('inserts run + items with snapshots and publishes per item', async () => {
    const { tcId } = await seedDeploymentWithTc();
    const { POST } = await import('../../src/app/api/runs/route.js');
    const req = new NextRequest('http://localhost/api/runs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ testCaseIds: [tcId] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.status).toBe(RunStatus.Queued);

    const em = harness.orm.em.fork();
    const run = await em.findOne(TestRun, { id: body.id });
    expect(run?.requestedTestCaseIds).toEqual([tcId]);

    const items = await em.find(TestRunItem, { testRun: body.id });
    expect(items).toHaveLength(1);
    expect(items[0]?.paramsSnapshot).toEqual({ qty: 1 });
    expect(items[0]?.expectedSnapshot).toEqual({ count: 1 });
    expect(items[0]?.status).toBe(RunItemStatus.Pending);

    expect(publisher.published).toHaveLength(1);
    expect(publisher.published[0]?.testCaseId).toBe(tcId);
    expect(publisher.published[0]?.adminBaseUrl).toBe('http://admin:3000');
  });

  it('paramOverrides merge into snapshot', async () => {
    const { tcId } = await seedDeploymentWithTc();
    const { POST } = await import('../../src/app/api/runs/route.js');
    const req = new NextRequest('http://localhost/api/runs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ testCaseIds: [tcId], paramOverrides: { [tcId]: { qty: 9 } } }),
    });
    const res = await POST(req);
    const body = await res.json();
    const em = harness.orm.em.fork();
    const items = await em.find(TestRunItem, { testRun: body.id });
    expect(items[0]?.paramsSnapshot).toEqual({ qty: 9 });
  });

  it('returns 409 when no successful deployment', async () => {
    const em = harness.orm.em.fork();
    em.create(
      TestCase,
      {
        id: 'TC-1',
        name: 'x',
        params: {},
        expected: {},
        tags: [],
        autoCreated: true,
      },
      { partial: true },
    );
    await em.flush();
    const { POST } = await import('../../src/app/api/runs/route.js');
    const req = new NextRequest('http://localhost/api/runs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ testCaseIds: ['TC-1'] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(409);
    expect(publisher.published).toHaveLength(0);
  });

  it('rejects unmapped TCs with 400', async () => {
    await seedDeploymentWithTc();
    const em = harness.orm.em.fork();
    em.create(
      TestCase,
      {
        id: 'TC-2',
        name: 'orphan',
        params: {},
        expected: {},
        tags: [],
        autoCreated: true,
      },
      { partial: true },
    );
    await em.flush();
    const { POST } = await import('../../src/app/api/runs/route.js');
    const req = new NextRequest('http://localhost/api/runs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ testCaseIds: ['TC-2'] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(publisher.published).toHaveLength(0);
  });
});

describe('GET /api/runs/:id', () => {
  it('returns run with items', async () => {
    const { tcId } = await seedDeploymentWithTc();
    const { POST } = await import('../../src/app/api/runs/route.js');
    const createRes = await POST(
      new NextRequest('http://localhost/api/runs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ testCaseIds: [tcId] }),
      }),
    );
    const created = await createRes.json();

    const { GET } = await import('../../src/app/api/runs/[id]/route.js');
    const res = await GET(new NextRequest(`http://localhost/api/runs/${created.id}`), {
      params: { id: created.id },
    });
    const body = await res.json();
    expect(body.run.id).toBe(created.id);
    expect(body.items).toHaveLength(1);
  });

  it('returns 404 when missing', async () => {
    const { GET } = await import('../../src/app/api/runs/[id]/route.js');
    const res = await GET(new NextRequest('http://localhost/api/runs/x'), { params: { id: 'x' } });
    expect(res.status).toBe(404);
  });
});

describe('GET /api/runs/:id/report', () => {
  it('returns 404 when reportKey is missing', async () => {
    const { tcId } = await seedDeploymentWithTc();
    const { POST } = await import('../../src/app/api/runs/route.js');
    const create = await POST(
      new NextRequest('http://localhost/api/runs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ testCaseIds: [tcId] }),
      }),
    );
    const created = await create.json();

    const { GET } = await import('../../src/app/api/runs/[id]/report/route.js');
    const res = await GET(new NextRequest(`http://localhost/api/runs/${created.id}/report`), {
      params: { id: created.id },
    });
    expect(res.status).toBe(404);
  });

  it('returns a noop URL when reportKey is set (Phase 3a default)', async () => {
    const { tcId } = await seedDeploymentWithTc();
    const { POST } = await import('../../src/app/api/runs/route.js');
    const create = await POST(
      new NextRequest('http://localhost/api/runs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ testCaseIds: [tcId] }),
      }),
    );
    const created = await create.json();
    const em = harness.orm.em.fork();
    const run = await em.findOneOrFail(TestRun, { id: created.id });
    run.playwrightReportKey = `runs/${created.id}/report/index.html`;
    await em.flush();

    const { GET } = await import('../../src/app/api/runs/[id]/report/route.js');
    const res = await GET(new NextRequest(`http://localhost/api/runs/${created.id}/report`), {
      params: { id: created.id },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toContain('noop://');
  });
});
