export interface SelectOption<T = string | number | null> {
  value: T
  label: string
  disabled?: boolean
  icon?: string
}

export function optionsFromPairs<T extends string | number>(
  pairs: ReadonlyArray<readonly [T, string]>,
): SelectOption<T>[] {
  return pairs.map(([value, label]) => ({ value, label }))
}

export function withAny<T extends string | number | null>(
  options: SelectOption<T>[],
  anyValue: T,
  label = 'Любой',
): SelectOption<T>[] {
  return [{ value: anyValue, label }, ...options]
}
