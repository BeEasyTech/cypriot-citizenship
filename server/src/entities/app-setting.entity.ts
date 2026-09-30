import { Column, Entity, PrimaryColumn } from 'typeorm'

/** Служебные значения, которые сервер генерирует сам (например, VAPID-ключи). */
@Entity('app_settings')
export class AppSetting {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  key: string

  @Column({ type: 'text' })
  value: string
}
