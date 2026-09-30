import type { MigrationInterface, QueryRunner } from 'typeorm'

export class Activity1759300000000 implements MigrationInterface {
  name = 'Activity1759300000000'

  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "users" ADD "snooze_until" timestamptz, ADD "last_weekly_date" date, ADD "interview_date" date`)
    await q.query(`
      CREATE TABLE "daily_activity" (
        "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "date" date NOT NULL,
        "cards" integer NOT NULL DEFAULT 0,
        "sims" integer NOT NULL DEFAULT 0,
        "listen" integer NOT NULL DEFAULT 0,
        "minutes" integer NOT NULL DEFAULT 0,
        PRIMARY KEY ("user_id", "date")
      )`)
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "daily_activity"`)
    await q.query(`ALTER TABLE "users" DROP COLUMN "snooze_until", DROP COLUMN "last_weekly_date", DROP COLUMN "interview_date"`)
  }
}
