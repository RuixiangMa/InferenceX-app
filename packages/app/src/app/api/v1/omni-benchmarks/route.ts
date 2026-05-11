import { type NextRequest, NextResponse } from 'next/server';

import { FIXTURES_MODE, JSON_MODE, getDb } from '@semianalysisai/inferencex-db/connection';
import * as jsonProvider from '@semianalysisai/inferencex-db/json-provider';
import {
  type OmniModalityGroup,
  getLatestOmniBenchmarks,
} from '@semianalysisai/inferencex-db/queries/omni-benchmarks';

import { cachedJson, cachedQuery } from '@/lib/api-cache';

export const dynamic = 'force-dynamic';

const getCachedOmniBenchmarks = cachedQuery(
  (date?: string, group: OmniModalityGroup = 'image') => {
    if (JSON_MODE) return Promise.resolve(jsonProvider.getLatestOmniBenchmarks(date, group));
    return getLatestOmniBenchmarks(getDb(), date, group);
  },
  'omni-benchmarks',
  { blobOnly: true },
);

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const date = params.get('date') ?? undefined;
  const rawGroup = params.get('group');
  const group: OmniModalityGroup =
    rawGroup === 'all' || rawGroup === 'video' || rawGroup === 'image' ? rawGroup : 'image';

  if (FIXTURES_MODE) {
    return cachedJson([]);
  }

  try {
    const rows = await getCachedOmniBenchmarks(date, group);
    return cachedJson(rows);
  } catch (error) {
    console.error('Error fetching omni benchmarks:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
