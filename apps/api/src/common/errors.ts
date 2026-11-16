export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code = 'APP_ERROR',
  ) {
    super(message);
  }
}

export const notFound = (msg = 'Resource not found') => new AppError(404, msg, 'NOT_FOUND');
export const unauthorized = (msg = 'Unauthorized') => new AppError(401, msg, 'UNAUTHORIZED');
export const forbidden = (msg = 'Forbidden') => new AppError(403, msg, 'FORBIDDEN');
