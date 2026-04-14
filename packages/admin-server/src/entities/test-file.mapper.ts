import type { TestFileDto } from '@platform/shared';
import type { TestFile } from './test-file.entity';

export function toTestFileDto(entity: TestFile): TestFileDto {
  return {
    id: entity.id,
    deploymentId: entity.deployment.id,
    sourcePath: entity.sourcePath,
    bundleKey: entity.bundleKey,
    createdAt: entity.createdAt.toISOString(),
  };
}
