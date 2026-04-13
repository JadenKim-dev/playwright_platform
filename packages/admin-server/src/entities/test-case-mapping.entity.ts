import { Entity, PrimaryKey, Property, ManyToOne, Unique, Index } from '@mikro-orm/core';
import { v4 as uuidv4 } from 'uuid';
import { Deployment } from './deployment.entity.js';
import { TestCase } from './test-case.entity.js';
import { TestFile } from './test-file.entity.js';

@Entity({ tableName: 'test_case_mappings' })
@Unique({ properties: ['deployment', 'testCase'] })
@Index({ properties: ['testCase'] })
export class TestCaseMapping {
  @PrimaryKey({ type: 'string', length: 36 })
  id: string = uuidv4();

  @ManyToOne(() => Deployment, { fieldName: 'deployment_id', deleteRule: 'cascade' })
  deployment!: Deployment;

  @ManyToOne(() => TestCase, { fieldName: 'test_case_id', deleteRule: 'restrict' })
  testCase!: TestCase;

  @ManyToOne(() => TestFile, { fieldName: 'test_file_id', deleteRule: 'cascade' })
  testFile!: TestFile;
}
