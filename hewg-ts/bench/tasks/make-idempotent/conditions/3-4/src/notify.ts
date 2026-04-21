/**
 * @hewg-module idempotent/notify
 */

/**
 * Send a notification to the fulfillment system.
 * @param orderId - the order that was processed
 * @effects net.https
 */
export async function notifyFulfillment(orderId: string): Promise<void> {
  await fetch("https://fulfillment.example.com/notify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId, timestamp: new Date().toISOString() }),
  })
}
