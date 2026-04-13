import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getAdminContainer } from '../../../container.js';
import { handleRoute, ApiError } from '../_lib/error-handler.js';

export const dynamic = 'force-dynamic';

const CreateSchema = z.object({
  testCaseIds: z.array(z.string().min(1)).min(1),
  paramOverrides: z.record(z.record(z.unknown())).optional(),
});

export async function GET(req: NextRequest): Promise<NextResponse> {
  return handleRoute(async () => {
    const url = new URL(req.url);
    const page = url.searchParams.get('page') ? Number(url.searchParams.get('page')) : undefined;
    const container = await getAdminContainer();
    const result = await container.runService.list({ page });
    return NextResponse.json(result);
  });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  return handleRoute(async () => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new ApiError(400, 'invalid JSON', 'invalid_json');
    }
    const parsed = CreateSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(400, 'invalid run payload', 'invalid_input');
    const container = await getAdminContainer();
    const dto = await container.runService.create(parsed.data);
    return NextResponse.json(dto, { status: 202 });
  });
}
