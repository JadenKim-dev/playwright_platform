import { describe, it, expect, expectTypeOf } from 'vitest';
import type {
  ReporterEvent,
  TestBeginEvent,
  TestEndEvent,
  StepBeginEvent,
  StepEndEvent,
  StdoutEvent,
  StderrEvent,
  ReporterEventBatch,
} from '../src/events/reporter-events.js';
import { ReporterEventType, RunItemStatus } from '../src/constants/index.js';

describe('reporter-events types', () => {
  it('TestEndEvent carries final status', () => {
    const ev: TestEndEvent = {
      type: ReporterEventType.TestEnd,
      itemId: 'item-1',
      ts: '2026-04-12T00:00:00.000Z',
      payload: { status: RunItemStatus.Passed, durationMs: 100 },
    };
    expect(ev.payload.status).toBe('passed');
  });

  it('TestBeginEvent has null payload', () => {
    const ev: TestBeginEvent = {
      type: ReporterEventType.TestBegin,
      itemId: 'item-1',
      ts: '2026-04-12T00:00:00.000Z',
      payload: {},
    };
    expect(ev.payload).toEqual({});
  });

  it('StepBeginEvent/StepEndEvent carry title/durationMs', () => {
    const begin: StepBeginEvent = {
      type: ReporterEventType.StepBegin,
      itemId: 'item-1',
      ts: 't',
      payload: { title: 'click button' },
    };
    const end: StepEndEvent = {
      type: ReporterEventType.StepEnd,
      itemId: 'item-1',
      ts: 't',
      payload: { title: 'click button', durationMs: 50 },
    };
    expect(begin.payload.title).toBe('click button');
    expect(end.payload.durationMs).toBe(50);
  });

  it('StdoutEvent/StderrEvent carry text', () => {
    const out: StdoutEvent = {
      type: ReporterEventType.Stdout,
      itemId: 'item-1',
      ts: 't',
      payload: { text: 'hello' },
    };
    const err: StderrEvent = {
      type: ReporterEventType.Stderr,
      itemId: 'item-1',
      ts: 't',
      payload: { text: 'boom' },
    };
    expect(out.payload.text).toBe('hello');
    expect(err.payload.text).toBe('boom');
  });

  it('ReporterEventBatch wraps array of ReporterEvent', () => {
    const batch: ReporterEventBatch = {
      events: [
        {
          type: ReporterEventType.TestBegin,
          itemId: 'item-1',
          ts: 't',
          payload: {},
        },
      ],
    };
    expectTypeOf(batch.events).toEqualTypeOf<ReporterEvent[]>();
    expect(batch.events.length).toBe(1);
  });
});

import type {
  RunItemExecuteMessage,
  QueueMessageRoutingKey,
} from '../src/events/queue-messages.js';

describe('queue-messages', () => {
  it('RunItemExecuteMessage carries identifiers and bundle key', () => {
    const msg: RunItemExecuteMessage = {
      runId: 'run-1',
      itemId: 'item-1',
      deploymentId: 'dep-1',
      testCaseId: 'TC-001',
      testFileBundleKey: 'deployments/dep-1/files/cart.spec.js',
      adminBaseUrl: 'http://admin:3000',
    };
    expect(msg.testCaseId).toBe('TC-001');
  });

  it('routing key constant exists', () => {
    const key: QueueMessageRoutingKey = 'run.item.execute';
    expect(key).toBe('run.item.execute');
  });
});
