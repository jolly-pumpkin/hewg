
export interface WebhookResult {
  readonly success: boolean;
  readonly statusCode: number;
  readonly responseBody?: string;
}

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
