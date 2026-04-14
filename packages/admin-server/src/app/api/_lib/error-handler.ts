import { NextResponse } from 'next/server';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
  ) {
    super(message);
  }
}

export function jsonError(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: { code: error.code ?? 'error', message: error.message } },
      { status: error.status },
    );
  }
  console.error('[admin-server] unexpected error', error);
  return NextResponse.json(
    { error: { code: 'internal', message: 'Internal Server Error' } },
    { status: 500 },
  );
}

export async function handleRoute<T>(handler: () => Promise<NextResponse<T>>): Promise<NextResponse> {
  try {
    return await handler();
  } catch (e) {
    return jsonError(e);
  }
}
