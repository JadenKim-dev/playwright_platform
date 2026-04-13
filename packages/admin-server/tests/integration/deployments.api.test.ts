import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { startMysqlHarness, type MysqlHarness } from './setup-mysql.js';
import {
  setContainerOverrides,
  resetContainerOverrides,
} from '../../src/container.js';
import { NoopDeployTrigger } from '../../src/deploy/deploy-trigger.js';
import { Deployment } from '../../src/entities/deployment.entity.js';
import { DeploymentStatus } from '@platform/shared';

let harness: MysqlHarness;
let trigger: NoopDeployTrigger;

beforeAll(async () => {
  harness = await startMysqlHarness();
});

afterAll(async () => {
  await harness.stop();
  resetContainerOverrides();
});

beforeEach(async () => {
  await harness.reset();
  trigger = new NoopDeployTrigger();
  setContainerOverrides({ trigger });
});

describe('POST /api/deployments', () => {
  it('inserts a row, calls trigger, returns 202 with DTO', async () => {
    const { POST } = await import('../../src/app/api/deployments/route.js');
    const req = new NextRequest('http://localhost/api/deployments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ gitRef: 'main' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.gitRef).toBe('main');
    expect(body.status).toBe(DeploymentStatus.Pending);
    expect(trigger.triggers).toHaveLength(1);
    expect(trigger.triggers[0]?.deploymentId).toBe(body.id);

    const em = harness.orm.em.fork();
    const dep = await em.findOne(Deployment, { id: body.id });
    expect(dep?.status).toBe(DeploymentStatus.Pending);
  });

  it('rejects empty gitRef with 400', async () => {
    const { POST } = await import('../../src/app/api/deployments/route.js');
    const req = new NextRequest('http://localhost/api/deployments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ gitRef: '' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(trigger.triggers).toHaveLength(0);
  });
});

describe('GET /api/deployments', () => {
  it('lists seeded deployments', async () => {
    const em = harness.orm.em.fork();
    const dep = em.create(
      Deployment,
      { gitRef: 'main', status: DeploymentStatus.Success } as Partial<Deployment>,
      { partial: true },
    );
    await em.persistAndFlush(dep);

    const { GET } = await import('../../src/app/api/deployments/route.js');
    const res = await GET(new NextRequest('http://localhost/api/deployments'));
    const body = await res.json();
    expect(body.total).toBe(1);
    expect(body.items[0]?.status).toBe(DeploymentStatus.Success);
  });

  it('filters by status', async () => {
    const em = harness.orm.em.fork();
    em.create(
      Deployment,
      { gitRef: 'a', status: DeploymentStatus.Success } as Partial<Deployment>,
      { partial: true },
    );
    em.create(
      Deployment,
      { gitRef: 'b', status: DeploymentStatus.Failed } as Partial<Deployment>,
      { partial: true },
    );
    await em.flush();

    const { GET } = await import('../../src/app/api/deployments/route.js');
    const res = await GET(new NextRequest('http://localhost/api/deployments?status=success'));
    const body = await res.json();
    expect(body.total).toBe(1);
  });
});
