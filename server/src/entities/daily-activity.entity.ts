import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm'
import { User } from './user.entity'

/** Статистика занятий за день: только числа, без содержимого. */
@Entity('daily_activity')
export class DailyActivity {
  @PrimaryColumn({ name: 'user_id' })
  userId: number

  /** Локальная дата пользователя. */
  @PrimaryColumn({ type: 'date' })
  date: string

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User

  /** Карточек за день (повторения и новые). */
  @Column({ type: 'int', default: 0 })
  cards: number

  /** Вопросов в симуляции собеседования. */
  @Column({ type: 'int', default: 0 })
  sims: number

  /** Ответов в квизе «Узнай вопрос». */
  @Column({ type: 'int', default: 0 })
  listen: number

  @Column({ type: 'int', default: 0 })
  minutes: number
}
