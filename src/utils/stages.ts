export const STAGE_NAME_MAX = 32
export const STAGE_DESCRIPTION_MAX = 1024
export const STAGE_NAME_PLACEHOLDER = 'Название этапа'

const MIN_AUTO_NAME_WORDS = 2
const TRAILING_PUNCTUATION = /[\s,.;:–—-]+$/u
const HAS_LETTER_OR_DIGIT = /[\p{L}\p{N}]/u

export interface StageDraft {
  name: string
  start_at: string
  end_at: string
  description?: string | null
}

function clean(text: string): string {
  return text.replace(TRAILING_PUNCTUATION, '')
}

function autoNameOptions(description: string | null | undefined): string[] {
  const words = (description ?? '').split(/\s+/).filter((word) => HAS_LETTER_OR_DIGIT.test(word))
  const options: string[] = []
  for (let count = 1; count <= words.length; count++) {
    const text = clean(words.slice(0, count).join(' '))
    if (text.length > STAGE_NAME_MAX) break
    options.push(text)
  }
  if (!options.length && words.length) options.push(clean(words[0]!.slice(0, STAGE_NAME_MAX)))
  return options
}

// A stage with a name of its own gets ''; its name still counts when the others are told apart.
export function stageAutoNames(stages: readonly StageDraft[]): string[] {
  const own = stages.map((stage) => stage.name.trim())
  const options = stages.map((stage, i) => (own[i] ? [] : autoNameOptions(stage.description)))
  const level = options.map((list) => Math.max(0, Math.min(MIN_AUTO_NAME_WORDS, list.length) - 1))
  const nameAt = (i: number) => own[i] || options[i]?.[level[i] ?? 0] || ''

  for (;;) {
    const groups = new Map<string, number[]>()
    stages.forEach((_, i) => {
      const name = nameAt(i)
      if (!name) return
      const key = name.toLowerCase()
      groups.set(key, [...(groups.get(key) ?? []), i])
    })
    let widened = false
    for (const group of groups.values()) {
      if (group.length < 2) continue
      for (const i of group) {
        if ((level[i] ?? 0) < (options[i]?.length ?? 0) - 1) {
          level[i] = (level[i] ?? 0) + 1
          widened = true
        }
      }
    }
    if (!widened) break
  }

  return stages.map((_, i) => (own[i] ? '' : nameAt(i)))
}

export function stageEffectiveNames(stages: readonly StageDraft[]): string[] {
  const auto = stageAutoNames(stages)
  return stages.map((stage, i) => stage.name.trim() || auto[i] || '')
}

export function stageEndBeforeStart(stage: StageDraft): boolean {
  return !!stage.start_at && !!stage.end_at && new Date(stage.end_at) < new Date(stage.start_at)
}
