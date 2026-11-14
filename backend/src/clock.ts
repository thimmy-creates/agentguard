// Single source of time. The seeder overrides it so demo history is back-dated
// *before* hashes are computed, which keeps every receipt verifiable.
let override: (() => Date) | null = null;

export const setClock = (fn: (() => Date) | null) => {
  override = fn;
};

export const nowDate = (): Date => (override ? override() : new Date());
export const now = (): string => nowDate().toISOString();
