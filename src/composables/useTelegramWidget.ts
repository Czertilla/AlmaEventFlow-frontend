import { onBeforeUnmount, type Ref } from 'vue'

export interface TelegramWidgetUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
  auth_date: number
  hash: string
}

declare global {
  interface Window {
    onTelegramAuth?: (user: TelegramWidgetUser) => void
  }
}

const WIDGET_SRC = 'https://telegram.org/js/telegram-widget.js?22'

/**
 * Injects Telegram's official Login Widget script into `container`. The
 * widget calls back through a global function (its own protocol, no
 * postMessage/redirect option we can hook into instead), so `onAuth` is
 * wired up as `window.onTelegramAuth` for the widget's `data-onauth` to find.
 */
export function useTelegramWidget(
  container: Ref<HTMLElement | null>,
  onAuth: (user: TelegramWidgetUser) => void,
) {
  function mount(botUsername: string) {
    if (!container.value) return
    container.value.innerHTML = ''
    window.onTelegramAuth = onAuth

    const script = document.createElement('script')
    script.src = WIDGET_SRC
    script.async = true
    script.setAttribute('data-telegram-login', botUsername)
    script.setAttribute('data-size', 'large')
    script.setAttribute('data-radius', '12')
    script.setAttribute('data-onauth', 'onTelegramAuth(user)')
    container.value.appendChild(script)
  }

  onBeforeUnmount(() => {
    delete window.onTelegramAuth
    if (container.value) container.value.innerHTML = ''
  })

  return { mount }
}
