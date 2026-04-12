export const ReporterEventType = {
  TestBegin: 'test_begin',
  TestEnd: 'test_end',
  StepBegin: 'step_begin',
  StepEnd: 'step_end',
  Stdout: 'stdout',
  Stderr: 'stderr',
} as const;
export type ReporterEventType = (typeof ReporterEventType)[keyof typeof ReporterEventType];
