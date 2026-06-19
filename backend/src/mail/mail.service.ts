import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST');
    if (host) {
      this.transporter = nodemailer.createTransport({
        host,
        port: Number(this.config.get('SMTP_PORT')) || 587,
        secure: Number(this.config.get('SMTP_PORT')) === 465,
        auth: {
          user: this.config.get<string>('SMTP_USER'),
          pass: this.config.get<string>('SMTP_PASS'),
        },
      });
    }
  }

  /**
   * Sends an email. If SMTP is not configured (dev), logs to console so flows
   * still work end-to-end without a mail provider.
   */
  async send(to: string, subject: string, html: string): Promise<void> {
    if (!this.transporter) {
      this.logger.log(
        `📧 [DEV EMAIL] to=${to} | subject="${subject}"\n${stripHtml(html)}`,
      );
      return;
    }
    const from = this.config.get<string>('SMTP_USER') || 'no-reply@erp.local';
    await this.transporter.sendMail({ from, to, subject, html });
    this.logger.log(`📧 Email sent to ${to} — "${subject}"`);
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
