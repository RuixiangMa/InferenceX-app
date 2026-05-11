'use client';

import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  DB_MODEL_TO_DISPLAY,
  FW_REGISTRY,
  HW_REGISTRY,
} from '@semianalysisai/inferencex-constants';
import {
  useChartUIState,
  useChartToggleSet,
  useAutoInitializeToggleSet,
  useUrlStateSync,
} from '@/hooks/useChartContext';
import { useOmniBenchmarks } from '@/hooks/api/use-omni-benchmarks';
import { useUrlState } from '@/hooks/useUrlState';
import type { OmniBenchmarkRow, OmniModalityGroup } from '@/lib/api';
import type { OmniChartDataPoint, OmniChartContextType } from './types';

export const OmniContext = createContext<OmniChartContextType | undefined>(undefined);

function toChartData(rows: OmniBenchmarkRow[]): OmniChartDataPoint[] {
  return rows.map((row) => {
    const hwEntry = HW_REGISTRY[row.hardware];
    const fwEntry = FW_REGISTRY[row.framework];
    return {
      hardware: row.hardware,
      hardwareLabel: hwEntry?.label ?? row.hardware,
      framework: row.framework,
      frameworkLabel: fwEntry?.label ?? row.framework,
      model: row.model,
      modelLabel: DB_MODEL_TO_DISPLAY[row.model] ?? row.model,
      precision: row.precision,
      modality: row.modality,
      throughputPerGpu: row.metrics.throughput_per_gpu ?? row.metrics.tput_per_gpu ?? 0,
      latency: row.metrics.latency ?? row.metrics.latency_median ?? 0,
      conc: row.conc,
      date: row.date,
      outputWidth: row.metrics.output_width ?? 0,
      outputHeight: row.metrics.output_height ?? 0,
      numInferenceSteps: row.metrics.num_inference_steps ?? 0,
      numFrames: row.metrics.num_frames ?? 0,
      fps: row.metrics.fps ?? 0,
    };
  });
}

export function OmniProvider({
  children,
  group = 'image',
}: {
  children: ReactNode;
  group?: OmniModalityGroup;
}) {
  const { getUrlParam } = useUrlState();
  const {
    data: rawRows,
    isLoading: loading,
    error: queryError,
  } = useOmniBenchmarks(undefined, group);

  const error = queryError ? queryError.message : null;

  const { highContrast, setHighContrast, isLegendExpanded, setIsLegendExpanded } = useChartUIState({
    urlPrefix: 'o_',
  });

  const {
    activeSet: enabledHardware,
    setActiveSet: setEnabledHardware,
    toggle: toggleHardwareRaw,
    selectAll: selectAllHardwareRaw,
    remove: removeHardwareRaw,
  } = useChartToggleSet();

  const [pendingActiveHw, setPendingActiveHw] = useState<Set<string> | null>(() => {
    const v = getUrlParam('o_active');
    if (!v) return null;
    const set = new Set(v.split(',').filter(Boolean));
    return set.size > 0 ? set : null;
  });

  const chartData = useMemo(() => {
    if (!rawRows) return [];
    return toChartData(rawRows);
  }, [rawRows]);

  const hardwareWithData = useMemo(() => new Set(chartData.map((d) => d.hardware)), [chartData]);

  useAutoInitializeToggleSet([...hardwareWithData], enabledHardware, setEnabledHardware);

  const filteredChartData = useMemo(
    () => chartData.filter((d) => enabledHardware.has(d.hardware)),
    [chartData, enabledHardware],
  );

  const toggleHardware = useCallback(
    (hw: string) => toggleHardwareRaw(hw, hardwareWithData),
    [toggleHardwareRaw, hardwareWithData],
  );
  const removeHardware = useCallback((hw: string) => removeHardwareRaw(hw), [removeHardwareRaw]);

  useEffect(() => {
    if (hardwareWithData.size === 0) return;
    if (pendingActiveHw) {
      const restored = new Set([...pendingActiveHw].filter((k) => hardwareWithData.has(k)));
      setEnabledHardware(restored.size > 0 ? restored : hardwareWithData);
      setPendingActiveHw(null);
      return;
    }
    setEnabledHardware(hardwareWithData);
  }, [hardwareWithData]);

  const selectAllHardware = useCallback(
    () => selectAllHardwareRaw(hardwareWithData),
    [selectAllHardwareRaw, hardwareWithData],
  );

  const oActiveStr = useMemo(() => {
    if (enabledHardware.size === 0) return '';
    if (enabledHardware.size === hardwareWithData.size) {
      let same = true;
      for (const k of enabledHardware) {
        if (!hardwareWithData.has(k)) {
          same = false;
          break;
        }
      }
      if (same) return '';
    }
    return [...enabledHardware].toSorted().join(',');
  }, [enabledHardware, hardwareWithData]);

  useUrlStateSync(
    {
      o_hc: highContrast ? '1' : '',
      o_legend: isLegendExpanded ? '' : '0',
      o_active: oActiveStr,
    },
    [highContrast, isLegendExpanded, oActiveStr],
  );

  const value = useMemo(
    () => ({
      loading,
      error,
      chartData: filteredChartData,
      enabledHardware,
      toggleHardware,
      removeHardware,
      selectAllHardware,
      hardwareWithData,
      highContrast,
      setHighContrast,
      isLegendExpanded,
      setIsLegendExpanded,
    }),
    [
      loading,
      error,
      filteredChartData,
      enabledHardware,
      toggleHardware,
      removeHardware,
      selectAllHardware,
      hardwareWithData,
      highContrast,
      isLegendExpanded,
    ],
  );

  return <OmniContext.Provider value={value}>{children}</OmniContext.Provider>;
}

export function useOmniContext() {
  const context = useContext(OmniContext);
  if (context === undefined) {
    throw new Error('useOmniContext must be used within an OmniProvider');
  }
  return context;
}
