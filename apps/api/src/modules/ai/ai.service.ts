import { Injectable, Logger } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private genAI: GoogleGenerativeAI | null = null;

  constructor(private db: DbService) {
    if (process.env.GEMINI_API_KEY) {
      this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    } else {
      this.logger.warn('GEMINI_API_KEY is not configured. Running AI in local database analytics mode.');
    }
  }

  async generateResponse(orgId: string, prompt: string) {
    // 1. Fetch real dynamic workspace context from database
    const [projects, leads, invoices, monitors, employees] = await Promise.all([
      this.db.project.findMany({
        where: { organizationId: orgId },
        include: { manager: true, tasks: true },
      }),
      this.db.lead.findMany({
        where: { organizationId: orgId },
      }),
      this.db.invoice.findMany({
        where: { organizationId: orgId },
        include: { client: true },
      }),
      this.db.webMonitor.findMany({
        where: { organizationId: orgId },
      }),
      this.db.employeeProfile.findMany({
        where: { user: { organizationId: orgId } },
        include: { user: true },
      }),
    ]);

    const workspaceContext = {
      projects: projects.map(p => ({
        id: p.id,
        name: p.name,
        status: p.status,
        healthScore: p.healthScore,
        budget: p.budget,
        startDate: p.startDate,
        endDate: p.endDate,
        managerName: p.manager ? `${p.manager.firstName} ${p.manager.lastName}` : 'Unassigned',
        taskCount: p.tasks.length,
        pendingTaskCount: p.tasks.filter(t => t.status !== 'DONE').length,
      })),
      leads: leads.map(l => ({
        id: l.id,
        title: l.title,
        companyName: l.companyName,
        contactName: l.contactName,
        email: l.email,
        status: l.status,
        score: l.score,
      })),
      invoices: invoices.map(i => ({
        id: i.id,
        invoiceNumber: i.invoiceNumber,
        clientCompany: i.client?.companyName || 'Unknown Client',
        amount: i.amount,
        gst: i.gst,
        dueDate: i.dueDate,
        status: i.status,
      })),
      uptimeMonitors: monitors.map(m => ({
        name: m.name,
        url: m.url,
        isActive: m.isActive,
        lastPingStatus: m.lastPingStatus,
        uptimeRatio: m.uptimeRatio,
      })),
      staff: employees.map(e => ({
        name: `${e.user.firstName} ${e.user.lastName}`,
        email: e.user.email,
        department: e.department,
        designation: e.designation,
        salary: e.salary,
        joiningDate: e.joiningDate,
      })),
    };

    // If Gemini API Key is configured, run actual LLM query with injected context
    if (this.genAI) {
      try {
        const model = this.genAI.getGenerativeModel({
          model: 'gemini-1.5-flash',
          systemInstruction: `You are the Vexor OS AI Business Intelligence Assistant. 
You provide structured business analysis, recommendations, and workspace advice based on live database data.
You must analyze the JSON workspace data provided, and reply accurately to the user query.
Use professional tone and markdown formatting. Keep responses concise, clean, and actionable.`,
        });

        const queryPrompt = `Workspace Database Data:
${JSON.stringify(workspaceContext, null, 2)}

User Query: "${prompt}"`;

        const result = await model.generateContent(queryPrompt);
        const response = await result.response;
        return {
          response: response.text(),
        };
      } catch (err: any) {
        this.logger.error(`Gemini SDK query failed: ${err.message}`);
        // Fallback to local DB query processing if Gemini API fails
      }
    }

    // Local DB query analytics fallback (used if GEMINI_API_KEY is not set or fails)
    const cleanPrompt = prompt.toLowerCase();

    if (cleanPrompt.includes('project') || cleanPrompt.includes('delayed')) {
      const delayed = workspaceContext.projects.filter(p => p.status === 'DELAYED');
      if (delayed.length === 0) {
        return {
          response: `### Delayed Projects Report
No projects are currently marked as **DELAYED** in Vexor OS.
* **Total Projects:** ${workspaceContext.projects.length}
* **Active Projects:** ${workspaceContext.projects.filter(p => p.status === 'ACTIVE').length}`,
        };
      }
      const list = delayed.map(p => `- **${p.name}** (Managed by: ${p.managerName}, Budget: INR ${p.budget?.toLocaleString() || 'N/A'})`).join('\n');
      return {
        response: `### Delayed Projects Report
I found ${delayed.length} delayed project(s) in your workspace:

${list}

**Recommendation:** Review task assignment loads and milestone deadlines for these engagements.`,
      };
    }

    if (cleanPrompt.includes('revenue') || cleanPrompt.includes('invoice') || cleanPrompt.includes('sales')) {
      const totalAmount = workspaceContext.invoices.reduce((sum, i) => sum + i.amount, 0);
      const paidAmount = workspaceContext.invoices.filter(i => i.status === 'PAID').reduce((sum, i) => sum + i.amount, 0);
      const pendingAmount = workspaceContext.invoices.filter(i => i.status === 'SENT' || i.status === 'OVERDUE').reduce((sum, i) => sum + i.amount, 0);
      return {
        response: `### Financial Ledger Summary
* **Total Accumulated Revenue:** ₹${paidAmount.toLocaleString()}
* **Outstanding Receivables:** ₹${pendingAmount.toLocaleString()}
* **Invoice Count:** ${workspaceContext.invoices.length} invoices total (${workspaceContext.invoices.filter(i => i.status === 'DRAFT').length} drafts)`,
      };
    }

    if (cleanPrompt.includes('lead') || cleanPrompt.includes('crm') || cleanPrompt.includes('deals')) {
      const won = workspaceContext.leads.filter(l => l.status === 'WON').length;
      const activeLeads = workspaceContext.leads.filter(l => l.status !== 'WON' && l.status !== 'LOST').length;
      return {
        response: `### Sales & CRM Pipeline Summary
* **Total Leads:** ${workspaceContext.leads.length}
* **Active Pipeline:** ${activeLeads} leads in qualification
* **Closed/Won Deals:** ${won} deals`,
      };
    }

    if (cleanPrompt.includes('employee') || cleanPrompt.includes('workload') || cleanPrompt.includes('staff')) {
      return {
        response: `### Workspace Workload Summary
* **Total Active Staff:** ${workspaceContext.staff.length} employees
* **Active Projects:** ${workspaceContext.projects.length}
* **Details:** You can view employee assignments, salaries, and attendance records under the **HRMS Directory** tab.`,
      };
    }

    // General fallback
    return {
      response: `### Vexor OS AI Business Intelligence Assistant
I am currently operating in **Local Database Analytics** mode. I can query your workspace database in real time.
Try asking me:
* *Show my delayed projects*
* *What is our outstanding invoice amount?*
* *How many leads are in the CRM pipeline?*
* *Show employee workload count*`,
    };
  }
}
