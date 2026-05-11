import type { ConfigParams } from './config-cache';
import type { SkipTracker } from './skip-tracker';
import { METRIC_KEYS, PRECISION_KEYS } from '@semianalysisai/inferencex-constants';
import {
  resolveModelKey,
  hwToGpuKey,
  normalizeFramework,
  normalizeModality,
  normalizePrecision,
  normalizeSpecMethod,
  parseBool,
  parseNum,
  parseInt2,
} from './normalizers';

const METRIC_RENAMES: Record<string, string> = {};

const NON_METRIC_KEYS = new Set([
  // identity
  'hw',
  'model',
  'framework',
  'precision',
  'infmax_model_prefix',
  // routing
  'isl',
  'osl',
  'conc',
  'image',
  'disagg',
  'is_multinode',
  'spec_decoding',
  // v1 parallelism
  'tp',
  'ep',
  'dp_attention',
  // v2 parallelism
  'prefill_tp',
  'prefill_ep',
  'prefill_dp_attention',
  'prefill_num_workers',
  'decode_tp',
  'decode_ep',
  'decode_dp_attention',
  'decode_num_workers',
  'num_prefill_gpu',
  'num_decode_gpu',
  // omni — structured objects (not numeric, excluded from metrics)
  'modality',
  'workload_family',
  'output_shape',
  'workload_params',
  'throughput_unit',
  'latency_unit',
]);

const _warnedMetricKeys = new Set<string>();

export interface BenchmarkParams {
  config: ConfigParams;
  isl: number;
  osl: number;
  conc: number;
  image: string | null;
  metrics: Record<string, number>;
}

function deriveOmniModality(row: Record<string, any>): any {
  const params = row.workload_params;
  if (params && typeof params === 'object' && params.task) {
    return params.task;
  }
  return row.modality;
}

function flattenOmniFields(row: Record<string, any>, metrics: Record<string, number>): void {
  const shape = row.output_shape;
  if (shape && typeof shape === 'object') {
    if (typeof shape.width === 'number') metrics['output_width'] = shape.width;
    if (typeof shape.height === 'number') metrics['output_height'] = shape.height;
  }
  const params = row.workload_params;
  if (params && typeof params === 'object') {
    if (typeof params.num_inference_steps === 'number') {
      metrics['num_inference_steps'] = params.num_inference_steps;
    }
    if (typeof params.num_frames === 'number') {
      metrics['num_frames'] = params.num_frames;
    }
    if (typeof params.fps === 'number') {
      metrics['fps'] = params.fps;
    }
  }
}

export function mapBenchmarkRow(
  row: Record<string, any>,
  tracker: SkipTracker,
  islOslFallback?: { isl: number; osl: number } | null,
): BenchmarkParams | null {
  const modelKey = resolveModelKey(row);
  if (!modelKey) {
    tracker.skips.unmappedModel++;
    const raw = String(row.infmax_model_prefix ?? row.model ?? '');
    if (raw) tracker.unmappedModels.add(raw);
    return null;
  }

  const gpuKey = hwToGpuKey(String(row.hw ?? ''));
  if (!gpuKey) {
    tracker.skips.unmappedHw++;
    const raw = String(row.hw ?? '');
    if (raw) tracker.unmappedHws.add(raw);
    return null;
  }

  const modality = normalizeModality(deriveOmniModality(row));
  const isOmni = modality !== 'text';

  const rawIsl = parseInt2(row.isl) ?? islOslFallback?.isl;
  const rawOsl = parseInt2(row.osl) ?? islOslFallback?.osl;
  const conc = parseInt2(row.conc);

  const isl: number = rawIsl ?? 0;
  const osl: number = rawOsl ?? 0;
  const concVal: number = conc ?? 0;

  if (!isOmni && (!isl || !osl || !concVal)) {
    tracker.skips.noIslOsl++;
    return null;
  }
  if (isOmni && !concVal) {
    tracker.skips.noIslOsl++;
    return null;
  }

  const { framework, disagg } = normalizeFramework(String(row.framework ?? ''), row.disagg);
  const isMultinode = parseBool(row.is_multinode);
  const precision = normalizePrecision(String(row.precision ?? ''));
  if (!PRECISION_KEYS.has(precision)) {
    tracker.unmappedPrecisions.add(precision);
  }
  const specMethod = normalizeSpecMethod(row.spec_decoding);

  let prefillTp: number, prefillEp: number, prefillDpAttn: boolean, prefillNumWorkers: number;
  let decodeTp: number, decodeEp: number, decodeDpAttn: boolean, decodeNumWorkers: number;
  let numPrefillGpu: number, numDecodeGpu: number;

  if ('prefill_tp' in row) {
    prefillTp = parseInt2(row.prefill_tp) ?? 1;
    prefillEp = parseInt2(row.prefill_ep) ?? 1;
    prefillDpAttn = parseBool(row.prefill_dp_attention);
    prefillNumWorkers = parseInt2(row.prefill_num_workers) ?? 0;
    decodeTp = parseInt2(row.decode_tp) ?? 1;
    decodeEp = parseInt2(row.decode_ep) ?? 1;
    decodeDpAttn = parseBool(row.decode_dp_attention);
    decodeNumWorkers = parseInt2(row.decode_num_workers) ?? 0;
    numPrefillGpu = parseInt2(row.num_prefill_gpu) ?? prefillTp * prefillEp;
    numDecodeGpu = parseInt2(row.num_decode_gpu) ?? decodeTp * decodeEp;
  } else {
    const tp = parseInt2(row.tp) ?? 1;
    const ep = parseInt2(row.ep) ?? 1;
    const dpAttn = parseBool(row.dp_attention);
    prefillTp = tp;
    decodeTp = tp;
    prefillEp = ep;
    decodeEp = ep;
    prefillDpAttn = dpAttn;
    decodeDpAttn = dpAttn;
    prefillNumWorkers = 0;
    decodeNumWorkers = 0;
    numPrefillGpu = tp * ep;
    numDecodeGpu = tp * ep;
  }

  const metrics: Record<string, number> = {};
  for (const [rawKey, val] of Object.entries(row)) {
    if (NON_METRIC_KEYS.has(rawKey)) continue;
    const n = parseNum(val);
    if (n === undefined) continue;
    const storedKey = METRIC_RENAMES[rawKey] ?? rawKey;
    metrics[storedKey] = n;
    if (!METRIC_KEYS.has(rawKey) && !_warnedMetricKeys.has(rawKey)) {
      _warnedMetricKeys.add(rawKey);
      console.warn(
        `  [WARN] auto-captured unexpected metric '${rawKey}' — add to METRIC_KEYS in constants/src/metric-keys.ts or NON_METRIC_KEYS in benchmark-mapper.ts`,
      );
    }
  }

  if (isOmni) {
    flattenOmniFields(row, metrics);
  }

  const image = row.image ? String(row.image).replaceAll('#', '/') : null;

  return {
    config: {
      hardware: gpuKey,
      framework,
      model: modelKey,
      precision,
      specMethod,
      modality,
      disagg,
      isMultinode,
      prefillTp,
      prefillEp,
      prefillDpAttn,
      prefillNumWorkers,
      decodeTp,
      decodeEp,
      decodeDpAttn,
      decodeNumWorkers,
      numPrefillGpu,
      numDecodeGpu,
    },
    isl,
    osl,
    conc: concVal,
    image,
    metrics,
  };
}
