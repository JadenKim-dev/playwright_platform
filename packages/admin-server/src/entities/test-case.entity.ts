import { Entity, PrimaryKey, Property, Index } from '@mikro-orm/core';

@Entity({ tableName: 'test_cases' })
export class TestCase {
  @PrimaryKey({ type: 'string', length: 64 })
  id!: string;

  @Property({ type: 'string', length: 255 })
  name!: string;

  @Property({ type: 'text', nullable: true })
  description: string | null = null;

  @Property({ type: 'json' })
  params: Record<string, unknown> = {};

  @Property({ type: 'json' })
  expected: Record<string, unknown> = {};

  @Property({ type: 'json' })
  tags: string[] = [];

  @Property({ type: 'boolean', default: false })
  @Index()
  autoCreated: boolean = false;

  @Property({ type: 'datetime', length: 3, defaultRaw: 'CURRENT_TIMESTAMP(3)' })
  createdAt: Date = new Date();

  @Property({
    type: 'datetime',
    length: 3,
    defaultRaw: 'CURRENT_TIMESTAMP(3)',
    onUpdate: () => new Date(),
  })
  updatedAt: Date = new Date();
}
