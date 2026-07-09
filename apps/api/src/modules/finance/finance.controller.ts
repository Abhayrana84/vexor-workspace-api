import { Controller, Get, Post, Patch, Body, Param, UseGuards, Request, Headers } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { RolesGuard } from '../../common/roles.guard';
import { Roles } from '../../common/roles.decorator';
import { Role } from '@vexor/types';
import { CreateInvoiceDto, UpdateInvoiceStatusDto, CreateCheckoutSessionDto } from './dto/finance.dto';

@Controller('finance')
export class FinanceController {
  constructor(private financeService: FinanceService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.FOUNDER, Role.CO_FOUNDER, Role.ADMIN, Role.FINANCE_MANAGER, Role.CLIENT, Role.SALES_MANAGER)
  @Get('invoices')
  async getInvoices(@Request() req: any) {
    return this.financeService.getInvoices(req.user.organizationId, req.user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.FOUNDER, Role.CO_FOUNDER, Role.ADMIN, Role.FINANCE_MANAGER)
  @Post('invoices')
  async createInvoice(@Request() req: any, @Body() body: CreateInvoiceDto) {
    return this.financeService.createInvoice(req.user.organizationId, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.FOUNDER, Role.CO_FOUNDER, Role.ADMIN, Role.FINANCE_MANAGER)
  @Patch('invoices/:id/status')
  async updateInvoiceStatus(@Param('id') id: string, @Body() body: UpdateInvoiceStatusDto) {
    return this.financeService.updateInvoiceStatus(id, body.status);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.FOUNDER, Role.CO_FOUNDER, Role.ADMIN, Role.FINANCE_MANAGER, Role.SALES_MANAGER)
  @Get('stats')
  async getStats(@Request() req: any) {
    return this.financeService.getFinancialStats(req.user.organizationId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('checkout-session')
  async createCheckoutSession(@Request() req: any, @Body() body: CreateCheckoutSessionDto) {
    return this.financeService.createCheckoutSession(
      req.user.organizationId,
      body.invoiceId,
      body.successUrl,
      body.cancelUrl
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('invoices/:id/simulate-payment')
  async simulatePayment(@Param('id') id: string) {
    return this.financeService.handleLocalSimulatePayment(id);
  }

  @Post('stripe-webhook')
  async stripeWebhook(@Headers('stripe-signature') signature: string, @Request() req: any) {
    const payload = req.rawBody || Buffer.from(JSON.stringify(req.body));
    return this.financeService.handleStripeWebhook(signature, payload);
  }
}
