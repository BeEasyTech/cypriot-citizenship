import { Body, Controller, Get, Post, Res, ServiceUnavailableException, UseGuards } from '@nestjs/common'
import type { Response } from 'express'
import { IsIn, IsString, MaxLength, MinLength } from 'class-validator'
import { AuthGuard, CurrentUser } from '../auth/auth.guard'
import type { User } from '../entities/user.entity'
import { TtsService, type VoiceLetter } from './tts.service'

class TtsDto {
  @IsString() @MinLength(1) @MaxLength(500)
  text: string

  @IsIn(['m', 'f'])
  voice: VoiceLetter
}

@Controller('api/tts')
export class TtsController {
  constructor(private readonly tts: TtsService) {}

  /** Настроена ли озвучка на сервере. */
  @Get('status')
  status() {
    return { configured: this.tts.configured, provider: 'elevenlabs' }
  }

  /**
   * Озвучить фразу. Текст передаётся в теле (не попадает в URL и логи), на сервере не сохраняется.
   */
  @UseGuards(AuthGuard)
  @Post()
  async speak(@CurrentUser() u: User, @Body() dto: TtsDto, @Res() res: Response) {
    if (!this.tts.configured) throw new ServiceUnavailableException('Озвучка не настроена: нет ELEVENLABS_API_KEY')
    const audio = await this.tts.synthesize(u.id, dto.text.trim(), dto.voice)
    res.set({ 'Content-Type': 'audio/mpeg', 'Cache-Control': 'private, max-age=31536000' })
    res.send(audio)
  }
}
