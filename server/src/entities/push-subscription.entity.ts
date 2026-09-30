import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'
import { User } from './user.entity'

@Entity('push_subscriptions')
export class PushSubscription {
  @PrimaryGeneratedColumn()
  id: number

  @ManyToOne(() => User, (u) => u.pushSubscriptions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User

  @Column({ name: 'user_id' })
  userId: number

  @Column({ type: 'text', unique: true })
  endpoint: string

  @Column({ type: 'varchar', length: 256 })
  p256dh: string

  @Column({ type: 'varchar', length: 128 })
  auth: string

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date
}
