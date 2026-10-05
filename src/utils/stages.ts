export const STAGE_NAME_MAX = 32
export const STAGE_DESCRIPTION_MAX = 1024

export interface StageDraft {
  name: string
  start_at: string
  end_at: string
  description?: string | null
}

export function firstWord(text: string | null | undefined): string {
  return (text ?? '').trim().split(/\s+/)[0]?.slice(0, STAGE_NAME_MAX) ?? ''
}

export function stageEffectiveName(stage: StageDraft): string {
  return stage.name.trim() || firstWord(stage.description)
}

export function stageNamePlaceholder(stage: StageDraft): string {
  return firstWord(stage.description) || 'Название этапа'
}

export function stageEndBeforeStart(stage: StageDraft): boolean {
  return !!stage.start_at && !!stage.end_at && new Date(stage.end_at) < new Date(stage.start_at)
}
