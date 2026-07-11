import { AppError } from "@/lib/errors/AppError";

/** Transient failure — processor may schedule a retry until max_attempts. */
export class RetryableJobError extends AppError {
  constructor(code: string, safeMessage: string, options?: ErrorOptions) {
    super(code, 503, safeMessage, options);
  }
}

/** Non-retryable failure — job should dead-letter immediately. */
export class PermanentJobError extends AppError {
  constructor(code: string, safeMessage: string, options?: ErrorOptions) {
    super(code, 422, safeMessage, options);
  }
}

export function isRetryableJobError(error: unknown): error is RetryableJobError {
  return error instanceof RetryableJobError;
}

export function isPermanentJobError(error: unknown): error is PermanentJobError {
  return error instanceof PermanentJobError;
}
