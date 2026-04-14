import { NextResponse, type NextRequest } from 'next/server';
import { getAdminContainer } from '../../../../../container';
import { handleRoute } from '../../../_lib/error-handler';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, ctx: { params: { id: string } }): Promise<NextResponse> {
  return handleRoute(async () => {
    const container = await getAdminContainer();
    const url = await container.runService.getReportUrl(ctx.params.id);
    return NextResponse.json({ url });
  });
}
