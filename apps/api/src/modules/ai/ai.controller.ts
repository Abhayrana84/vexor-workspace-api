import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(private aiService: AiService) {}

  @Post('chat')
  async chat(@Request() req: any, @Body() body: any) {
    return this.aiService.generateResponse(req.user.organizationId, body.prompt);
  }
}
