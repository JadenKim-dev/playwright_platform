import type { EntityManager } from '@mikro-orm/mysql';
import { getOrm } from './db/orm.js';
import { TestCaseRepository } from './repositories/test-case.repository.js';
import { DeploymentRepository } from './repositories/deployment.repository.js';
import { TestFileRepository } from './repositories/test-file.repository.js';
import { TestCaseMappingRepository } from './repositories/test-case-mapping.repository.js';
import { TestRunRepository } from './repositories/test-run.repository.js';
import { TestRunItemRepository } from './repositories/test-run-item.repository.js';
import { TestEventRepository } from './repositories/test-event.repository.js';
import { TestCaseService } from './services/test-case.service.js';
import { DeploymentService } from './services/deployment.service.js';
import { RunService } from './services/run.service.js';
import { EventIngestService } from './services/event-ingest.service.js';
import {
  NoopRunQueuePublisher,
  type RunQueuePublisher,
} from './queue/run-queue-publisher.js';
import {
  NoopObjectStorageClient,
  type ObjectStorageClient,
} from './storage/object-storage-client.js';
import { NoopDeployTrigger, type DeployTrigger } from './deploy/deploy-trigger.js';

export interface AdminContainerOverrides {
  publisher?: RunQueuePublisher;
  storage?: ObjectStorageClient;
  trigger?: DeployTrigger;
  adminBaseUrl?: string;
}

let overrides: AdminContainerOverrides = {};

export function setContainerOverrides(o: AdminContainerOverrides): void {
  overrides = { ...overrides, ...o };
}

export function resetContainerOverrides(): void {
  overrides = {};
}

export interface AdminContainer {
  em: EntityManager;
  testCaseService: TestCaseService;
  deploymentService: DeploymentService;
  runService: RunService;
  eventIngestService: EventIngestService;
}

export async function getAdminContainer(): Promise<AdminContainer> {
  const orm = await getOrm();
  const em = orm.em.fork();
  const adminBaseUrl = overrides.adminBaseUrl ?? process.env.ADMIN_URL ?? 'http://admin:3000';
  const publisher = overrides.publisher ?? new NoopRunQueuePublisher();
  const storage = overrides.storage ?? new NoopObjectStorageClient();
  const trigger = overrides.trigger ?? new NoopDeployTrigger();

  const testCaseRepo = new TestCaseRepository(em);
  const deploymentRepo = new DeploymentRepository(em);
  const fileRepo = new TestFileRepository(em);
  const mappingRepo = new TestCaseMappingRepository(em);
  const runRepo = new TestRunRepository(em);
  const runItemRepo = new TestRunItemRepository(em);
  const eventRepo = new TestEventRepository(em);

  return {
    em,
    testCaseService: new TestCaseService(em, testCaseRepo, mappingRepo, deploymentRepo),
    deploymentService: new DeploymentService(em, deploymentRepo, fileRepo, trigger),
    runService: new RunService(
      em,
      deploymentRepo,
      testCaseRepo,
      mappingRepo,
      runRepo,
      runItemRepo,
      publisher,
      storage,
      adminBaseUrl,
    ),
    eventIngestService: new EventIngestService(em, runRepo, runItemRepo, eventRepo),
  };
}
