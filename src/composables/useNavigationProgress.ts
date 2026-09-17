import { ref } from 'vue'

// Router-level компоненты подгружаются лениво (import()); пока чанк или
// первичные данные страницы не готовы, экран не меняется вообще -- отсюда
// ощущение "зависания" при клике. Этот флаг включается в router.beforeEach
// и гасится в afterEach/onError, давая мгновенную визуальную реакцию на клик.
export const isNavigating = ref(false)

export function useNavigationProgress() {
  return { isNavigating }
}
