import { ref, watch, type Ref } from 'vue'

export function useComboNav(count: Ref<number>) {
  const active = ref(-1)

  watch(count, () => {
    active.value = -1
  })

  function next() {
    if (!count.value) return
    active.value = active.value + 1 >= count.value ? 0 : active.value + 1
  }

  function prev() {
    if (!count.value) return
    active.value = active.value <= 0 ? count.value - 1 : active.value - 1
  }

  function reset() {
    active.value = -1
  }

  return { active, next, prev, reset }
}
