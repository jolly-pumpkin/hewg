/**
 * @hewg-module taskq/notifications/template-renderer
 *
 * Pure string-interpolation template engine for notification emails
 * and webhook payloads. No I/O — operates entirely on in-memory data.
 */

/** Rendered email content with subject and both text/HTML bodies. */
export interface EmailContent {
  readonly subject: string;
  readonly textBody: string;
  readonly htmlBody: string;
}

const EMAIL_TEMPLATES: Record<string, { subject: string; text: string; html: string }> = {
  "job-completed": {
    subject: "Job {{jobId}} completed",
    text: "Your job {{jobId}} in queue {{queueName}} has completed successfully.\n\nTenant: {{tenantId}}\nStatus: completed",
    html: "<h2>Job Completed</h2><p>Your job <strong>{{jobId}}</strong> in queue <em>{{queueName}}</em> has completed successfully.</p><p>Tenant: {{tenantId}}</p>",
  },
  "job-failed": {
    subject: "Job {{jobId}} failed",
    text: "Your job {{jobId}} in queue {{queueName}} has failed.\n\nTenant: {{tenantId}}\nReason: {{reason}}",
    html: "<h2>Job Failed</h2><p>Your job <strong>{{jobId}}</strong> in queue <em>{{queueName}}</em> has failed.</p><p>Reason: {{reason}}</p>",
  },
  "tenant-suspended": {
    subject: "Tenant {{tenantId}} suspended",
    text: "Tenant account {{tenantId}} has been suspended. All pending jobs have been paused.\n\nPlease contact support to resolve this issue.",
    html: "<h2>Account Suspended</h2><p>Tenant account <strong>{{tenantId}}</strong> has been suspended.</p><p>Please contact support to resolve this issue.</p>",
  },
};

/**
 * Interpolate variables into a named template string. Each
 * occurrence of {{key}} in the template is replaced with the
 * corresponding value from the vars map.
 */
function interpolate(
  template: string,
  vars: Record<string, string>,
): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  return result;
}

/**
 * Render a named email template with the provided variable
 * substitutions. Returns an EmailContent object with subject, text
 * body, and HTML body. Falls back to a generic template if the name
 * is not recognized.
 *
 * @hewg-module taskq/notifications/template-renderer
 * @effects
 */
export function renderEmailTemplate(
  templateName: string,
  vars: Record<string, string>,
): EmailContent {
  const tmpl = EMAIL_TEMPLATES[templateName];
  if (!tmpl) {
    return {
      subject: `Notification: ${templateName}`,
      textBody: JSON.stringify(vars, null, 2),
      htmlBody: `<pre>${JSON.stringify(vars, null, 2)}</pre>`,
    };
  }

  return {
    subject: interpolate(tmpl.subject, vars),
    textBody: interpolate(tmpl.text, vars),
    htmlBody: interpolate(tmpl.html, vars),
  };
}

/**
 * Render a webhook payload as a JSON string containing the event
 * name, timestamp, and the raw data object.
 *
 * @hewg-module taskq/notifications/template-renderer
 * @effects
 */
export function renderWebhookPayload(event: string, data: unknown): string {
  return JSON.stringify({
    event,
    timestamp: new Date().toISOString(),
    data,
  });
}
