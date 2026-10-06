import { describe, expect, test } from 'vitest'
import {
  STAGE_NAME_MAX,
  stageAutoNames,
  stageEffectiveNames,
  stageEndBeforeStart,
  type StageDraft,
} from '@/utils/stages'

function draft(description: string | null, name = ''): StageDraft {
  return { name, start_at: '', end_at: '', description }
}

function auto(...descriptions: (string | null)[]): string[] {
  return stageAutoNames(descriptions.map((description) => draft(description)))
}

const SOPRANO = 'Репетиция партий сопрано и альтов'

describe('automatic stage names', () => {
  test('are the first two words of the description', () => {
    expect(auto(SOPRANO)).toEqual(['Репетиция партий'])
  })

  test('are one word when the description has one', () => {
    expect(auto('Сбор')).toEqual(['Сбор'])
  })

  test('do not exist without a description', () => {
    expect(auto(null, '', '   ')).toEqual(['', '', ''])
  })

  test('drop the punctuation the cut leaves behind', () => {
    expect(auto('Сбор, участников. Потом чай')).toEqual(['Сбор, участников'])
    expect(auto('Сбор - участников')).toEqual(['Сбор участников'])
  })

  test('never exceed the length of the field', () => {
    const long = 'Телекоммуникационная электрификация'

    expect(auto(long)).toEqual(['Телекоммуникационная'])
    expect(auto('а'.repeat(STAGE_NAME_MAX + 8))).toEqual(['а'.repeat(STAGE_NAME_MAX)])
  })

  test('are told apart from the others by as few extra words as it takes', () => {
    expect(auto(SOPRANO, 'Репетиция партий бари')).toEqual(['Репетиция партий сопрано', 'Репетиция партий бари'])
  })

  test('follow what the second description is typed into, and stop when the name is told apart', () => {
    const second = ['Репетиция', 'Репетиция п', 'Репетиция партий', 'Репетиция партий б', 'Репетиция партий бари']
    expect(second.map((typed) => auto(SOPRANO, typed))).toEqual([
      ['Репетиция партий', 'Репетиция'],
      ['Репетиция партий', 'Репетиция п'],
      ['Репетиция партий сопрано', 'Репетиция партий'],
      ['Репетиция партий сопрано', 'Репетиция партий б'],
      ['Репетиция партий сопрано', 'Репетиция партий бари'],
    ])

    expect(auto(SOPRANO, 'Репетиция партий баритонов и')).toEqual([
      'Репетиция партий сопрано',
      'Репетиция партий баритонов',
    ])
    expect(auto(SOPRANO, 'Репетиция партий баритонов и ещё что-то')).toEqual([
      'Репетиция партий сопрано',
      'Репетиция партий баритонов',
    ])
  })

  test('keep a stage short while it differs from the rest', () => {
    expect(auto('Разминка голоса и дыхания', 'Репетиция партий сопрано', 'Репетиция партий бас')).toEqual([
      'Разминка голоса',
      'Репетиция партий сопрано',
      'Репетиция партий бас',
    ])
  })

  test('widen every stage of a group until the group is told apart', () => {
    expect(auto('Общий сбор участников утром', 'Общий сбор участников вечером', 'Общий сбор гостей')).toEqual([
      'Общий сбор участников утром',
      'Общий сбор участников вечером',
      'Общий сбор гостей',
    ])
  })

  test('ignore the case when comparing', () => {
    expect(auto('репетиция партий сопрано', 'Репетиция партий бас')).toEqual([
      'репетиция партий сопрано',
      'Репетиция партий бас',
    ])
  })

  test('are told apart from names typed by hand', () => {
    const stages = [draft(null, ' Репетиция партий '), draft(SOPRANO)]

    expect(stageAutoNames(stages)).toEqual(['', 'Репетиция партий сопрано'])
  })

  test('are not made for a stage that has a name of its own', () => {
    expect(stageAutoNames([draft('Сбор участников', 'Финал')])).toEqual([''])
  })

  test('stay equal when the descriptions give no way to tell them apart', () => {
    expect(auto('Сбор участников', 'Сбор участников')).toEqual(['Сбор участников', 'Сбор участников'])
    expect(auto('Телекоммуникационная электрификация А', 'Телекоммуникационная электрификация Б')).toEqual([
      'Телекоммуникационная',
      'Телекоммуникационная',
    ])
  })
})

describe('stage helpers', () => {
  test('a stage is saved under its own name or the automatic one', () => {
    const stages = [draft(SOPRANO), draft('Сбор участников', '  Финал '), draft(null)]

    expect(stageEffectiveNames(stages)).toEqual(['Репетиция партий', 'Финал', ''])
  })

  test('only a range with both ends can be reversed', () => {
    expect(stageEndBeforeStart({ name: '', start_at: '2026-10-05T12:00', end_at: '' })).toBe(false)
    expect(stageEndBeforeStart({ name: '', start_at: '2026-10-05T12:00', end_at: '2026-10-05T12:00' })).toBe(false)
    expect(stageEndBeforeStart({ name: '', start_at: '2026-10-05T12:00', end_at: '2026-10-05T11:59' })).toBe(true)
  })
})
