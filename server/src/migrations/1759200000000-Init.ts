import type { MigrationInterface, QueryRunner } from 'typeorm'

export class Init1759200000000 implements MigrationInterface {
  name = 'Init1759200000000'

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE "users" (
        "id" SERIAL PRIMARY KEY,
        "tg_id" bigint,
        "tg_name" varchar(128),
        "device_id" uuid,
        "tz" varchar(64) NOT NULL DEFAULT 'Europe/Nicosia',
        "remind_enabled" boolean NOT NULL DEFAULT true,
        "remind_time" varchar(5) NOT NULL DEFAULT '19:00',
        "evening_nudge" boolean NOT NULL DEFAULT true,
        "last_active_date" date,
        "last_reminded_date" date,
        "last_evening_date" date,
        "tg_blocked" boolean NOT NULL DEFAULT false,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )`)
    await q.query(`CREATE UNIQUE INDEX "uq_users_tg_id" ON "users" ("tg_id") WHERE "tg_id" IS NOT NULL`)
    await q.query(`CREATE UNIQUE INDEX "uq_users_device_id" ON "users" ("device_id") WHERE "device_id" IS NOT NULL`)
    await q.query(`
      CREATE TABLE "push_subscriptions" (
        "id" SERIAL PRIMARY KEY,
        "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "endpoint" text NOT NULL UNIQUE,
        "p256dh" varchar(256) NOT NULL,
        "auth" varchar(128) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )`)
    await q.query(`CREATE TABLE "app_settings" ("key" varchar(64) PRIMARY KEY, "value" text NOT NULL)`)
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "app_settings"`)
    await q.query(`DROP TABLE "push_subscriptions"`)
    await q.query(`DROP TABLE "users"`)
  }
}
