import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { User } from '../entities/user.entity'

export const DEFAULT_TZ = 'Europe/Nicosia'

export function isValidTz(tz: string) {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private readonly repo: Repository<User>) {}

  async findOrCreateByTg(tgId: number | string, name?: string | null): Promise<User> {
    const id = String(tgId)
    const found = await this.repo.findOne({ where: { tgId: id } })
    if (found) {
      if (name && found.tgName !== name) {
        found.tgName = name
        await this.repo.save(found)
      }
      return found
    }
    // insert … on conflict — на случай параллельных запросов
    await this.repo.createQueryBuilder().insert().into(User)
      .values({ tgId: id, tgName: name ?? null }).orIgnore().execute()
    return this.repo.findOneOrFail({ where: { tgId: id } })
  }

  async findOrCreateByDevice(deviceId: string): Promise<User> {
    const found = await this.repo.findOne({ where: { deviceId } })
    if (found) return found
    await this.repo.createQueryBuilder().insert().into(User).values({ deviceId }).orIgnore().execute()
    return this.repo.findOneOrFail({ where: { deviceId } })
  }

  findByTg(tgId: number | string) {
    return this.repo.findOne({ where: { tgId: String(tgId) } })
  }

  save(user: User) {
    return this.repo.save(user)
  }

  update(id: number, patch: Partial<User>) {
    return this.repo.update({ id }, patch)
  }

  /** Все, кому потенциально нужно напоминание. */
  findRemindable() {
    return this.repo.find({ where: { remindEnabled: true }, relations: { pushSubscriptions: true } })
  }
}
