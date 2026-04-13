import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { startMysqlHarness, type MysqlHarness } from './setup-mysql.js';
import { TestCase } from '../../src/entities/test-case.entity.js';

let harness: MysqlHarness;

beforeAll(async () => {
  harness = await startMysqlHarness();
});

afterAll(async () => {
  await harness.stop();
});

beforeEach(async () => {
  await harness.reset();
});

async function seedTestCase(id: string, name: string, tags: string[] = []): Promise<void> {
  const em = harness.orm.em.fork();
  const tc = em.create(
    TestCase,
    { id, name, params: {}, expected: {}, tags, autoCreated: true },
    { partial: true },
  );
  await em.persistAndFlush(tc);
}

describe('GET /api/test-cases', () => {
  it('returns empty list when DB is empty', async () => {
    const { GET } = await import('../../src/app/api/test-cases/route.js');
    const res = await GET(new NextRequest('http://localhost/api/test-cases'));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.total).toBe(0);
    expect(body.items).toEqual([]);
  });

  it('returns seeded TC with isActive=false (no successful deployment)', async () => {
    await seedTestCase('TC-1', 'cart');
    const { GET } = await import('../../src/app/api/test-cases/route.js');
    const res = await GET(new NextRequest('http://localhost/api/test-cases'));
    const body = await res.json();
    expect(body.total).toBe(1);
    expect(body.items[0]?.id).toBe('TC-1');
    expect(body.items[0]?.isActive).toBe(false);
  });

  it('q parameter filters by id/name', async () => {
    await seedTestCase('TC-1', 'cart');
    await seedTestCase('TC-2', 'checkout');
    const { GET } = await import('../../src/app/api/test-cases/route.js');
    const res = await GET(new NextRequest('http://localhost/api/test-cases?q=cart'));
    const body = await res.json();
    expect(body.items.map((t: { id: string }) => t.id)).toEqual(['TC-1']);
  });
});

describe('GET /api/test-cases/:id', () => {
  it('returns the TC when it exists', async () => {
    await seedTestCase('TC-1', 'cart');
    const { GET } = await import('../../src/app/api/test-cases/[id]/route.js');
    const res = await GET(new NextRequest('http://localhost/api/test-cases/TC-1'), { params: { id: 'TC-1' } });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.id).toBe('TC-1');
  });

  it('returns 404 when missing', async () => {
    const { GET } = await import('../../src/app/api/test-cases/[id]/route.js');
    const res = await GET(new NextRequest('http://localhost/api/test-cases/X'), { params: { id: 'X' } });
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/test-cases/:id', () => {
  it('updates name', async () => {
    await seedTestCase('TC-1', 'old');
    const { PATCH } = await import('../../src/app/api/test-cases/[id]/route.js');
    const req = new NextRequest('http://localhost/api/test-cases/TC-1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'new' }),
    });
    const res = await PATCH(req, { params: { id: 'TC-1' } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe('new');
  });

  it('rejects bad payload with 400', async () => {
    await seedTestCase('TC-1', 'x');
    const { PATCH } = await import('../../src/app/api/test-cases/[id]/route.js');
    const req = new NextRequest('http://localhost/api/test-cases/TC-1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tags: 'nope' }),
    });
    const res = await PATCH(req, { params: { id: 'TC-1' } });
    expect(res.status).toBe(400);
  });
});
