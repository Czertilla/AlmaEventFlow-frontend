import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  getAvailableFeedsEventV2CalendarAvailableFeedsGet,
  listSubscriptionsEventV2CalendarSubscriptionsGet,
  createSubscriptionEventV2CalendarSubscriptionsPost,
  rotateSubscriptionTokenEventV2CalendarSubscriptionsSubscriptionIdRotateTokenPost,
  deleteSubscriptionEventV2CalendarSubscriptionsSubscriptionIdDelete,
} from '@/api/generated/almaEventFlow'
import type {
  AvailableFeeds,
  FeedDescriptor,
  SubscriptionCreate,
  SubscriptionCreated,
  SubscriptionRead,
} from '@/api/generated/almaEventFlow'

export const useCalendarSubscriptionsStore = defineStore('calendarSubscriptions', () => {
  const available = ref<AvailableFeeds>({})
  const subscriptions = ref<SubscriptionRead[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // feed_url is returned only on create / rotate, so revealed URLs are kept in
  // memory for the current session and merged into the list for display.
  const revealedUrls = ref<Map<string, string>>(new Map())

  function feedUrl(id: string): string | null {
    return revealedUrls.value.get(id) ?? null
  }

  function descriptorKey(type: string, collectiveId?: string | null): string {
    return `${type}:${collectiveId ?? ''}`
  }

  function isSubscribed(feed: FeedDescriptor): boolean {
    return subscriptions.value.some(
      (s) =>
        s.is_active &&
        descriptorKey(s.type, s.collective_id) ===
          descriptorKey(feed.type, feed.collective_id),
    )
  }

  async function fetchAvailable() {
    const { data } = await getAvailableFeedsEventV2CalendarAvailableFeedsGet()
    available.value = data
  }

  async function fetchSubscriptions() {
    const { data } = await listSubscriptionsEventV2CalendarSubscriptionsGet()
    subscriptions.value = data
  }

  async function refresh() {
    loading.value = true
    error.value = null
    try {
      await Promise.all([fetchAvailable(), fetchSubscriptions()])
    } catch {
      error.value = 'Не удалось загрузить календарные подписки'
    } finally {
      loading.value = false
    }
  }

  function rememberCreated(created: SubscriptionCreated) {
    revealedUrls.value.set(created.id, created.feed_url)
  }

  async function create(payload: SubscriptionCreate): Promise<SubscriptionCreated> {
    const { data } = await createSubscriptionEventV2CalendarSubscriptionsPost(payload)
    rememberCreated(data)
    await fetchSubscriptions()
    return data
  }

  async function rotate(id: string): Promise<SubscriptionCreated> {
    const { data } =
      await rotateSubscriptionTokenEventV2CalendarSubscriptionsSubscriptionIdRotateTokenPost(id)
    rememberCreated(data)
    await fetchSubscriptions()
    return data
  }

  async function remove(id: string): Promise<void> {
    await deleteSubscriptionEventV2CalendarSubscriptionsSubscriptionIdDelete(id)
    revealedUrls.value.delete(id)
    await fetchSubscriptions()
  }

  return {
    available,
    subscriptions,
    loading,
    error,
    feedUrl,
    isSubscribed,
    refresh,
    fetchAvailable,
    fetchSubscriptions,
    create,
    rotate,
    remove,
  }
})
