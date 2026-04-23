/**
 * @hewg-module taskq/notifications/router
 *
 * Routes notification events to the appropriate delivery channel
 * (email via SMTP or webhook via HTTP). Logs all delivery attempts.
 */

import type { Job } from "../types/job";
import type { TenantId } from "../types/tenant";
import { renderEmailTemplate, renderWebhookPayload } from "./template-renderer";
import type { SmtpConfig } from "./email-sender";
import { sendEmail } from "./email-sender";
import { dispatchWebhook } from "./webhook-dispatcher";

/**
 * Routes notification events to email and webhook channels based on
 * the configured endpoints. Each delivery attempt is logged for
 * audit purposes.
 */
export class NotificationRouter {
  private readonly smtpConfig: SmtpConfig;
  private readonly webhookUrls: Record<string, string>;

  constructor(smtpConfig: SmtpConfig, webhookUrls: Record<string, string>) {
    this.smtpConfig = smtpConfig;
    this.webhookUrls = webhookUrls;
  }

  /**
   * Send notifications when a job completes. Dispatches both an
   * email notification and a webhook event if a URL is configured.
   *
   * @hewg-module taskq/notifications/router
   * @effects net.https, log
   */
  async notifyJobCompleted(job: Job, tenantId: TenantId): Promise<void> {
    const vars = {
      jobId: job.id as string,
      queueName: job.queueName,
      tenantId: tenantId as string,
    };

    const emailContent = renderEmailTemplate("job-completed", vars);
    const emailOk = await sendEmail(
      this.smtpConfig,
      emailContent,
      `tenant-${tenantId as string}@taskq.local`,
    );
    console.log(`[notifications] job-completed email to ${tenantId}: ${emailOk ? "sent" : "failed"}`);

    const webhookUrl = this.webhookUrls["job-completed"];
    if (webhookUrl) {
      const payload = renderWebhookPayload("job.completed", { jobId: job.id, tenantId });
      const result = await dispatchWebhook(webhookUrl, payload);
      console.log(`[notifications] job-completed webhook: status=${result.statusCode} ok=${result.success}`);
    }
  }

  /**
   * Send notifications when a job fails. Includes the failure reason
   * in both the email and webhook payloads.
   *
   * @hewg-module taskq/notifications/router
   * @effects net.https, log
   */
  async notifyJobFailed(
    job: Job,
    tenantId: TenantId,
    reason: string,
  ): Promise<void> {
    const vars = {
      jobId: job.id as string,
      queueName: job.queueName,
      tenantId: tenantId as string,
      reason,
    };

    const emailContent = renderEmailTemplate("job-failed", vars);
    const emailOk = await sendEmail(
      this.smtpConfig,
      emailContent,
      `tenant-${tenantId as string}@taskq.local`,
    );
    console.log(`[notifications] job-failed email to ${tenantId}: ${emailOk ? "sent" : "failed"}`);

    const webhookUrl = this.webhookUrls["job-failed"];
    if (webhookUrl) {
      const payload = renderWebhookPayload("job.failed", { jobId: job.id, tenantId, reason });
      const result = await dispatchWebhook(webhookUrl, payload);
      console.log(`[notifications] job-failed webhook: status=${result.statusCode} ok=${result.success}`);
    }
  }

  /**
   * Send notifications when a tenant account is suspended. Only
   * dispatches a webhook if a URL is configured for the event.
   *
   * @hewg-module taskq/notifications/router
   * @effects net.https, log
   */
  async notifyTenantSuspended(tenantId: TenantId): Promise<void> {
    const vars = { tenantId: tenantId as string };

    const emailContent = renderEmailTemplate("tenant-suspended", vars);
    const emailOk = await sendEmail(
      this.smtpConfig,
      emailContent,
      `tenant-${tenantId as string}@taskq.local`,
    );
    console.log(`[notifications] tenant-suspended email to ${tenantId}: ${emailOk ? "sent" : "failed"}`);

    const webhookUrl = this.webhookUrls["tenant-suspended"];
    if (webhookUrl) {
      const payload = renderWebhookPayload("tenant.suspended", { tenantId });
      const result = await dispatchWebhook(webhookUrl, payload);
      console.log(`[notifications] tenant-suspended webhook: status=${result.statusCode} ok=${result.success}`);
    }
  }
}
