import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getAdminContainer } from '../../../../container';
import { handleRoute, ApiError } from '../../_lib/error-handler';

export const dynamic = 'force-dynamic';

const PatchSchema = z.object({
  name: z.string().optional(),
  description: z.string().nullable().optional(),
  params: z.record(z.unknown()).optional(),
  expected: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
});

export async function GET(_req: NextRequest, ctx: { params: { id: string } }): Promise<NextResponse> {
  return handleRoute(async () => {
    const container = await getAdminContainer();
    const dto = await container.testCaseService.getById(ctx.params.id);
    return NextResponse.json(dto);
  });
}

export async function PATCH(req: NextRequest, ctx: { params: { id: string } }): Promise<NextResponse> {
  return handleRoute(async () => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new ApiError(400, 'invalid JSON', 'invalid_json');
    }
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(400, 'invalid patch payload', 'invalid_input');
    const container = await getAdminContainer();
    const dto = await container.testCaseService.patch(ctx.params.id, parsed.data);
    return NextResponse.json(dto);
  });
}
