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
