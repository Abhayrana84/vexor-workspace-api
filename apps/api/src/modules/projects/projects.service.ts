import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { Role } from '@vexor/types';

@Injectable()
export class ProjectsService {
  constructor(private db: DbService) {}

  async getProjects(orgId: string, user: any) {
    // If client, fetch by their client profile
    if (user.role === Role.CLIENT) {
      const clientProfile = await this.db.clientProfile.findFirst({
        where: { email: user.email },
      });
      if (!clientProfile) return [];
      return this.db.project.findMany({
        where: { organizationId: orgId, clientId: clientProfile.id },
        include: { manager: true, tasks: true, milestones: true },
        orderBy: { createdAt: 'desc' },
      });
    }

    // For agency employees (Founder, Admin, PM, Dev, etc.)
    return this.db.project.findMany({
      where: { organizationId: orgId },
      include: {
        manager: { select: { id: true, firstName: true, lastName: true } },
        client: true,
        tasks: {
          include: { assignee: { select: { id: true, firstName: true, lastName: true } } },
        },
        milestones: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createProject(orgId: string, data: {
    name: string;
    description?: string;
    budget?: number;
    startDate?: Date;
    endDate?: Date;
    managerId?: string;
    clientId?: string;
  }) {
    return this.db.project.create({
      data: {
        name: data.name,
        description: data.description,
        budget: data.budget,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        organizationId: orgId,
        managerId: data.managerId,
        clientId: data.clientId,
      },
    });
  }

  async createTask(projectId: string, data: {
    title: string;
    description?: string;
    priority?: string;
    assigneeId?: string;
    dueDate?: Date;
  }) {
    const project = await this.db.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');

    return this.db.task.create({
      data: {
        title: data.title,
        description: data.description,
        priority: data.priority || 'MEDIUM',
        projectId: projectId,
        assigneeId: data.assigneeId,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
      },
    });
  }

  async updateTaskStatus(taskId: string, status: string) {
    const task = await this.db.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Task not found');

    return this.db.task.update({
      where: { id: taskId },
      data: { status },
    });
  }

  async addComment(taskId: string, userId: string, content: string) {
    return this.db.comment.create({
      data: {
        taskId,
        userId,
        content,
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
    });
  }

  async logTime(taskId: string, durationMin: number, description?: string) {
    return this.db.timeLog.create({
      data: {
        taskId,
        durationMin,
        description,
      },
    });
  }

  async addMilestone(projectId: string, title: string, dueDate: Date) {
    return this.db.milestone.create({
      data: {
        projectId,
        title,
        dueDate: new Date(dueDate),
      },
    });
  }
}
