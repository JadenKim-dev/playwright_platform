import { Entity, PrimaryKey, Property, ManyToOne, Index } from '@mikro-orm/core';
import { v4 as uuidv4 } from 'uuid';
import { Deployment } from './deployment.entity.js';

@Entity({ tableName: 'test_files' })
@Index({ properties: ['deployment'] })
export class TestFile {
  @PrimaryKey({ type: 'string', length: 36 })
  id: string = uuidv4();

  @ManyToOne(() => Deployment, { fieldName: 'deployment_id', deleteRule: 'cascade' })
  deployment!: Deployment;

  @Property({ type: 'string', length: 512 })
  sourcePath!: string;

  @Property({ type: 'string', length: 512 })
  bundleKey!: string;

  @Property({ type: 'datetime', length: 3, defaultRaw: 'CURRENT_TIMESTAMP(3)' })
  createdAt: Date = new Date();
}
