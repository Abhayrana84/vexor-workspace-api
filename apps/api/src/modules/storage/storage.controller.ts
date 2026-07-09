import { Controller, Post, Get, Body, Query, UseGuards, Request } from '@nestjs/common';
import { StorageService } from './storage.service';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';

@Controller('storage')
export class StorageController {
  constructor(private storageService: StorageService) {}

  @UseGuards(JwtAuthGuard)
  @Post('presigned-url')
  async getPresignedUrl(
    @Request() req: any,
    @Body() body: { filename: string; contentType: string }
  ) {
    return this.storageService.getPresignedUploadUrl(
      req.user.organizationId,
      body.filename,
      body.contentType
    );
  }

  // Development helper to simulate upload when no S3/R2 keys are present in env
  @Post('local-upload-sim')
  async handleLocalSim(@Query('key') key: string) {
    return {
      success: true,
      message: 'Simulated S3 local upload completed successfully.',
      key,
    };
  }
}
