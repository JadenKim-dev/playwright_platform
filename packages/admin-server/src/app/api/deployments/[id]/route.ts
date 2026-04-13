import { NextResponse, type NextRequest } from 'next/server';
import { getAdminContainer } from '../../../../container.js';
import { handleRoute } from '../../_lib/error-handler.js';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, ctx: { params: { id: string } }): Promise<NextResponse> {
  return handleRoute(async () => {
    const container = await getAdminContainer();
    const dto = await container.deploymentService.getById(ctx.params.id);
    return NextResponse.json(dto);
  });
}
