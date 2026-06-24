import { ref } from 'vue'
import {
  deleteMyClient,
  getVapidPublicKey,
  registerMyClient,
  type ClientRead,
} from '@/api/notify'

const SW_URL = '/sw.js'

export const isWebPushSupported =
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  const output = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i)
  return output
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration()
  if (existing) return existing
  return navigator.serviceWorker.register(SW_URL)
}

function deviceLabel(): string {
  const ua = navigator.userAgent
  const browser =
    /Edg/.test(ua) ? 'Edge'
    : /Chrome/.test(ua) ? 'Chrome'
    : /Firefox/.test(ua) ? 'Firefox'
    : /Safari/.test(ua) ? 'Safari'
    : 'Browser'
  const platform =
    /Windows/.test(ua) ? 'Windows'
    : /Android/.test(ua) ? 'Android'
    : /iPhone|iPad|iPod/.test(ua) ? 'iOS'
    : /Mac/.test(ua) ? 'macOS'
    : /Linux/.test(ua) ? 'Linux'
    : ''
  return platform ? `${browser} · ${platform}` : browser
}

export function useWebPush() {
  const permission = ref<NotificationPermission>(
    isWebPushSupported ? Notification.permission : 'denied',
  )

  async function currentEndpoint(): Promise<string | null> {
    if (!isWebPushSupported) return null
    const reg = await navigator.serviceWorker.getRegistration()
    if (!reg) return null
    const sub = await reg.pushManager.getSubscription()
    return sub?.endpoint ?? null
  }

  async function subscribe(): Promise<ClientRead> {
    if (!isWebPushSupported) {
      throw new Error('Web Push is not supported by this browser')
    }
    const perm = await Notification.requestPermission()
    permission.value = perm
    if (perm !== 'granted') {
      throw new Error('Notifications permission denied')
    }

    const publicKey = await getVapidPublicKey()
    const registration = await getRegistration()
    await navigator.serviceWorker.ready

    let subscription = await registration.pushManager.getSubscription()
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })
    }

    const json = subscription.toJSON()
    const keys = json.keys ?? {}
    return registerMyClient({
      transport: 'webpush',
      endpoint: subscription.endpoint,
      label: deviceLabel(),
      payload: { p256dh: keys.p256dh ?? '', auth: keys.auth ?? '' },
    })
  }

  async function unsubscribe(clientId: string): Promise<void> {
    if (isWebPushSupported) {
      const reg = await navigator.serviceWorker.getRegistration()
      const sub = await reg?.pushManager.getSubscription()
      if (sub) await sub.unsubscribe().catch(() => {})
    }
    await deleteMyClient(clientId)
  }

  return { permission, currentEndpoint, subscribe, unsubscribe }
}
