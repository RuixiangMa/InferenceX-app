-- ============================================================
-- Add modality column to configs + relax isl/osl constraints
-- ============================================================
--
-- Omni (image generation) benchmarks have isl=0, osl=0 because they
-- don't use token sequence lengths. The modality column distinguishes
-- text (LLM) benchmarks from image-generation benchmarks.

-- 1. Add modality column to configs (default 'text' for existing rows)
alter table configs add column modality text not null default 'text';
alter table configs add constraint configs_modality_lowercase check (modality = lower(modality));

-- 2. Drop and recreate the unique constraint to include modality
alter table configs drop constraint configs_natural_key;
alter table configs add constraint configs_natural_key unique (
  hardware, framework, model, precision, spec_method, modality,
  disagg, is_multinode,
  prefill_tp, prefill_ep, prefill_dp_attention, prefill_num_workers,
  decode_tp,  decode_ep,  decode_dp_attention,  decode_num_workers,
  num_prefill_gpu, num_decode_gpu
);

-- 3. Relax isl/osl constraints in benchmark_results to allow 0
-- (omni benchmarks have isl=0, osl=0 since they don't use token sequences)
alter table benchmark_results drop constraint benchmark_results_isl_positive;
alter table benchmark_results drop constraint benchmark_results_osl_positive;
alter table benchmark_results add constraint benchmark_results_isl_nonneg check (isl >= 0);
alter table benchmark_results add constraint benchmark_results_osl_nonneg check (osl >= 0);

-- 4. Refresh the materialized view to pick up the new modality column
refresh materialized view latest_benchmarks;
