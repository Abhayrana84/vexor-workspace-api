import { Module } from '@nestjs/common';
import { HrmsService } from './hrms.service';
import { HrmsController } from './hrms.controller';

@Module({
  controllers: [HrmsController],
  providers: [HrmsService],
  exports: [HrmsService],
})
export class HrmsModule {}
