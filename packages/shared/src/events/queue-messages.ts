export interface RunItemExecuteMessage {
  runId: string;
  itemId: string;
  deploymentId: string;
  testCaseId: string;
  testFileBundleKey: string;
  adminBaseUrl: string;
}

export type QueueMessageRoutingKey = 'run.item.execute';

export const ROUTING_KEY_RUN_ITEM_EXECUTE: QueueMessageRoutingKey = 'run.item.execute';

export const EXCHANGE_TEST_RUNS = 'test-runs';
export const QUEUE_TEST_RUN_ITEMS = 'test-run-items';
export const QUEUE_TEST_RUNS_DLQ = 'test-runs-dlq';
