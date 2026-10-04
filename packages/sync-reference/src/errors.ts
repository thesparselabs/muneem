// A request-level failure, as the HTTP layer would answer it (status + error code).
export class ServerError extends Error {
  constructor(readonly status: number, readonly code: string, message = code) {
    super(message);
    this.name = 'ServerError';
  }
}

export const isServerError = (e: unknown): e is ServerError => e instanceof ServerError;
