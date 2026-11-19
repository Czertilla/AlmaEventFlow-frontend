import { defineStore } from 'pinia'
import { ref } from 'vue'
import { issueStreamTicketEventV3MeStreamTicketPost } from '@/api/generated/almaEventFlow'
import { POLL_MS, RETRY_MIN_MS, nextDelay, parseChange, streamUrl, type LiveChange } from '@/utils/live'
import { useTodoStore } from './todo'

const BASE_URL = import.meta.env.VITE_API_URL || ''

/**
 * Живые обновления: поток событий «что изменилось» от сервера. Данных в
 * событии нет: список дел и onboarding перечитываются. Пока потока нет
 * (сервер недоступен, прокси не пускает), раз в минуту идёт опрос; после
 * любого разрыва всё перечитывается, пропущенные события не нужны.
 */
export const useLiveStore = defineStore('live', () => {
  const todo = useTodoStore()
  const connected = ref(false)
  /** Растёт при каждом «перечитай всё»: переподключение, опрос. */
  const tick = ref(0)
  const versions = ref<Record<string, number>>({})
  const removed = ref<Set<string>>(new Set())

  let source: EventSource | null = null
  let running = false
  let retryMs = RETRY_MIN_MS
  let retryTimer: ReturnType<typeof setTimeout> | null = null
  let pollTimer: ReturnType<typeof setInterval> | null = null

  function bumpAll() {
    tick.value += 1
    void todo.refresh(true)
  }

  function apply(change: LiveChange) {
    if (change.topic === 'todo') {
      void todo.refresh(true)
      return
    }
    if (!change.id) {
      bumpAll()
      return
    }
    if (change.deleted) removed.value = new Set([...removed.value, change.id])
    versions.value = { ...versions.value, [change.id]: (versions.value[change.id] ?? 0) + 1 }
    void todo.refresh(true)
  }

  function startPolling() {
    if (pollTimer) return
    pollTimer = setInterval(() => {
      if (!connected.value && document.visibilityState === 'visible') bumpAll()
    }, POLL_MS)
  }

  function stopPolling() {
    if (pollTimer) clearInterval(pollTimer)
    pollTimer = null
  }

  function close() {
    source?.close()
    source = null
    connected.value = false
  }

  function scheduleReconnect() {
    close()
    if (!running || retryTimer) return
    retryTimer = setTimeout(() => {
      retryTimer = null
      void connect()
    }, retryMs)
    retryMs = nextDelay(retryMs)
  }

  async function connect() {
    if (!running || typeof EventSource === 'undefined') return
    let ticket: string
    try {
      const { data } = await issueStreamTicketEventV3MeStreamTicketPost()
      ticket = data.ticket
    } catch {
      scheduleReconnect()
      return
    }
    if (!running) return
    const stream = new EventSource(streamUrl(BASE_URL, ticket))
    source = stream
    stream.addEventListener('ready', () => {
      const wasDown = !connected.value
      connected.value = true
      retryMs = RETRY_MIN_MS
      if (wasDown) bumpAll()
    })
    stream.addEventListener('changed', (event) => {
      const change = parseChange((event as MessageEvent<string>).data)
      if (change) apply(change)
    })
    // Билет одноразовый: свой EventSource переподключился бы с ним же, поэтому
    // поток закрывается и открывается заново с новым билетом.
    stream.onerror = () => {
      if (source === stream) scheduleReconnect()
    }
  }

  function start() {
    if (running) return
    running = true
    retryMs = RETRY_MIN_MS
    startPolling()
    void connect()
  }

  function stop() {
    running = false
    if (retryTimer) clearTimeout(retryTimer)
    retryTimer = null
    stopPolling()
    close()
    versions.value = {}
    removed.value = new Set()
  }

  /** Номер версии onboarding: меняется, когда сервер сказал, что он изменился. */
  function versionOf(id: string): number {
    return (versions.value[id] ?? 0) + tick.value
  }

  return { connected, tick, versions, removed, start, stop, versionOf, apply }
})
