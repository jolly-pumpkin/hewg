# Task: Add Webhook Notification on Job Failure

## Context

This is a multi-tenant task queue service. The notification system (`src/notifications/`) already supports email and webhook dispatch. When a job fails, we currently only log it.

## Task

Add webhook notification on job failure, following the existing notification patterns.

1. In `src/queue/dead-letter.ts`, after a job is moved to the dead letter queue, trigger a failure notification via the `NotificationRouter`.
2. The `NotificationRouter` in `src/notifications/router.ts` already has a `notifyJobFailed` method — wire it into the dead letter flow.
3. You'll need to pass a `NotificationRouter` instance to the dead letter functions. Update `moveToDeadLetter` to accept a notification router parameter.
4. Update `QueueManager` in `src/queue/manager.ts` to provide the notification router to dead letter operations.
5. Follow existing patterns: look at how `notifyJobCompleted` is called elsewhere.
6. Do NOT modify `src/transforms/` or `src/types/` files.

## Verification

Run `bash test.sh`
