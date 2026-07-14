import { Injectable, NotFoundException } from '@nestjs/common';
import { DbService } from '../db/db.service';

@Injectable()
export class CrmService {
  constructor(private db: DbService) {}

  async getLeads(orgId: string, user?: any) {
    const isManager = !user || ['FOUNDER', 'CO_FOUNDER', 'ADMIN', 'SALES_MANAGER'].includes(user.role);
    const whereClause: any = { organizationId: orgId };

    if (!isManager) {
      whereClause.assigneeId = user.id;
    }

    return this.db.lead.findMany({
      where: whereClause,
      include: {
        assignee: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        creator: {
          select: { id: true, firstName: true, lastName: true },
        },
        history: {
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createLead(orgId: string, creatorId: string, data: {
    title: string;
    companyName: string;
    contactName: string;
    email: string;
    phone?: string;
    score?: number;
    assigneeId?: string;
    autoAssign?: boolean;
  }) {
    let finalAssigneeId = data.assigneeId;

    // Execute automatic lead distribution engine
    if (data.autoAssign && !finalAssigneeId) {
      finalAssigneeId = await this.calculateRoundRobinAssignee(orgId);
    }

    const lead = await this.db.lead.create({
      data: {
        title: data.title,
        companyName: data.companyName,
        contactName: data.contactName,
        email: data.email,
        phone: data.phone,
        score: data.score || 30, // Default lead score
        organizationId: orgId,
        creatorId: creatorId,
        assigneeId: finalAssigneeId || null,
      },
    });

    // Write initial history entry
    await this.db.leadHistory.create({
      data: {
        leadId: lead.id,
        action: 'Lead Created',
        detail: finalAssigneeId 
          ? `Lead created and auto-assigned via Round-Robin.`
          : 'Lead created without assignment.',
      },
    });

    return lead;
  }

  async updateLeadStatus(leadId: string, status: string, detail?: string) {
    const lead = await this.db.lead.findUnique({ where: { id: leadId } });
    if (!lead) throw new NotFoundException('Lead not found');

    const updated = await this.db.lead.update({
      where: { id: leadId },
      data: { status },
    });

    await this.db.leadHistory.create({
      data: {
        leadId,
        action: 'Status Updated',
        detail: detail || `Status changed from ${lead.status} to ${status}.`,
      },
    });

    return updated;
  }

  async assignLead(leadId: string, assigneeId: string) {
    const lead = await this.db.lead.findUnique({ where: { id: leadId } });
    if (!lead) throw new NotFoundException('Lead not found');

    const assignee = await this.db.user.findUnique({ where: { id: assigneeId } });
    if (!assignee) throw new NotFoundException('Assignee not found');

    const updated = await this.db.lead.update({
      where: { id: leadId },
      data: { assigneeId },
    });

    await this.db.leadHistory.create({
      data: {
        leadId,
        action: 'Lead Assigned',
        detail: `Lead manually reassigned to ${assignee.firstName} ${assignee.lastName}.`,
      },
    });

    return updated;
  }

  private async calculateRoundRobinAssignee(orgId: string): Promise<string | undefined> {
    // Find all sales roles in the organization
    const salesUsers = await this.db.user.findMany({
      where: {
        organizationId: orgId,
        role: { in: ['SALES_MANAGER', 'SALES_EXECUTIVE'] },
      },
    });

    if (salesUsers.length === 0) return undefined;

    // Count how many leads each sales user currently has
    const leadCounts = await Promise.all(
      salesUsers.map(async (user) => {
        const count = await this.db.lead.count({
          where: { assigneeId: user.id },
        });
        return { userId: user.id, count };
      }),
    );

    // Sort by count (ascending) to pick the one with the lightest workload (Round Robin workload strategy)
    leadCounts.sort((a, b) => a.count - b.count);
    return leadCounts[0].userId;
  }
}
