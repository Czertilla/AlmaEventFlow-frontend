import type { RowLink } from '@/components/admin/ResourceTable.vue'
import type { FormLink } from '@/components/admin/ResourceFormModal.vue'

export function linksFor(rowLinks: RowLink[], item: unknown): FormLink[] {
  if (!item) return []
  return rowLinks.map((link) => ({ label: link.label, icon: link.icon, to: link.to(item) }))
}
