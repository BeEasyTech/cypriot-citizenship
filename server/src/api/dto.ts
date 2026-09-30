import { Type } from 'class-transformer'
import { IsBoolean, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator'

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/
const DATE = /^\d{4}-\d{2}-\d{2}$/

export class UpdateMeDto {
  @IsOptional() @IsBoolean()
  remindEnabled?: boolean

  @IsOptional() @Matches(HHMM, { message: 'Время в формате ЧЧ:ММ' })
  remindTime?: string

  @IsOptional() @IsBoolean()
  eveningNudge?: boolean

  @IsOptional() @IsString() @MaxLength(64)
  tz?: string
}

export class ActivityDto {
  /** Локальная дата занятия YYYY-MM-DD. */
  @Matches(DATE)
  date: string

  @IsOptional() @IsString() @MaxLength(64)
  tz?: string

  /** Накопительные числа за день — только количество, без содержимого. */
  @IsOptional() @IsInt() @Min(0) @Max(100000)
  cards?: number

  @IsOptional() @IsInt() @Min(0) @Max(100000)
  sims?: number

  @IsOptional() @IsInt() @Min(0) @Max(100000)
  listen?: number

  @IsOptional() @IsInt() @Min(0) @Max(100000)
  minutes?: number

  /** Дата собеседования для обратного отсчёта ('' — сбросить). */
  @IsOptional() @Matches(/^(\d{4}-\d{2}-\d{2})?$/)
  interviewDate?: string
}

class PushKeysDto {
  @IsString() @MaxLength(256)
  p256dh: string

  @IsString() @MaxLength(128)
  auth: string
}

export class PushSubscribeDto {
  @IsString() @MaxLength(2048)
  endpoint: string

  @ValidateNested() @Type(() => PushKeysDto)
  keys: PushKeysDto
}

export class PushUnsubscribeDto {
  @IsString() @MaxLength(2048)
  endpoint: string
}
