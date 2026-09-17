import { onMounted, onUnmounted, reactive } from 'vue'

// PrincipalLayout смонтирована один раз для всего /principal/* (см.
// router/index.ts) и переключает дочернюю страницу внутренней Vue-
// реактивностью, а не слотом -- значит страница не может прокинуть
// add-label/@add как props. Дочерняя страница регистрирует свою кнопку
// «Добавить» здесь, layout читает.
interface PrincipalPageActions {
  addLabel: string | null
  onAdd: (() => void) | null
}

export const principalPageActions = reactive<PrincipalPageActions>({
  addLabel: null,
  onAdd: null,
})

export function useLayoutAddButton(addLabel: string, onAdd: () => void) {
  onMounted(() => {
    principalPageActions.addLabel = addLabel
    principalPageActions.onAdd = onAdd
  })
  onUnmounted(() => {
    principalPageActions.addLabel = null
    principalPageActions.onAdd = null
  })
}
