import type { DbClient } from '../connection.js';

export type OmniModalityGroup = 'all' | 'image' | 'video';

export interface OmniBenchmarkRow {
  hardware: string;
  framework: string;
  model: string;
  precision: string;
  spec_method: string;
  modality: string;
  disagg: boolean;
  is_multinode: boolean;
  prefill_tp: number;
  prefill_ep: number;
  prefill_dp_attention: boolean;
  prefill_num_workers: number;
  decode_tp: number;
  decode_ep: number;
  decode_dp_attention: boolean;
  decode_num_workers: number;
  num_prefill_gpu: number;
  num_decode_gpu: number;
  isl: number;
  osl: number;
  conc: number;
  image: string | null;
  metrics: Record<string, number>;
  date: string;
  run_url: string | null;
}

export async function getLatestOmniBenchmarks(
  sql: DbClient,
  date?: string,
  group: OmniModalityGroup = 'all',
): Promise<OmniBenchmarkRow[]> {
  const modalities =
    group === 'image'
      ? ['image', 't2i', 'i2i', 'ti2i']
      : group === 'video'
        ? ['t2v', 'i2v', 'ti2v']
        : null;

  if (date) {
    const rows = await sql`
      SELECT DISTINCT ON (br.config_id, br.conc, br.isl, br.osl)
        c.hardware,
        c.framework,
        c.model,
        c.precision,
        c.spec_method,
        c.modality,
        c.disagg,
        c.is_multinode,
        c.prefill_tp,
        c.prefill_ep,
        c.prefill_dp_attention,
        c.prefill_num_workers,
        c.decode_tp,
        c.decode_ep,
        c.decode_dp_attention,
        c.decode_num_workers,
        c.num_prefill_gpu,
        c.num_decode_gpu,
        br.isl,
        br.osl,
        br.conc,
        br.image,
        br.metrics,
        br.date::text,
        CASE WHEN wr.html_url IS NOT NULL THEN wr.html_url || '/attempts/' || wr.run_attempt ELSE NULL END AS run_url
      FROM benchmark_results br
      JOIN configs c ON c.id = br.config_id
      JOIN latest_workflow_runs wr ON wr.id = br.workflow_run_id
      WHERE c.modality != 'text'
        AND (${modalities}::text[] IS NULL OR c.modality = ANY(${modalities}::text[]))
        AND br.error IS NULL
        AND br.date <= ${date}::date
      ORDER BY br.config_id, br.conc, br.isl, br.osl, br.date DESC
    `;
    return rows as unknown as OmniBenchmarkRow[];
  }

  const rows = await sql`
    SELECT
      c.hardware,
      c.framework,
      c.model,
      c.precision,
      c.spec_method,
      c.modality,
      c.disagg,
      c.is_multinode,
      c.prefill_tp,
      c.prefill_ep,
      c.prefill_dp_attention,
      c.prefill_num_workers,
      c.decode_tp,
      c.decode_ep,
      c.decode_dp_attention,
      c.decode_num_workers,
      c.num_prefill_gpu,
      c.num_decode_gpu,
      lb.isl,
      lb.osl,
      lb.conc,
      lb.image,
      lb.metrics,
      lb.date::text,
      CASE WHEN wr.html_url IS NOT NULL THEN wr.html_url || '/attempts/' || wr.run_attempt ELSE NULL END AS run_url
    FROM latest_benchmarks lb
    JOIN configs c ON c.id = lb.config_id
    JOIN latest_workflow_runs wr ON wr.id = lb.workflow_run_id
    WHERE c.modality != 'text'
      AND (${modalities}::text[] IS NULL OR c.modality = ANY(${modalities}::text[]))
    ORDER BY lb.config_id, lb.conc, lb.isl, lb.osl, lb.date DESC
  `;
  return rows as unknown as OmniBenchmarkRow[];
}
