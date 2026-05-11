'use client';

import { useMemo, useRef } from 'react';
import * as d3 from 'd3';

import { HW_REGISTRY } from '@semianalysisai/inferencex-constants';
import { track } from '@/lib/analytics';
import { getModelSortIndex } from '@/lib/constants';
import { contrastColors } from '@/lib/d3-chart/contrast-colors';
import { D3Chart, type LayerConfig } from '@/lib/d3-chart/D3Chart';
import type { ContinuousScale } from '@/lib/d3-chart/types';
import { computeLeftMargin } from '@/lib/d3-chart/dynamic-margins';

import { useOmniContext } from '@/components/omni/OmniContext';
import type { OmniChartDataPoint } from '@/components/omni/types';
import { useThemeColors } from '@/hooks/useThemeColors';
import ChartLegend from '@/components/ui/chart-legend';

const BASE_MARGIN = { top: 24, right: 24, bottom: 40 };

type ChartItem = OmniChartDataPoint;

const generateTooltipContent = (data: ChartItem, isPinned: boolean): string => `
    <div style="background: var(--popover); border: 1px solid var(--border); border-radius: 8px; padding: 12px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); user-select: ${isPinned ? 'text' : 'none'};">
      ${isPinned ? '<div style="color: var(--muted-foreground); font-size: 10px; margin-bottom: 6px; font-style: italic;">Click elsewhere to dismiss</div>' : ''}
      <div style="color: var(--foreground); font-size: 12px; font-weight: 600; margin-bottom: 8px;">${data.hardwareLabel} — ${data.frameworkLabel}</div>
      <div style="color: var(--muted-foreground); font-size: 11px; margin-bottom: 4px;"><strong>Throughput:</strong> ${data.throughputPerGpu.toFixed(4)} samples/s/GPU</div>
      <div style="color: var(--muted-foreground); font-size: 11px; margin-bottom: 4px;"><strong>Latency:</strong> ${data.latency.toFixed(2)} s/sample</div>
      <div style="color: var(--muted-foreground); font-size: 11px; margin-bottom: 4px;"><strong>Model:</strong> ${data.modelLabel}</div>
      <div style="color: var(--muted-foreground); font-size: 11px; margin-bottom: 4px;"><strong>Resolution:</strong> ${data.outputWidth}×${data.outputHeight}</div>
      <div style="color: var(--muted-foreground); font-size: 11px;"><strong>Steps:</strong> ${data.numInferenceSteps}</div>
    </div>
  `;

export default function OmniBarChartD3() {
  const hoveredBarXRef = useRef(0);
  const {
    error,
    chartData,
    highContrast,
    setHighContrast,
    enabledHardware,
    toggleHardware,
    removeHardware,
    hardwareWithData,
    selectAllHardware,
    isLegendExpanded,
    setIsLegendExpanded,
  } = useOmniContext();

  const sortedHwKeys = useMemo(
    () =>
      [...hardwareWithData].toSorted(
        (a, b) => getModelSortIndex(a) - getModelSortIndex(b) || a.localeCompare(b),
      ),
    [hardwareWithData],
  );

  const activeHwKeys = useMemo(
    () => sortedHwKeys.filter((hw) => enabledHardware.has(hw)),
    [sortedHwKeys, enabledHardware],
  );

  const { resolveColor, getCssColor } = useThemeColors({
    highContrast,
    identifiers: sortedHwKeys,
    activeKeys: activeHwKeys,
  });

  const legendItems = useMemo(
    () =>
      sortedHwKeys.map((hw) => {
        const entry = HW_REGISTRY[hw];
        return {
          name: hw,
          label: entry?.label ?? hw,
          color: resolveColor(hw),
          isActive: enabledHardware.has(hw),
          onClick: () => {
            toggleHardware(hw);
            track('omni_hardware_toggled', { hardware: hw });
          },
        };
      }),
    [sortedHwKeys, enabledHardware, toggleHardware, resolveColor],
  );

  const sortedChartData = useMemo(
    () =>
      [...chartData].toSorted(
        (a, b) =>
          getModelSortIndex(a.hardware) - getModelSortIndex(b.hardware) ||
          a.hardware.localeCompare(b.hardware),
      ),
    [chartData],
  );

  const dynamicHeight = useMemo(() => {
    const barCount = sortedChartData.length || 1;
    return Math.max(400, barCount * 45 + 80);
  }, [sortedChartData.length]);

  const maxThroughput = useMemo(
    () => Math.max(0.01, ...sortedChartData.map((d) => d.throughputPerGpu)),
    [sortedChartData],
  );

  const yDomain = useMemo(
    () => [...sortedChartData].toReversed().map((d) => `${d.hardwareLabel} (${d.frameworkLabel})`),
    [sortedChartData],
  );

  const chartMargin = useMemo(
    () => ({ ...BASE_MARGIN, left: computeLeftMargin(yDomain) }),
    [yDomain],
  );

  const layers = useMemo(
    (): LayerConfig<ChartItem>[] => [
      {
        type: 'horizontalBar',
        data: sortedChartData,
        config: {
          getY: (d) => `${d.hardwareLabel} (${d.frameworkLabel})`,
          getX: (d) => d.throughputPerGpu,
          getColor: (d) => getCssColor(resolveColor(d.hardware)),
          rx: 2,
          opacity: 1,
          keyFn: (d) => `${d.hardware}-${d.framework}`,
        },
      },
      {
        type: 'custom',
        key: 'bar-labels',
        render: (group, ctx) => {
          const yScale = ctx.yScale as d3.ScaleBand<string>;

          group
            .selectAll<SVGTextElement, ChartItem>('.value-label')
            .data(sortedChartData, (d) => `${d.hardware}-${d.framework}`)
            .join('text')
            .attr('class', 'value-label')
            .attr('y', (d) => {
              const label = `${d.hardwareLabel} (${d.frameworkLabel})`;
              return (yScale(label) ?? 0) + yScale.bandwidth() / 2;
            })
            .attr('dy', '0.35em')
            .attr('font-size', '11px')
            .attr('font-weight', '600')
            .style('pointer-events', 'none')
            .text((d) => `${d.throughputPerGpu.toFixed(4)} samples/s/GPU`)
            .each(function (d) {
              const _label = `${d.hardwareLabel} (${d.frameworkLabel})`;
              const barEnd = (ctx.xScale as d3.ScaleLinear<number, number>)(d.throughputPerGpu);
              const textW = this.getComputedTextLength?.() ?? 100;
              const fitsInside = barEnd > textW + 24;
              const fill = fitsInside
                ? contrastColors(getCssColor(resolveColor(d.hardware)))
                : 'var(--foreground)';
              d3.select(this)
                .attr('x', fitsInside ? barEnd - 10 : barEnd + 6)
                .attr('text-anchor', fitsInside ? 'end' : 'start')
                .style('fill', fill);
            });
        },
        onZoom: (group, ctx) => {
          const newXScale = ctx.newXScale as d3.ScaleLinear<number, number>;
          group.selectAll<SVGTextElement, ChartItem>('.value-label').each(function (d) {
            const barEnd = newXScale(d.throughputPerGpu);
            const textW = this.getComputedTextLength?.() ?? 100;
            const fitsInside = barEnd > textW + 24;
            const fill = fitsInside
              ? contrastColors(getCssColor(resolveColor(d.hardware)))
              : 'var(--foreground)';
            d3.select(this)
              .attr('x', fitsInside ? barEnd - 10 : barEnd + 6)
              .attr('text-anchor', fitsInside ? 'end' : 'start')
              .style('fill', fill);
          });
        },
      },
    ],
    [sortedChartData, getCssColor, resolveColor],
  );

  const xAxisConfig = useMemo(
    () => ({
      label: 'Throughput (samples/s/GPU)',
      tickFormat: (d: d3.AxisDomain) => String(d) as string,
      tickCount: 5,
    }),
    [],
  );

  const isEmpty = error || chartData.length === 0;

  const emptyOverlay = isEmpty ? (
    <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-[2px] rounded-lg z-10">
      <p className="text-sm font-medium text-muted-foreground bg-background/90 border border-border rounded-md px-4 py-2 shadow-sm">
        {error ? 'Failed to load omni benchmark data.' : 'No omni benchmark data available.'}
      </p>
    </div>
  ) : null;

  return (
    <div className="relative">
      <D3Chart<ChartItem>
        chartId="omni-chart"
        data={sortedChartData}
        height={dynamicHeight}
        margin={chartMargin}
        watermark="logo"
        grabCursor
        clipContent={false}
        noDataOverlay={emptyOverlay}
        instructions="Shift+Scroll to zoom horizontally · Drag to pan · Double-click to reset · Hover for details"
        xScale={{ type: 'linear', domain: [0, maxThroughput * 1.1] }}
        yScale={{ type: 'band', domain: yDomain, padding: 0.15 }}
        xAxis={xAxisConfig}
        layers={layers}
        zoom={{
          enabled: true,
          axes: 'x',
          scaleExtent: [0.1, 10],
          rescaleX: (xScale, transform) => {
            const [x0, x1] = xScale.domain() as [number, number];
            const newX0 = x0 / transform.k;
            const newX1 = x1 / transform.k;
            return xScale.copy().domain([newX0, newX1]) as ContinuousScale;
          },
          customTransformStorage: (transform) => d3.zoomIdentity.scale(transform.k),
        }}
        tooltip={{
          rulerType: 'vertical',
          content: generateTooltipContent,
          getRulerX: () => hoveredBarXRef.current,
          getRulerY: (d, ys) => {
            const bandScale = ys as unknown as d3.ScaleBand<string>;
            const label = `${d.hardwareLabel} (${d.frameworkLabel})`;
            return (bandScale(label) ?? 0) + bandScale.bandwidth() / 2;
          },
          onHoverStart: (sel) => {
            hoveredBarXRef.current = parseFloat(sel.attr('width') || '0');
            sel.attr('stroke', 'var(--foreground)').attr('stroke-width', 1.5);
          },
          onHoverEnd: (sel) => {
            sel.attr('stroke', 'none');
          },
          attachToLayer: 0,
        }}
        legendElement={
          <ChartLegend
            variant="sidebar"
            legendItems={legendItems}
            onItemRemove={removeHardware}
            isLegendExpanded={isLegendExpanded}
            onExpandedChange={(expanded) => {
              setIsLegendExpanded(expanded);
              track('omni_legend_expanded', { expanded });
            }}
            switches={[
              {
                id: 'omni-high-contrast',
                label: 'High Contrast',
                checked: highContrast,
                onCheckedChange: (checked) => {
                  setHighContrast(checked);
                  track('omni_high_contrast_toggled', { enabled: checked });
                },
              },
            ]}
            actions={
              enabledHardware.size < hardwareWithData.size
                ? [
                    {
                      id: 'omni-reset-filter',
                      label: 'Reset filter',
                      onClick: () => {
                        selectAllHardware();
                        track('omni_filter_reset');
                      },
                    },
                  ]
                : []
            }
            enableTooltips={true}
          />
        }
      />
    </div>
  );
}
