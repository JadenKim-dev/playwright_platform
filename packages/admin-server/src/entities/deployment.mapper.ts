import type { DeploymentDto } from '@platform/shared';
import type { Deployment } from './deployment.entity';

export function toDeploymentDto(entity: Deployment): DeploymentDto {
  return {
    id: entity.id,
    gitRef: entity.gitRef,
    status: entity.status,
    errorMessage: entity.errorMessage,
    startedAt: entity.startedAt.toISOString(),
    finishedAt: entity.finishedAt ? entity.finishedAt.toISOString() : null,
  };
}
