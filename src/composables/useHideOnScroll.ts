import { onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'

const STEP = 8
const REVEAL_ZONE = 40

function isTyping(host: HTMLElement | null): boolean {
  const focused = document.activeElement
  return !!host && !!focused && host.contains(focused) && (focused instanceof HTMLInputElement || focused instanceof HTMLTextAreaElement)
}

export function useHideOnScroll(host: Ref<HTMLElement | null>, active: () => boolean = () => true) {
  const hidden = ref(false)
  const raised = ref(false)
  let scroller: HTMLElement | null = null
  let last = 0
  let disposed = false

  function onScroll() {
    if (!scroller) return
    const top = scroller.scrollTop
    raised.value = active() && top > 0
    if (Math.abs(top - last) <= STEP) return
    hidden.value = active() && !isTyping(host.value) && top > last && top > REVEAL_ZONE
    last = top
  }

  onMounted(async () => {
    const content = host.value?.closest('ion-content')
    const element = content ? await content.getScrollElement() : null
    if (disposed || !element) return
    scroller = element
    last = element.scrollTop
    element.addEventListener('scroll', onScroll, { passive: true })
  })

  onBeforeUnmount(() => {
    disposed = true
    scroller?.removeEventListener('scroll', onScroll)
  })

  watch(active, (on) => {
    if (on) return
    hidden.value = false
    raised.value = false
  })

  return { hidden, raised }
}
