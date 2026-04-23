/**
 *
 * Pure string-interpolation template engine for notification emails
 * and webhook payloads. No I/O — operates entirely on in-memory data.
 */

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
 */
export function renderWebhookPayload(event: string, data: unknown): string {
  return JSON.stringify({
    event,
    timestamp: new Date().toISOString(),
    data,
  });
}
