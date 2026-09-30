import { Column, CreateDateColumn, Entity, Index, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'
import { PushSubscription } from './push-subscription.entity'

/**
 * Пользователь: либо аккаунт Telegram (tgId), либо устройство PWA (deviceId).
 * Прогресс обучения на сервере не хранится — только настройки напоминаний и дата последнего занятия.
 */
@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number

  /** Telegram user id (в личном чате совпадает с chat_id). bigint приходит строкой. */
  @Index('uq_users_tg_id', { unique: true, where: '"tg_id" IS NOT NULL' })
  @Column({ name: 'tg_id', type: 'bigint', nullable: true })
  tgId: string | null

  @Column({ name: 'tg_name', type: 'varchar', length: 128, nullable: true })
  tgName: string | null

  /** Случайный UUID устройства для PWA вне Telegram. */
  @Index('uq_users_device_id', { unique: true, where: '"device_id" IS NOT NULL' })
  @Column({ name: 'device_id', type: 'uuid', nullable: true })
  deviceId: string | null

  /** IANA-часовой пояс, например Europe/Nicosia. */
  @Column({ type: 'varchar', length: 64, default: 'Europe/Nicosia' })
  tz: string

  @Column({ name: 'remind_enabled', type: 'boolean', default: true })
  remindEnabled: boolean

  /** Локальное время напоминания HH:MM. */
  @Column({ name: 'remind_time', type: 'varchar', length: 5, default: '19:00' })
  remindTime: string

  /** Второе напоминание вечером, если так и не позанимались. */
  @Column({ name: 'evening_nudge', type: 'boolean', default: true })
  eveningNudge: boolean

  /** Дата последнего занятия (локальная, YYYY-MM-DD). */
  @Column({ name: 'last_active_date', type: 'date', nullable: true })
  lastActiveDate: string | null

  @Column({ name: 'last_reminded_date', type: 'date', nullable: true })
  lastRemindedDate: string | null

  @Column({ name: 'last_evening_date', type: 'date', nullable: true })
  lastEveningDate: string | null

  /** «Напомнить через час» — время повторного напоминания. */
  @Column({ name: 'snooze_until', type: 'timestamptz', nullable: true })
  snoozeUntil: Date | null

  /** Когда отправлены последние итоги недели (локальная дата воскресенья). */
  @Column({ name: 'last_weekly_date', type: 'date', nullable: true })
  lastWeeklyDate: string | null

  /** Дата собеседования (для обратного отсчёта). */
  @Column({ name: 'interview_date', type: 'date', nullable: true })
  interviewDate: string | null

  /** Пользователь заблокировал бота — сообщения не шлём. */
  @Column({ name: 'tg_blocked', type: 'boolean', default: false })
  tgBlocked: boolean

  @OneToMany(() => PushSubscription, (s) => s.user)
  pushSubscriptions: PushSubscription[]

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date
}
