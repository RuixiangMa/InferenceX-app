import type { Metadata } from 'next';

import { OmniProvider } from '@/components/omni/OmniContext';
import OmniChartDisplay from '@/components/omni/ui/ChartDisplay';
import { tabMetadata } from '@/lib/tab-meta';

export const metadata: Metadata = tabMetadata('omni-video');

export default function OmniVideoPage() {
  return (
    <OmniProvider group="video">
      <OmniChartDisplay kind="video" />
    </OmniProvider>
  );
}
