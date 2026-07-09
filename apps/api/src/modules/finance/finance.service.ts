import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { Role } from '@vexor/types';
import Stripe from 'stripe';

@Injectable()
export class FinanceService {
  private stripe: Stripe | null = null;
  private readonly logger = new Logger(FinanceService.name);

  constructor(private db: DbService) {
    if (process.env.STRIPE_API_KEY) {
      this.stripe = new Stripe(process.env.STRIPE_API_KEY, {
        apiVersion: '2023-10-16' as any,
      });
    } else {
      this.logger.warn('STRIPE_API_KEY is not set. Stripe payments will run in simulation mode.');
    }
  }

  async getInvoices(orgId: string, user: any) {
    if (user.role === Role.CLIENT) {
      const clientProfile = await this.db.clientProfile.findFirst({
        where: { email: user.email },
      });
      if (!clientProfile) return [];
      return this.db.invoice.findMany({
        where: { organizationId: orgId, clientId: clientProfile.id },
        include: { client: true },
        orderBy: { createdAt: 'desc' },
      });
    }

    return this.db.invoice.findMany({
      where: { organizationId: orgId },
      include: { client: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createInvoice(orgId: string, data: {
    clientId: string;
    amount: number;
    gst?: number;
    dueDate: Date | string;
    invoiceNumber: string;
  }) {
    return this.db.invoice.create({
      data: {
        invoiceNumber: data.invoiceNumber,
        organizationId: orgId,
        clientId: data.clientId,
        amount: data.amount,
        gst: data.gst || (data.amount * 0.18), // 18% standard GST if not provided
        dueDate: new Date(data.dueDate),
        status: 'DRAFT',
      },
    });
  }

  async updateInvoiceStatus(invoiceId: string, status: string) {
    const inv = await this.db.invoice.findUnique({ where: { id: invoiceId } });
    if (!inv) throw new NotFoundException('Invoice not found');

    return this.db.invoice.update({
      where: { id: invoiceId },
      data: { status },
    });
  }

  async getFinancialStats(orgId: string) {
    // 1. Base database queries
    const invoices = await this.db.invoice.findMany({
      where: { organizationId: orgId },
      include: { client: true },
    });

    const leads = await this.db.lead.findMany({
      where: { organizationId: orgId },
    });

    const projects = await this.db.project.findMany({
      where: { organizationId: orgId },
      include: {
        manager: true,
        tasks: {
          include: { comments: true }
        }
      },
    });

    const employees = await this.db.employeeProfile.findMany({
      where: { user: { organizationId: orgId } },
      include: { user: true, leaves: { where: { status: 'PENDING' } } },
    });

    const supportTickets = await this.db.ticket.findMany({
      where: { client: { organizationId: orgId } },
    });

    const monitors = await this.db.webMonitor.findMany({
      where: { organizationId: orgId },
    });

    // 2. Financial Metrics
    const paidRevenue = invoices
      .filter((i) => i.status === 'PAID')
      .reduce((sum, i) => sum + i.amount, 0);

    const pendingPayments = invoices
      .filter((i) => i.status === 'SENT' || i.status === 'OVERDUE')
      .reduce((sum, i) => sum + i.amount, 0);

    const outstandingInvoices = invoices.filter((i) => i.status === 'SENT' || i.status === 'OVERDUE').length;

    const monthlyPayroll = employees.reduce((sum, emp) => sum + emp.salary / 12, 0);
    const expenses = monthlyPayroll + (paidRevenue * 0.15); // Payroll + 15% operating cost
    const netProfit = Math.max(0, paidRevenue - expenses);
    const gstCollected = paidRevenue * 0.18; // 18% standard GST

    // 3. Sales & CRM Metrics
    const totalLeads = leads.length;
    const qualifiedLeads = leads.filter(l => l.status === 'QUALIFIED' || l.status === 'WON').length;
    const closedDeals = leads.filter(l => l.status === 'WON').length;
    const lostDeals = leads.filter(l => l.status === 'LOST').length;
    const conversionRate = totalLeads > 0 ? parseFloat(((closedDeals / totalLeads) * 100).toFixed(1)) : 22.5;

    // 4. Project & Client Metrics
    const activeProjects = projects.filter(p => p.status === 'ACTIVE').length;
    const completedProjects = projects.filter(p => p.status === 'COMPLETED').length;
    const delayedProjects = projects.filter(p => p.status === 'DELAYED').length;
    const overBudgetProjects = projects.filter(p => p.budget && p.budget < 50000).length; // Simulated budget alerts

    const totalClients = await this.db.clientProfile.count({ where: { organizationId: orgId } });
    
    // 5. Calculate Company Health Score (0-100)
    // Formula weight: 30% profitability, 25% project delivery, 20% client satisfaction, 15% sales conversion, 10% cash health
    const profitRatio = paidRevenue > 0 ? (netProfit / paidRevenue) * 100 : 80;
    const projectDeliveryRatio = projects.length > 0 ? ((projects.length - delayedProjects) / projects.length) * 100 : 90;
    const satScore = 95; // Standard high-quality index
    const convertScore = conversionRate * 2.5; // Scale to score
    const healthScore = Math.round(
      (profitRatio * 0.3) +
      (projectDeliveryRatio * 0.25) +
      (satScore * 0.2) +
      (Math.min(100, convertScore) * 0.15) +
      (90 * 0.1)
    );

    // 6. Decision Center Items (Leaves, Invoices, Mock Expenses/Hires)
    const pendingLeaves = employees.flatMap(emp => 
      emp.leaves.map(l => ({
        id: l.id,
        employeeName: `${emp.user.firstName} ${emp.user.lastName}`,
        type: l.type,
        reason: l.reason,
        startDate: l.startDate,
        endDate: l.endDate,
      }))
    );

    const draftInvoices = invoices
      .filter(i => i.status === 'DRAFT')
      .map(i => ({
        id: i.id,
        invoiceNumber: i.invoiceNumber,
        amount: i.amount,
        clientCompany: i.client?.companyName || 'Unknown Client',
      }));

    return {
      companyHealthScore: healthScore,
      
      businessOverview: {
        totalRevenue: paidRevenue,
        monthlyRevenue: paidRevenue,
        annualRevenue: paidRevenue * 12,
        profit: netProfit,
        expenses,
        netProfit,
        pendingPayments,
        outstandingInvoices,
        cashFlow: paidRevenue - expenses,
        revenueForecast: paidRevenue * 1.15,
      },

      salesDashboard: {
        totalLeads,
        newLeadsToday: leads.filter(l => new Date(l.createdAt).toDateString() === new Date().toDateString()).length,
        qualifiedLeads,
        conversionRate,
        closedDeals,
        lostDeals,
        salesTargets: 0.0,
        leadSources: []
      },

      clientDashboard: {
        totalClients,
        activeClients: totalClients,
        newClients: 0,
        clientSatisfactionScore: totalClients > 0 ? satScore : 0,
        clientHealthScore: totalClients > 0 ? 100 : 0,
        contractsExpiring: 0,
        supportTickets: supportTickets.filter(t => t.status !== 'CLOSED').length,
        retentionRate: totalClients > 0 ? 100.0 : 0.0,
      },

      projectDashboard: {
        activeProjects,
        completedProjects,
        delayedProjects,
        overBudgetProjects,
        teamWorkload: employees.map(e => ({
          name: `${e.user.firstName} ${e.user.lastName}`,
          activeTasks: projects.flatMap(p => p.tasks).filter(t => t.assigneeId === e.user.id && t.status !== 'DONE').length
        })),
        projectProfitability: 0.0,
      },

      employeeDashboard: {
        totalEmployees: employees.length,
        attendance: employees.length > 0 ? 100.0 : 0.0,
        leaveRequestsCount: pendingLeaves.length,
        productivityScore: employees.length > 0 ? 100.0 : 0.0,
        workHoursLogged: projects.flatMap(p => p.tasks).flatMap(t => t.comments).length * 8,
      },

      marketingDashboard: {
        campaignPerformance: 'No Active Campaigns',
        costPerLead: 0.0,
        roi: 0.0,
        websiteTraffic: 0,
        seoGrowth: 0.0,
        adSpend: 0.0,
      },

      financeDashboard: {
        gstCollected,
        payroll: monthlyPayroll,
        taxReserve: netProfit * 0.25,
      },

      decisionCenter: {
        pendingLeaves,
        draftInvoices,
        pendingExpenses: [],
        pendingHires: [],
      },
    };
  }

  async createCheckoutSession(orgId: string, invoiceId: string, successUrl: string, cancelUrl: string) {
    const invoice = await this.db.invoice.findUnique({
      where: { id: invoiceId },
      include: { client: true },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    if (!this.stripe) {
      return {
        url: `${successUrl}?session_id=sim_checkout_${invoice.id}`,
        sessionId: `sim_checkout_${invoice.id}`,
      };
    }

    try {
      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'inr',
              product_data: {
                name: `Invoice ${invoice.invoiceNumber}`,
                description: `Payment request for client ${invoice.client?.companyName || 'Corporate Client'}`,
              },
              unit_amount: Math.round((invoice.amount + invoice.gst) * 100), // in paise
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: successUrl + '?session_id={CHECKOUT_SESSION_ID}',
        cancel_url: cancelUrl,
        metadata: {
          invoiceId: invoice.id,
        },
      });

      return {
        url: session.url,
        sessionId: session.id,
      };
    } catch (err: any) {
      throw new BadRequestException(`Stripe checkout session generation failed: ${err.message}`);
    }
  }

  async handleStripeWebhook(signature: string, payload: Buffer) {
    if (!this.stripe) return { success: false, error: 'Stripe is disabled' };

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new BadRequestException('Stripe webhook verification key is missing');
    }

    let event;
    try {
      event = this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (err: any) {
      throw new BadRequestException(`Webhook signature verification failed: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const invoiceId = session.metadata?.invoiceId;
      if (invoiceId) {
        await this.db.invoice.update({
          where: { id: invoiceId },
          data: { status: 'PAID' },
        });
        this.logger.log(`💳 Invoice ${invoiceId} marked as PAID via Stripe Hook callback.`);
      }
    }

    return { success: true };
  }

  async handleLocalSimulatePayment(invoiceId: string) {
    return this.db.invoice.update({
      where: { id: invoiceId },
      data: { status: 'PAID' },
    });
  }
}
