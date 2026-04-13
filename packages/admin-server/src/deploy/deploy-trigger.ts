export interface DeployTriggerInput {
  deploymentId: string;
  gitRef: string;
}

export interface DeployTrigger {
  trigger(input: DeployTriggerInput): Promise<void>;
}

export class NoopDeployTrigger implements DeployTrigger {
  readonly triggers: DeployTriggerInput[] = [];

  async trigger(input: DeployTriggerInput): Promise<void> {
    this.triggers.push(input);
  }
}
