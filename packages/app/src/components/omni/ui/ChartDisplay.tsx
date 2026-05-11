'use client';

import { useCallback } from 'react';

import { useOmniContext } from '@/components/omni/OmniContext';
import { Card } from '@/components/ui/card';
import { ChartShareActions } from '@/components/ui/chart-display-helpers';
import { ChartSection } from '@/components/ui/chart-section';
import { exportToCsv } from '@/lib/csv-export';

import OmniBarChartD3 from './BarChartD3';

export default function OmniChartDisplay({ kind = 'image' }: { kind?: 'image' | 'video' }) {
  const CHART_ID = 'omni-chart';
  const { setIsLegendExpanded, chartData } = useOmniContext();
  const isVideo = kind === 'video';

  const handleExportCsv = useCallback(() => {
    const headers = [
      'Hardware',
      'Framework',
      'Model',
      'Precision',
      'Throughput (samples/s/GPU)',
      'Latency (s/sample)',
      'Resolution',
      'Steps',
      ...(isVideo ? ['Frames', 'FPS'] : []),
      'Date',
    ];
    const rows = chartData.map((d) => [
      d.hardwareLabel,
      d.frameworkLabel,
      d.modelLabel,
      d.precision,
      d.throughputPerGpu.toFixed(4),
      d.latency.toFixed(2),
      `${d.outputWidth}x${d.outputHeight}`,
      String(d.numInferenceSteps),
      ...(isVideo ? [String(d.numFrames), String(d.fps)] : []),
      d.date,
    ]);
    exportToCsv(isVideo ? 'InferenceX_omni_video' : 'InferenceX_omni', headers, rows);
  }, [chartData, isVideo]);

  return (
    <div data-testid="omni-chart-display" className="flex flex-col gap-4">
      <section>
        <Card>
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold mb-2">
                  {isVideo ? 'Video Generation Benchmarks' : 'Image Generation Benchmarks'}
                </h2>
                <p className="text-muted-foreground text-sm mb-4">
                  {isVideo
                    ? 'Throughput and latency for video generation workloads across GPU models and frameworks. Measured in samples per second per GPU.'
                    : 'Throughput and latency for image generation workloads across GPU models and frameworks. Measured in samples per second per GPU.'}
                </p>
              </div>
              <ChartShareActions />
            </div>
          </div>
        </Card>
      </section>

      <ChartSection
        chartId={CHART_ID}
        analyticsPrefix="omni"
        zoomResetEvent={`d3chart_zoom_reset_${CHART_ID}`}
        setIsLegendExpanded={setIsLegendExpanded}
        onExportCsv={handleExportCsv}
        exportFileName="InferenceX_omni"
      >
        <OmniBarChartD3 />
      </ChartSection>
    </div>
  );
}
