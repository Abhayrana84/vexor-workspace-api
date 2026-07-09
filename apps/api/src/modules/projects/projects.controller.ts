import { Controller, Get, Post, Patch, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { RolesGuard } from '../../common/roles.guard';
import { Roles } from '../../common/roles.decorator';
import { Role } from '@vexor/types';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private projectsService: ProjectsService) {}

  @Get()
  async getProjects(@Request() req: any) {
    return this.projectsService.getProjects(req.user.organizationId, req.user);
  }

  @Roles(Role.FOUNDER, Role.CO_FOUNDER, Role.ADMIN, Role.PROJECT_MANAGER)
  @Post()
  async createProject(@Request() req: any, @Body() body: any) {
    return this.projectsService.createProject(req.user.organizationId, body);
  }

  @Roles(Role.FOUNDER, Role.CO_FOUNDER, Role.ADMIN, Role.PROJECT_MANAGER)
  @Post(':id/tasks')
  async createTask(@Param('id') projectId: string, @Body() body: any) {
    return this.projectsService.createTask(projectId, body);
  }

  @Patch('tasks/:id/status')
  async updateTaskStatus(@Param('id') taskId: string, @Body() body: any) {
    return this.projectsService.updateTaskStatus(taskId, body.status);
  }

  @Post('tasks/:id/comments')
  async addComment(@Param('id') taskId: string, @Request() req: any, @Body() body: any) {
    return this.projectsService.addComment(taskId, req.user.id, body.content);
  }

  @Roles(Role.FOUNDER, Role.CO_FOUNDER, Role.ADMIN, Role.PROJECT_MANAGER, Role.DEVELOPER, Role.DESIGNER)
  @Post('tasks/:id/timelog')
  async logTime(@Param('id') taskId: string, @Body() body: any) {
    return this.projectsService.logTime(taskId, body.durationMin, body.description);
  }

  @Roles(Role.FOUNDER, Role.CO_FOUNDER, Role.ADMIN, Role.PROJECT_MANAGER)
  @Post(':id/milestones')
  async addMilestone(@Param('id') projectId: string, @Body() body: any) {
    return this.projectsService.addMilestone(projectId, body.title, body.dueDate);
  }
}
