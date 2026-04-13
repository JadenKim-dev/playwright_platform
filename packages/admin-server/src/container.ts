import type { EntityManager } from '@mikro-orm/mysql';
import { getOrm } from './db/orm';
import { TestCaseRepository } from './repositories/test-case.repository';
import { DeploymentRepository } from './repositories/deployment.repository';
import { TestFileRepository } from './repositories/test-file.repository';
import { TestCaseMappingRepository } from './repositories/test-case-mapping.repository';
import { TestRunRepository } from './repositories/test-run.repository';
import { TestRunItemRepository } from './repositories/test-run-item.repository';
import { TestEventRepository } from './repositories/test-event.repository';
import { TestCaseService } from './services/test-case.service';
import { DeploymentService } from './services/deployment.service';
import { RunService } from './services/run.service';
import { EventIngestService } from './services/event-ingest.service';
import {
  NoopRunQueuePublisher,
  type RunQueuePublisher,
} from './queue/run-queue-publisher';
import {
  NoopObjectStorageClient,
  type ObjectStorageClient,
} from './storage/object-storage-client';
import { NoopDeployTrigger, type DeployTrigger } from './deploy/deploy-trigger';

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
  // `||` (not `??`) so an empty ADMIN_URL env var falls back to the docker-compose default.
  const adminBaseUrl = overrides.adminBaseUrl || process.env.ADMIN_URL || 'http://admin:3000';
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
