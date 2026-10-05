import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, test } from 'vitest'
import { defineComponent, h } from 'vue'
import StageFields from '@/components/event/StageFields.vue'
import { stageEffectiveName, stageEndBeforeStart, stageNamePlaceholder } from '@/utils/stages'

const IonModal = defineComponent({
  name: 'IonModal',
  props: { isOpen: Boolean },
  setup: (_, { slots }) => () => h('div', { class: 'modal' }, slots.default?.()),
})

const mounted: ReturnType<typeof mount>[] = []

function stage(model: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) {
  const wrapper = mount(StageFields, {
    props: {
      modelValue: { name: '', start_at: '', end_at: '', description: '', ...model },
      ...extra,
    },
    attachTo: document.body,
    global: { stubs: { IonIcon: true, IonModal, IonDatetime: true } },
  })
  mounted.push(wrapper)
  return wrapper
}

afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount())
})

describe('StageFields', () => {
  test('has the four labelled fields', () => {
    const labels = stage()
      .findAll('.ui-field-label')
      .map((label) => label.text())

    expect(labels).toEqual(['Название этапа', 'Начало', 'Окончание', 'Описание этапа (необязательно)'])
  })

  test('typing the name emits the whole stage with the change', async () => {
    const wrapper = stage({ start_at: '2026-10-05T10:00', fromTemplate: true })

    await wrapper.findAll('input')[0]!.setValue('Репетиция')

    expect(wrapper.emitted('update:modelValue')).toEqual([
      [{ name: 'Репетиция', start_at: '2026-10-05T10:00', end_at: '', description: '', fromTemplate: true }],
    ])
  })

  test('the name hint comes from the first word of the description', () => {
    const wrapper = stage({ description: 'Сбор участников в зале' })

    expect(wrapper.findAll('input')[0]!.attributes('placeholder')).toBe('Сбор')
  })

  test('an end before the start is reported on the end field', () => {
    const wrapper = stage({ start_at: '2026-10-05T12:00', end_at: '2026-10-05T11:00' })

    expect(wrapper.get('.ui-field-message--error').text()).toBe('Окончание не может быть раньше начала')
    expect(wrapper.findAll('.ui-field--invalid')).toHaveLength(1)
  })

  test('a correct range shows no error', () => {
    expect(stage({ start_at: '2026-10-05T10:00', end_at: '2026-10-05T11:00' }).find('.ui-field-message--error').exists()).toBe(false)
  })

  test('the remove button and the slot', async () => {
    const wrapper = mount(StageFields, {
      props: { modelValue: { name: '', start_at: '', end_at: '', description: '' } },
      slots: { default: () => h('span', { class: 'extra' }, 'из шаблона') },
      attachTo: document.body,
      global: { stubs: { IonIcon: true, IonModal, IonDatetime: true } },
    })
    mounted.push(wrapper)

    await wrapper.get('button[aria-label="Удалить этап"]').trigger('click')

    expect(wrapper.emitted('remove')).toHaveLength(1)
    expect(wrapper.get('.extra').text()).toBe('из шаблона')
  })
})

describe('stage helpers', () => {
  test('the effective name falls back to the first word of the description', () => {
    expect(stageEffectiveName({ name: '  ', start_at: '', end_at: '', description: 'Сбор участников' })).toBe('Сбор')
    expect(stageEffectiveName({ name: 'Финал', start_at: '', end_at: '', description: 'Сбор' })).toBe('Финал')
  })

  test('the placeholder is the generic one without a description', () => {
    expect(stageNamePlaceholder({ name: '', start_at: '', end_at: '', description: null })).toBe('Название этапа')
  })

  test('only a range with both ends can be reversed', () => {
    expect(stageEndBeforeStart({ name: '', start_at: '2026-10-05T12:00', end_at: '' })).toBe(false)
    expect(stageEndBeforeStart({ name: '', start_at: '2026-10-05T12:00', end_at: '2026-10-05T12:00' })).toBe(false)
    expect(stageEndBeforeStart({ name: '', start_at: '2026-10-05T12:00', end_at: '2026-10-05T11:59' })).toBe(true)
  })
})
