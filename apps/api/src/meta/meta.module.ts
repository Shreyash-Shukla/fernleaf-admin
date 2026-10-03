import { Module } from '@nestjs/common';
import { MetaController } from './meta.controller';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [SettingsModule],
  controllers: [MetaController],
})
export class MetaModule {}
