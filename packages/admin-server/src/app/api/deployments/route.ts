import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { DeploymentStatus } from '@platform/shared';
import { getAdminContainer } from '../../../container.js';
import { handleRoute, ApiError } from '../_lib/error-handler.js';
import { parsePositiveIntParam } from '../_lib/query-params.js';

export const dynamic = 'force-dynamic';

const CreateSchema = z.object({ gitRef: z.string().min(1) });

export async function GET(req: NextRequest): Promise<NextResponse> {
  return handleRoute(async () => {
    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const page = parsePositiveIntParam(url, 'page');
    if (status && !(Object.values(DeploymentStatus) as string[]).includes(status)) {
      throw new ApiError(400, `invalid status: ${status}`, 'invalid_input');
    }
    const validStatus = status ? (status as DeploymentStatus) : undefined;
    const container = await getAdminContainer();
    const result = await container.deploymentService.list({ status: validStatus, page });
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
    if (!parsed.success) throw new ApiError(400, 'gitRef required', 'invalid_input');
    const container = await getAdminContainer();
    const dto = await container.deploymentService.create(parsed.data);
    return NextResponse.json(dto, { status: 202 });
  });
}
