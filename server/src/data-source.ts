import 'reflect-metadata'
import { DataSource, type DataSourceOptions } from 'typeorm'
import { User } from './entities/user.entity'
import { PushSubscription } from './entities/push-subscription.entity'
import { AppSetting } from './entities/app-setting.entity'
import { Init1759200000000 } from './migrations/1759200000000-Init'
import { Activity1759300000000 } from './migrations/1759300000000-Activity'
import { DailyActivity } from './entities/daily-activity.entity'

/** Общие настройки БД: используются и приложением, и CLI TypeORM (миграции). */
export function dataSourceOptions(url = process.env.DATABASE_URL): DataSourceOptions {
  if (!url) throw new Error('DATABASE_URL не задан')
  const local = /localhost|127\.0\.0\.1|\.railway\.internal/.test(url)
  return {
    type: 'postgres',
    url,
    entities: [User, PushSubscription, AppSetting, DailyActivity],
    migrations: [Init1759200000000, Activity1759300000000],
    migrationsRun: true,
    synchronize: false,
    ssl: local || process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
  }
}

export default new DataSource(dataSourceOptions())
