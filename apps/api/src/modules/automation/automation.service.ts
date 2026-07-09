import { Injectable, NotFoundException } from '@nestjs/common';
import { DbService } from '../db/db.service';

@Injectable()
export class AutomationService {
  constructor(private db: DbService) {}

  async getAutomations(orgId: string) {
    return this.db.automation.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async saveAutomation(orgId: string, name: string, trigger: any, actions: any) {
    return this.db.automation.create({
      data: {
        name,
        trigger: JSON.stringify(trigger),
        actions: JSON.stringify(actions),
        organizationId: orgId,
        isActive: true,
      },
    });
  }

  async triggerSimulation(automationId: string) {
    const auto = await this.db.automation.findUnique({ where: { id: automationId } });
    if (!auto) throw new NotFoundException('Automation config not found');

    const triggerInfo = JSON.parse(auto.trigger);
    const actionList = JSON.parse(auto.actions);

    const logs: string[] = [];
    logs.push(`[${new Date().toISOString()}] Triggered by event: "${triggerInfo.event || 'LeadCreated'}"`);

    for (let i = 0; i < actionList.length; i++) {
      const action = actionList[i];
      logs.push(`[${new Date().toISOString()}] Executing Node ${i + 1}: ${action.type} with params: ${JSON.stringify(action.params)}`);
      
      // Simulate action execution delays/outcomes
      if (action.type === 'assignRoundRobin') {
        logs.push(`[Success] Lead auto-allocated using sales workload queue.`);
      } else if (action.type === 'sendEmail') {
        logs.push(`[Success] Email dispatched successfully via Resend API to recipient.`);
      } else if (action.type === 'createTask') {
        logs.push(`[Success] Created task: "${action.params.title || 'Follow-up'}" inside client dashboard.`);
      } else {
        logs.push(`[Success] Node executed with exit status 0.`);
      }
    }

    logs.push(`[${new Date().toISOString()}] Workflow completed successfully without exceptions.`);
    return {
      id: auto.id,
      name: auto.name,
      logs,
    };
  }
}
