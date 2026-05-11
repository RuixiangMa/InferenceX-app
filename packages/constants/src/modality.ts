export const MODALITY_KEYS = new Set([
  'text',
  'image',
  't2i',
  'i2i',
  'ti2i',
  't2v',
  'i2v',
  'ti2v',
] as const);

export type ModalityKey = typeof MODALITY_KEYS extends Set<infer T> ? T : never;
