/**
 * @hewg-module taskq/notifications/webhook-dispatcher
 *
 * Dispatches webhook payloads to external HTTP endpoints using fetch.
 */

/** Result of a webhook delivery attempt. */
export interface WebhookResult {
  readonly success: boolean;
  readonly statusCode: number;
  readonly responseBody?: string;
}

/**
 * Dispatch a webhook payload to the given URL via an HTTP POST
 * request. Merges any caller-supplied headers with sensible defaults
 * for JSON content. Returns a WebhookResult indicating delivery
 * success or failure.
 *
 * @hewg-module taskq/notifications/webhook-dispatcher
 * @effects net.https
 */
export async function dispatchWebhook(
  url: string,
  payload: string,
  headers?: Record<string, string>,
): Promise<WebhookResult> {
  const mergedHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "taskq-webhook/1.0",
    ...headers,
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: mergedHeaders,
      body: payload,
    });

    const responseBody = await response.text();

    return {
      success: response.ok,
      statusCode: response.status,
      responseBody,
    };
  } catch (err) {
    return {
      success: false,
      statusCode: 0,
      responseBody: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
