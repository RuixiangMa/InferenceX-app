# Omni Task Modality Support

## Status

Draft.

## Background

vLLM Omni currently supports two categories of diffusion benchmarks:

- **Image generation**: t2i, i2i, ti2i
- **Video generation**: t2v, i2v, ti2v

The current `MODALITY_KEYS` only distinguishes `text` (LLM) and `image` (all non-text), with no task-level granularity. This prevents separating image and video benchmarks into distinct charts and limits downstream analysis per task type.

## Design Decision

Store the artifact's `task` field directly as the `modality` value. No intermediate mapping layer.

Rationale:

- Artifact already provides `t2i`, `t2v`, etc. in `modality` field.
- ETL `normalizeModality` already passes non-empty strings through.
- Eliminates ambiguity (`image` could mean all image generation or any specific task).
- Tab isolation is trivially `WHERE modality IN ('t2i', ...)` for image, `modality = 't2v'` for video.

## Modality Key Set

```
MODALITY_KEYS = ['text', 't2i', 'i2i', 'ti2i', 'i2v', 'ti2v', 't2v']
```

### Grouping

| Group      | Modality values      | Tab              |
| ---------- | -------------------- | ---------------- |
| Text (LLM) | `text`               | inference        |
| Omni image | `t2i`, `i2i`, `ti2i` | omni             |
| Omni video | `t2v`, `i2v`, `ti2v` | omni-video (new) |

The `i2v`/`ti2v` values are reserved for future use — only `t2v` is expected initially, but the group is defined for extensibility.

## Changes

### 1. constants/src/modality.ts

Replace the current 2-key set with the 7-key set above. No other logic changes.

### 2. db/src/etl/benchmark-mapper.test.ts

Add `makeOmniRow` fixture and test cases covering the omni path:

- `modality != 'text'` skips the `isl && osl` guard (text-only requirement).
- `flattenOmniFields` extracts `output_width`, `output_height`, `num_inference_steps` from nested artifact fields.
- Fallback: `throughput_per_gpu ?? tput_per_gpu` in `OmniContext.toChartData`.

### 3. db/src/etl/normalizers.ts

No changes. `normalizeModality` already returns the lowercased input if it matches a key in `MODALITY_KEYS`, or `'text'` as default. Artifact `modality` values are already lowercase task names.

### 4. Frontend tab structure

**Existing Omni tab** (`/omni`): Filter to `modality IN ('t2i', 'i2i', 'ti2i')`. Rename to "Image Gen" or keep current label.

**New omni-video tab** (`/omni-video`): New page, context, and chart for video benchmarks, filtered to `modality IN ('t2v', 'i2v', 'ti2v')`. Reuses the same `OmniContext` / `BarChartD3` pattern with a different modality filter.

Implementation plan for the new tab:

1. Copy `/omni` to `/omni-video` page.
2. Create a separate `VideoOmniContext` that filters to video modality values.
3. Rename `OmniContext` → `ImageOmniContext` if desired, or keep both with different URL prefixes.
4. Add tab trigger in `tab-nav.tsx` for video tab.
5. Metadata in `tab-meta.ts`.

### 5. API layer

No changes to SQL queries or json-provider — `modality` column already exists and new values are naturally compatible with the natural key.

### 6. Metric keys

The existing `METRIC_KEYS` already includes all omni image metrics. Video benchmarks may use additional fields (e.g., `num_frames`, `fps`) from the artifact `workload_params`. These are already captured by the generic metric iteration in `benchmark-mapper.ts` if present in the artifact.

## Out of Scope

- Adding disagg/parallelism display to omni charts.
- Roofline support for omni (image/video benchmarks do not have token-level rooflines).
- Adding `slo_attainment_rate`, `slo_met_success`, `slo_scale` to display charts (available in metrics but not surfaced in current chart).

## Testing

- Unit tests for `benchmark-mapper.test.ts` cover the omni path.
- Manual verification: load an omni benchmark artifact and confirm t2i vs t2v data appears in the correct tab.
