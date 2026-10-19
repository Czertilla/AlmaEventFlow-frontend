import { computed, onBeforeUnmount, ref, type Ref } from 'vue'
import type { SelectOption } from '@/utils/selectOptions'
import { nextFieldId } from '@/composables/useFieldAttrs'

interface UseSelectParams<T> {
  options: () => SelectOption<T>[]
  value: () => T | undefined
  disabled: () => boolean
  onSelect: (value: T) => void
}

const TYPEAHEAD_RESET_MS = 700

export function useSelect<T>(params: UseSelectParams<T>) {
  const open = ref(false)
  const activeIndex = ref(-1)
  const triggerEl: Ref<HTMLElement | null> = ref(null)
  const listboxId = nextFieldId('ui-listbox')

  const selectedIndex = computed(() => params.options().findIndex((o) => o.value === params.value()))
  const selectedOption = computed(() => params.options()[selectedIndex.value] ?? null)

  function isEnabled(index: number): boolean {
    const option = params.options()[index]
    return !!option && !option.disabled
  }

  function firstEnabled(from: number, step: 1 | -1): number {
    const count = params.options().length
    for (let i = from; i >= 0 && i < count; i += step) if (isEnabled(i)) return i
    return -1
  }

  function openMenu() {
    if (params.disabled() || open.value) return
    activeIndex.value = selectedIndex.value >= 0 ? selectedIndex.value : firstEnabled(0, 1)
    open.value = true
  }

  function closeMenu() {
    open.value = false
  }

  function toggle() {
    if (open.value) closeMenu()
    else openMenu()
  }

  function choose(index: number) {
    if (!isEnabled(index)) return
    params.onSelect(params.options()[index].value)
    closeMenu()
    triggerEl.value?.focus({ preventScroll: true })
  }

  function move(step: 1 | -1) {
    const count = params.options().length
    if (!count) return
    const start = activeIndex.value < 0 ? (step === 1 ? 0 : count - 1) : activeIndex.value + step
    const next = firstEnabled(start, step)
    if (next >= 0) activeIndex.value = next
  }

  let typed = ''
  let typedTimer: ReturnType<typeof setTimeout> | undefined

  function typeahead(char: string) {
    typed += char.toLowerCase()
    clearTimeout(typedTimer)
    typedTimer = setTimeout(() => { typed = '' }, TYPEAHEAD_RESET_MS)
    const options = params.options()
    const from = typed.length === 1 ? Math.max(activeIndex.value + 1, 0) : Math.max(activeIndex.value, 0)
    for (let n = 0; n < options.length; n++) {
      const i = (from + n) % options.length
      if (isEnabled(i) && options[i].label.toLowerCase().startsWith(typed)) {
        if (!open.value) openMenu()
        activeIndex.value = i
        return
      }
    }
  }

  function onKeydown(event: KeyboardEvent) {
    if (params.disabled()) return
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        event.preventDefault()
        if (!open.value) openMenu()
        else move(event.key === 'ArrowDown' ? 1 : -1)
        break
      case 'Home':
      case 'End':
        if (!open.value) return
        event.preventDefault()
        activeIndex.value = event.key === 'Home'
          ? firstEnabled(0, 1)
          : firstEnabled(params.options().length - 1, -1)
        break
      case 'Enter':
      case ' ':
        event.preventDefault()
        if (open.value) choose(activeIndex.value)
        else openMenu()
        break
      case 'Escape':
        if (open.value) {
          event.preventDefault()
          event.stopPropagation()
          closeMenu()
        }
        break
      case 'Tab':
        closeMenu()
        break
      default:
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) typeahead(event.key)
    }
  }

  onBeforeUnmount(() => clearTimeout(typedTimer))

  return {
    open, activeIndex, triggerEl, listboxId,
    selectedIndex, selectedOption,
    openMenu, closeMenu, toggle, choose, onKeydown,
  }
}
