import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private resendClient: Resend | null = null;

  constructor() {
    if (process.env.RESEND_API_KEY) {
      this.resendClient = new Resend(process.env.RESEND_API_KEY);
    } else {
      this.logger.warn('RESEND_API_KEY is not set. Mailing is running in console-logging mode.');
    }
  }

  async sendEmail(to: string, subject: string, htmlContent: string) {
    if (!this.resendClient) {
      this.logger.log(`📬 [LOCAL MAIL SIMULATION] Sent to: ${to} | Subject: ${subject}`);
      return { id: 'simulated-mail-id' };
    }

    try {
      const response = await this.resendClient.emails.send({
        from: process.env.MAIL_FROM || 'Vexor OS <onboarding@resend.dev>',
        to,
        subject,
        html: htmlContent,
      });

      this.logger.log(`✅ Email dispatched successfully via Resend API to: ${to} (ID: ${response.data?.id})`);
      return response;
    } catch (err: any) {
      this.logger.error(`❌ Failed to send email to ${to} via Resend: ${err.message}`);
      throw new Error(`Mailing failure: ${err.message}`);
    }
  }
}
