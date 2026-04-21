/**
 * @hewg-module retry/types
 */

/** A user record returned by the API. */
export type User = {
  id: string
  name: string
  email: string
}

/** Thrown when the API returns a non-OK status. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = "ApiError"
  }
}
