import { NextResponse, type NextRequest } from 'next/server';
import { getAdminContainer } from '../../../container';
import { handleRoute } from '../_lib/error-handler';
import { parsePositiveIntParam } from '../_lib/query-params';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
  return handleRoute(async () => {
    const url = new URL(req.url);
    const q = url.searchParams.get('q') ?? undefined;
    const tag = url.searchParams.get('tag') ?? undefined;
    const activeOnly = url.searchParams.get('active_only') === 'true';
    const page = parsePositiveIntParam(url, 'page');
    const pageSize = parsePositiveIntParam(url, 'page_size');

    const container = await getAdminContainer();
    const result = await container.testCaseService.list({ q, tag, activeOnly, page, pageSize });
    return NextResponse.json(result);
  });
}
