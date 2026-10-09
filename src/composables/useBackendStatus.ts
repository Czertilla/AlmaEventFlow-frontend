import { computed, reactive, ref } from 'vue'
import { probe } from '@/api/availability'

const CONFIRM_PROBES = 3
const CONFIRM_GAP_MS = 1000
const SUSPECT_COOLDOWN_MS = 3000
const BACKOFF_START_MS = 1000
const BACKOFF_MAX_MS = 10000

const down = reactive(new Set<string>())
const isChecking = ref(false)
const confirming = new Map<string, Promise<boolean>>()
const aliveAt = new Map<string, number>()
let attempt = 0
let timer: ReturnType<typeof setTimeout> | null = null
let running: Promise<void> | null = null
let listening = false

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

function clearTimer() {
  if (timer) clearTimeout(timer)
  timer = null
}

function schedule() {
  if (timer || running || !down.size) return
  const delay = Math.min(BACKOFF_START_MS * 2 ** attempt, BACKOFF_MAX_MS)
  attempt += 1
  timer = setTimeout(() => {
    timer = null
    void recheck()
  }, delay)
}

async function check() {
  clearTimer()
  isChecking.value = true
  try {
    const services = [...down]
    const alive = await Promise.all(services.map((service) => probe(service)))
    services.forEach((service, i) => {
      if (alive[i]) markUp(service)
    })
  } finally {
    isChecking.value = false
  }
}

function listen() {
  if (listening || typeof window === 'undefined') return
  listening = true
  window.addEventListener('online', () => void recheck())
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) void recheck()
  })
}

function markDown(service: string) {
  down.add(service)
  listen()
  schedule()
}

async function verify(service: string): Promise<boolean> {
  for (let i = 0; i < CONFIRM_PROBES; i++) {
    if (i) await sleep(CONFIRM_GAP_MS)
    if (await probe(service)) {
      aliveAt.set(service, Date.now())
      return true
    }
  }
  markDown(service)
  return false
}

// Достижим ли сервис: несколько проб health подряд, недоступным он становится
// только если не ответила ни одна. Одновременные вызовы делят одну проверку.
export function verifyReachable(service: string): Promise<boolean> {
  if (down.has(service)) return Promise.resolve(false)
  let pending = confirming.get(service)
  if (!pending) {
    pending = verify(service).finally(() => confirming.delete(service))
    confirming.set(service, pending)
  }
  return pending
}

// Упавший запрос -- лишь повод проверить сервис, а не вывод о его недоступности.
export function suspect(service: string) {
  if (Date.now() - (aliveAt.get(service) ?? 0) < SUSPECT_COOLDOWN_MS) return
  void verifyReachable(service)
}

export function recheck(): Promise<void> {
  if (!down.size) return Promise.resolve()
  running ??= check().finally(() => {
    running = null
    schedule()
  })
  return running
}

// Сервис ответил (по запросу или пробе) -- он достижим.
export function markUp(service: string) {
  down.delete(service)
  if (down.size) return
  attempt = 0
  clearTimer()
}

export function resetBackendStatus() {
  down.clear()
  confirming.clear()
  aliveAt.clear()
  attempt = 0
  running = null
  clearTimer()
}

export function useBackendStatus() {
  return {
    anyDown: computed(() => down.size > 0),
    isChecking,
    isDown: (service: string) => down.has(service),
    markUp,
    recheck,
    suspect,
    verifyReachable,
  }
}
