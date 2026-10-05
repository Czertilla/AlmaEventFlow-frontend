import { useAttrs } from 'vue'

let sequence = 0

export const nextFieldId = (prefix = 'ui-field') => `${prefix}-${++sequence}`

export function useFieldAttrs() {
  const attrs = useAttrs()
  const pick = (own: boolean) => Object.fromEntries(Object.entries(attrs).filter(([key]) => (key === 'class' || key === 'style') === own))
  return { rootAttrs: () => pick(true), controlAttrs: () => pick(false) }
}
