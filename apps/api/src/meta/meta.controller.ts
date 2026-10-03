import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { SettingsService } from '../settings/settings.service';
import { DateTime } from 'luxon';

@Controller('meta')
export class MetaController {
  constructor(private readonly settingsService: SettingsService) {}

  @Public()
  @Get()
  async getMeta() {
    const timezone = await this.settingsService.getTimezone();
    const now = DateTime.now().setZone(timezone);

    return {
      today: now.toISODate() ?? new Date().toISOString().slice(0, 10),
      nowIso: now.toISO() ?? new Date().toISOString(),
      timezone,
    };
  }
}
