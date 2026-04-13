import { describe, it, expect } from 'vitest';
import { ReporterEventType, RunItemStatus } from '@platform/shared';
import { ReporterEventFactory } from './reporter-event-factory.js';

const ITEM_ID = 'item-xyz';
const FIXED_TS = '2026-04-13T10:00:00.000Z';
const fixedNow = () => new Date(FIXED_TS);

function makeFactory() {
  return new ReporterEventFactory(ITEM_ID, fixedNow);
}

describe('ReporterEventFactory', () => {
  it('testBegin produces a TestBegin event with itemId and timestamp', () => {
    const ev = makeFactory().testBegin();
    expect(ev).toEqual({
      type: ReporterEventType.TestBegin,
      itemId: ITEM_ID,
      ts: FIXED_TS,
      payload: {},
    });
  });

  it('stepBegin produces a StepBegin event carrying the step title', () => {
    const ev = makeFactory().stepBegin({ title: 'click submit' });
    expect(ev).toEqual({
      type: ReporterEventType.StepBegin,
      itemId: ITEM_ID,
      ts: FIXED_TS,
      payload: { title: 'click submit' },
    });
  });

  it('stepEnd carries title, duration, and optional errorMessage', () => {
    const ev = makeFactory().stepEnd({
      title: 'click submit',
      duration: 12,
      error: { message: 'timeout' },
    });
    expect(ev).toEqual({
      type: ReporterEventType.StepEnd,
      itemId: ITEM_ID,
      ts: FIXED_TS,
      payload: { title: 'click submit', durationMs: 12, errorMessage: 'timeout' },
    });
  });

  it('stepEnd without error leaves errorMessage undefined', () => {
    const ev = makeFactory().stepEnd({ title: 'noop', duration: 0 });
    expect(ev.payload).toEqual({ title: 'noop', durationMs: 0, errorMessage: undefined });
  });

  it('testEnd maps Playwright status to RunItemStatus and includes duration/error', () => {
    const ev = makeFactory().testEnd({
      status: 'failed',
      duration: 99,
      error: { message: 'boom' },
    });
    expect(ev).toEqual({
      type: ReporterEventType.TestEnd,
      itemId: ITEM_ID,
      ts: FIXED_TS,
      payload: { status: RunItemStatus.Failed, durationMs: 99, errorMessage: 'boom' },
    });
  });

  it('stdout converts string chunks into a Stdout event payload', () => {
    const ev = makeFactory().stdout('hello');
    expect(ev).toEqual({
      type: ReporterEventType.Stdout,
      itemId: ITEM_ID,
      ts: FIXED_TS,
      payload: { text: 'hello' },
    });
  });

  it('stderr converts Buffer chunks into a Stderr event payload', () => {
    const ev = makeFactory().stderr(Buffer.from('oops'));
    expect(ev).toEqual({
      type: ReporterEventType.Stderr,
      itemId: ITEM_ID,
      ts: FIXED_TS,
      payload: { text: 'oops' },
    });
  });

  it('mapStatus translates Playwright statuses to RunItemStatus', () => {
    expect(ReporterEventFactory.mapStatus('passed')).toBe(RunItemStatus.Passed);
    expect(ReporterEventFactory.mapStatus('skipped')).toBe(RunItemStatus.Skipped);
    expect(ReporterEventFactory.mapStatus('failed')).toBe(RunItemStatus.Failed);
    expect(ReporterEventFactory.mapStatus('timedOut')).toBe(RunItemStatus.Failed);
    expect(ReporterEventFactory.mapStatus('interrupted')).toBe(RunItemStatus.Failed);
  });

  it('uses the injected now() each call so timestamps reflect real time', () => {
    let counter = 0;
    const advancingNow = () => new Date(`2026-04-13T10:00:0${counter++}.000Z`);
    const factory = new ReporterEventFactory(ITEM_ID, advancingNow);
    const a = factory.testBegin();
    const b = factory.testBegin();
    expect(a.ts).toBe('2026-04-13T10:00:00.000Z');
    expect(b.ts).toBe('2026-04-13T10:00:01.000Z');
  });
});
