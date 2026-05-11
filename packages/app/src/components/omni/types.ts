export interface OmniChartDataPoint {
  hardware: string;
  hardwareLabel: string;
  framework: string;
  frameworkLabel: string;
  model: string;
  modelLabel: string;
  precision: string;
  modality: string;
  throughputPerGpu: number;
  latency: number;
  conc: number;
  date: string;
  outputWidth: number;
  outputHeight: number;
  numInferenceSteps: number;
  numFrames: number;
  fps: number;
}

export interface OmniChartContextType {
  loading: boolean;
  error: string | null;
  chartData: OmniChartDataPoint[];
  enabledHardware: Set<string>;
  toggleHardware: (hw: string) => void;
  removeHardware: (hw: string) => void;
  selectAllHardware: () => void;
  hardwareWithData: Set<string>;
  highContrast: boolean;
  setHighContrast: (value: boolean) => void;
  isLegendExpanded: boolean;
  setIsLegendExpanded: (value: boolean) => void;
}
