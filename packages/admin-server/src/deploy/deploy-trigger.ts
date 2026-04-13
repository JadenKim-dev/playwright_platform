export interface DeployTriggerInput {
  deploymentId: string;
  gitRef: string;
}

export interface DeployTrigger {
  trigger(input: DeployTriggerInput): Promise<void>;
}

/**
 * Captures trigger invocations in memory for tests and early development.
 * Phase 3b replaces this with an HTTP client that POSTs to the deploy-server.
 */
export class NoopDeployTrigger implements DeployTrigger {
  readonly triggers: DeployTriggerInput[] = [];

  async trigger(input: DeployTriggerInput): Promise<void> {
    this.triggers.push(input);
  }
}
