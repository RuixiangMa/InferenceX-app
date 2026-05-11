import type { Metadata } from 'next';

import { OmniProvider } from '@/components/omni/OmniContext';
import OmniChartDisplay from '@/components/omni/ui/ChartDisplay';
import { tabMetadata } from '@/lib/tab-meta';

export const metadata: Metadata = tabMetadata('omni');

export default function OmniPage() {
  return (
    <OmniProvider group="image">
      <OmniChartDisplay kind="image" />
    </OmniProvider>
  );
}
