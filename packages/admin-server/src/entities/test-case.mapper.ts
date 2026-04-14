import type { TestCaseDto } from '@platform/shared';
import type { TestCase } from './test-case.entity';

export function toTestCaseDto(entity: TestCase, isActive: boolean): TestCaseDto {
  return {
    id: entity.id,
    name: entity.name,
    description: entity.description,
    params: entity.params,
    expected: entity.expected,
    tags: entity.tags,
    autoCreated: entity.autoCreated,
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString(),
    isActive,
  };
}
