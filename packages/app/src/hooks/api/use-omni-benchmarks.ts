import { useQuery } from '@tanstack/react-query';

import { type OmniModalityGroup, fetchOmniBenchmarks } from '@/lib/api';

export function useOmniBenchmarks(date?: string, group: OmniModalityGroup = 'image') {
  return useQuery({
    queryKey: ['omni-benchmarks', group, date ?? 'latest'] as const,
    queryFn: ({ signal }) => fetchOmniBenchmarks(date, group, signal),
  });
}
