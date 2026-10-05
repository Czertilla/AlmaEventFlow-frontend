import { onBeforeUnmount, ref, type Ref } from 'vue'

export interface TelegramWidgetUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
  auth_date: number
  hash: string
}

export type TelegramWidgetStatus = 'idle' | 'loading' | 'ready' | 'failed'

declare global {
  interface Window {
    onTelegramAuth?: (user: TelegramWidgetUser) => void
  }
}

const WIDGET_SRC = 'https://telegram.org/js/telegram-widget.js?22'
const WIDGET_ORIGIN = 'https://oauth.telegram.org'
const READY_TIMEOUT_MS = 6000

function isWidgetAlive(event: MessageEvent, container: HTMLElement | null): boolean {
  if (event.origin !== WIDGET_ORIGIN || typeof event.data !== 'string') return false
  const iframe = container?.querySelector('iframe')
  if (!iframe || event.source !== iframe.contentWindow) return false
  try {
    const { event: name } = JSON.parse(event.data)
    return name === 'ready' || name === 'resize'
  } catch {
    return false
  }
}

export function useTelegramWidget(
  container: Ref<HTMLElement | null>,
  onAuth: (user: TelegramWidgetUser) => void,
) {
  const status = ref<TelegramWidgetStatus>('idle')
  let timer: ReturnType<typeof setTimeout> | null = null

  function onMessage(event: MessageEvent) {
    if (isWidgetAlive(event, container.value)) status.value = 'ready'
  }

  function fail() {
    if (status.value === 'loading') status.value = 'failed'
  }

  function mount(botUsername: string) {
    if (!container.value) return
    container.value.innerHTML = ''
    window.onTelegramAuth = onAuth
    window.addEventListener('message', onMessage)
    status.value = 'loading'
    timer = setTimeout(fail, READY_TIMEOUT_MS)

    const script = document.createElement('script')
    script.src = WIDGET_SRC
    script.async = true
    script.onerror = fail
    script.setAttribute('data-telegram-login', botUsername)
    script.setAttribute('data-size', 'large')
    script.setAttribute('data-radius', '12')
    script.setAttribute('data-onauth', 'onTelegramAuth(user)')
    container.value.appendChild(script)
  }

  onBeforeUnmount(() => {
    if (timer) clearTimeout(timer)
    window.removeEventListener('message', onMessage)
    delete window.onTelegramAuth
    if (container.value) container.value.innerHTML = ''
  })

  return { mount, status }
}
