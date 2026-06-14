const COLLECTIVE_COLORS = ['#6C63FF', '#00D9A6', '#FF6B9D', '#FFB800', '#FF4757', '#7C3AED', '#06B6D4', '#F59E0B']

/** Deterministic accent color for a collective id. */
export function getCollectiveColor(id: string): string {
  if (!id) return '#92949c'
  const hash = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return COLLECTIVE_COLORS[hash % COLLECTIVE_COLORS.length]
}
