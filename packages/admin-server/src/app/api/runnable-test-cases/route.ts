import { NextResponse } from 'next/server';
import { getAdminContainer } from '../../../container';
import { handleRoute } from '../_lib/error-handler';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  return handleRoute(async () => {
    const container = await getAdminContainer();
    const items = await container.testCaseService.listRunnable();
    return NextResponse.json({ items });
  });
}
