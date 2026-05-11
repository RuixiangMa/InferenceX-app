import type postgres from 'postgres';

type Sql = ReturnType<typeof postgres>;

export interface ConfigParams {
  hardware: string;
  framework: string;
  model: string;
  precision: string;
  specMethod: string;
  modality: string;
  disagg: boolean;
  isMultinode: boolean;
  prefillTp: number;
  prefillEp: number;
  prefillDpAttn: boolean;
  prefillNumWorkers: number;
  decodeTp: number;
  decodeEp: number;
  decodeDpAttn: boolean;
  decodeNumWorkers: number;
  numPrefillGpu: number;
  numDecodeGpu: number;
}

export function configCacheKey(p: ConfigParams): string {
  return [
    p.hardware,
    p.framework,
    p.model,
    p.precision,
    p.specMethod,
    p.modality,
    p.disagg,
    p.isMultinode,
    p.prefillTp,
    p.prefillEp,
    p.prefillDpAttn,
    p.prefillNumWorkers,
    p.decodeTp,
    p.decodeEp,
    p.decodeDpAttn,
    p.decodeNumWorkers,
    p.numPrefillGpu,
    p.numDecodeGpu,
  ].join(':');
}

export function createConfigCache(sql: Sql) {
  const cache = new Map<string, number>();

  async function getOrCreateConfig(p: ConfigParams): Promise<number> {
    const key = configCacheKey(p);
    if (cache.has(key)) return cache.get(key)!;

    const [row] = await sql`
      insert into configs (
        hardware, framework, model, precision, spec_method, modality,
        disagg, is_multinode,
        prefill_tp, prefill_ep, prefill_dp_attention, prefill_num_workers,
        decode_tp,  decode_ep,  decode_dp_attention,  decode_num_workers,
        num_prefill_gpu, num_decode_gpu
      ) values (
        ${p.hardware}, ${p.framework}, ${p.model}, ${p.precision}, ${p.specMethod}, ${p.modality},
        ${p.disagg}, ${p.isMultinode},
        ${p.prefillTp}, ${p.prefillEp}, ${p.prefillDpAttn}, ${p.prefillNumWorkers},
        ${p.decodeTp},  ${p.decodeEp},  ${p.decodeDpAttn},  ${p.decodeNumWorkers},
        ${p.numPrefillGpu}, ${p.numDecodeGpu}
      )
      on conflict (
        hardware, framework, model, precision, spec_method, modality,
        disagg, is_multinode,
        prefill_tp, prefill_ep, prefill_dp_attention, prefill_num_workers,
        decode_tp,  decode_ep,  decode_dp_attention,  decode_num_workers,
        num_prefill_gpu, num_decode_gpu
      )
      do update set hardware = excluded.hardware
      returning id
    `;

    cache.set(key, row.id);
    return row.id;
  }

  async function preloadConfigs(): Promise<void> {
    const rows = await sql`
      select id, hardware, framework, model, precision, spec_method, modality,
             disagg, is_multinode,
             prefill_tp, prefill_ep, prefill_dp_attention, prefill_num_workers,
             decode_tp,  decode_ep,  decode_dp_attention,  decode_num_workers,
             num_prefill_gpu, num_decode_gpu
      from configs
    `;
    for (const r of rows) {
      const key = configCacheKey({
        hardware: r.hardware,
        framework: r.framework,
        model: r.model,
        precision: r.precision,
        specMethod: r.spec_method,
        modality: r.modality,
        disagg: r.disagg,
        isMultinode: r.is_multinode,
        prefillTp: r.prefill_tp,
        prefillEp: r.prefill_ep,
        prefillDpAttn: r.prefill_dp_attention,
        prefillNumWorkers: r.prefill_num_workers,
        decodeTp: r.decode_tp,
        decodeEp: r.decode_ep,
        decodeDpAttn: r.decode_dp_attention,
        decodeNumWorkers: r.decode_num_workers,
        numPrefillGpu: r.num_prefill_gpu,
        numDecodeGpu: r.num_decode_gpu,
      });
      cache.set(key, r.id);
    }
  }

  return {
    getOrCreateConfig,
    preloadConfigs,
    get size() {
      return cache.size;
    },
  };
}
