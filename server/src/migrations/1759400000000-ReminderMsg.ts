import type { MigrationInterface, QueryRunner } from 'typeorm'

export class ReminderMsg1759400000000 implements MigrationInterface {
  name = 'ReminderMsg1759400000000'

  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "users" ADD "tg_reminder_msg_id" integer`)
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "users" DROP COLUMN "tg_reminder_msg_id"`)
  }
}
