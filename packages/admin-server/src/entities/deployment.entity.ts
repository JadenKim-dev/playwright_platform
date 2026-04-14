import { Entity, PrimaryKey, Property, Enum, Index } from '@mikro-orm/core';
import { v4 as uuidv4 } from 'uuid';
import { DeploymentStatus } from '@platform/shared';

@Entity({ tableName: 'deployments' })
export class Deployment {
  @PrimaryKey({ type: 'string', length: 36 })
  id: string = uuidv4();

  @Property({ type: 'string', length: 255 })
  gitRef!: string;

  @Enum({ items: () => Object.values(DeploymentStatus), type: 'string' })
  @Index()
  status: DeploymentStatus = DeploymentStatus.Pending;

  @Property({ type: 'text', nullable: true })
  errorMessage: string | null = null;

  @Property({ type: 'datetime', length: 3, defaultRaw: 'CURRENT_TIMESTAMP(3)' })
  startedAt: Date = new Date();

  @Property({ type: 'datetime', length: 3, nullable: true })
  finishedAt: Date | null = null;
}
