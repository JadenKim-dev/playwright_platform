import { Migration } from '@mikro-orm/migrations';

export class Migration00000000000001 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table \`test_cases\` (
        \`id\` varchar(64) not null,
        \`name\` varchar(255) not null,
        \`description\` text null,
        \`params\` json not null,
        \`expected\` json not null,
        \`tags\` json not null,
        \`auto_created\` tinyint(1) not null default 0,
        \`created_at\` datetime(3) not null default CURRENT_TIMESTAMP(3),
        \`updated_at\` datetime(3) not null default CURRENT_TIMESTAMP(3),
        primary key (\`id\`),
        index \`test_cases_auto_created_index\` (\`auto_created\`)
      ) default character set utf8mb4 engine = InnoDB;
    `);

    this.addSql(`
      create table \`deployments\` (
        \`id\` varchar(36) not null,
        \`git_ref\` varchar(255) not null,
        \`status\` varchar(32) not null default 'pending',
        \`error_message\` text null,
        \`started_at\` datetime(3) not null default CURRENT_TIMESTAMP(3),
        \`finished_at\` datetime(3) null,
        primary key (\`id\`),
        index \`deployments_status_index\` (\`status\`)
      ) default character set utf8mb4 engine = InnoDB;
    `);

    this.addSql(`
      create table \`test_files\` (
        \`id\` varchar(36) not null,
        \`deployment_id\` varchar(36) not null,
        \`source_path\` varchar(512) not null,
        \`bundle_key\` varchar(512) not null,
        \`created_at\` datetime(3) not null default CURRENT_TIMESTAMP(3),
        primary key (\`id\`),
        index \`test_files_deployment_id_index\` (\`deployment_id\`),
        constraint \`test_files_deployment_id_foreign\` foreign key (\`deployment_id\`) references \`deployments\` (\`id\`) on delete cascade
      ) default character set utf8mb4 engine = InnoDB;
    `);

    this.addSql(`
      create table \`test_case_mappings\` (
        \`id\` varchar(36) not null,
        \`deployment_id\` varchar(36) not null,
        \`test_case_id\` varchar(64) not null,
        \`test_file_id\` varchar(36) not null,
        primary key (\`id\`),
        unique \`test_case_mappings_dep_tc_unique\` (\`deployment_id\`, \`test_case_id\`),
        index \`test_case_mappings_test_case_id_index\` (\`test_case_id\`),
        constraint \`tcm_deployment_fk\` foreign key (\`deployment_id\`) references \`deployments\` (\`id\`) on delete cascade,
        constraint \`tcm_test_case_fk\` foreign key (\`test_case_id\`) references \`test_cases\` (\`id\`) on delete restrict,
        constraint \`tcm_test_file_fk\` foreign key (\`test_file_id\`) references \`test_files\` (\`id\`) on delete cascade
      ) default character set utf8mb4 engine = InnoDB;
    `);

    this.addSql(`
      create table \`test_runs\` (
        \`id\` varchar(36) not null,
        \`deployment_id\` varchar(36) not null,
        \`requested_test_case_ids\` json not null,
        \`status\` varchar(32) not null default 'queued',
        \`requested_at\` datetime(3) not null default CURRENT_TIMESTAMP(3),
        \`started_at\` datetime(3) null,
        \`finished_at\` datetime(3) null,
        \`playwright_report_key\` varchar(512) null,
        primary key (\`id\`),
        index \`test_runs_status_index\` (\`status\`),
        constraint \`test_runs_deployment_fk\` foreign key (\`deployment_id\`) references \`deployments\` (\`id\`) on delete restrict
      ) default character set utf8mb4 engine = InnoDB;
    `);

    this.addSql(`
      create table \`test_run_items\` (
        \`id\` varchar(36) not null,
        \`test_run_id\` varchar(36) not null,
        \`test_case_id\` varchar(64) not null,
        \`test_file_id\` varchar(36) not null,
        \`status\` varchar(32) not null default 'pending',
        \`duration_ms\` int null,
        \`error_message\` text null,
        \`params_snapshot\` json not null,
        \`expected_snapshot\` json not null,
        \`started_at\` datetime(3) null,
        \`finished_at\` datetime(3) null,
        primary key (\`id\`),
        index \`test_run_items_test_run_id_index\` (\`test_run_id\`),
        index \`test_run_items_test_case_id_index\` (\`test_case_id\`),
        constraint \`tri_run_fk\` foreign key (\`test_run_id\`) references \`test_runs\` (\`id\`) on delete cascade,
        constraint \`tri_test_case_fk\` foreign key (\`test_case_id\`) references \`test_cases\` (\`id\`) on delete restrict,
        constraint \`tri_test_file_fk\` foreign key (\`test_file_id\`) references \`test_files\` (\`id\`) on delete restrict
      ) default character set utf8mb4 engine = InnoDB;
    `);

    this.addSql(`
      create table \`test_events\` (
        \`id\` bigint not null auto_increment,
        \`test_run_id\` varchar(36) not null,
        \`test_run_item_id\` varchar(36) not null,
        \`event_type\` varchar(32) not null,
        \`payload\` json not null,
        \`emitted_at\` datetime(3) not null default CURRENT_TIMESTAMP(3),
        primary key (\`id\`),
        index \`test_events_run_id_pk_index\` (\`test_run_id\`, \`id\`),
        constraint \`te_run_fk\` foreign key (\`test_run_id\`) references \`test_runs\` (\`id\`) on delete cascade,
        constraint \`te_run_item_fk\` foreign key (\`test_run_item_id\`) references \`test_run_items\` (\`id\`) on delete cascade
      ) default character set utf8mb4 engine = InnoDB;
    `);
  }

  override async down(): Promise<void> {
    this.addSql('drop table if exists `test_events`;');
    this.addSql('drop table if exists `test_run_items`;');
    this.addSql('drop table if exists `test_runs`;');
    this.addSql('drop table if exists `test_case_mappings`;');
    this.addSql('drop table if exists `test_files`;');
    this.addSql('drop table if exists `deployments`;');
    this.addSql('drop table if exists `test_cases`;');
  }
}
