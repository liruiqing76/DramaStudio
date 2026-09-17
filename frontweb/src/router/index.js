import { createRouter, createWebHistory } from 'vue-router'
import i18n from '@/i18n/index.js'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'list',
      component: () => import('@/views/FilmList.vue'),
      meta: { titleKey: 'route.list' }
    },
    {
      path: '/drama/:id',
      name: 'drama-detail',
      component: () => import('@/views/DramaDetail.vue'),
      meta: { titleKey: 'route.dramaDetail' }
    },
    {
      path: '/film/:id',
      name: 'film',
      component: () => import('@/views/FilmCreate.vue'),
      meta: { titleKey: 'route.film' }
    },
    {
      path: '/ai-config',
      name: 'ai-config',
      component: () => import('@/views/AiConfig.vue'),
      meta: { titleKey: 'route.aiConfig' }
    },
    {
      path: '/free-create',
      name: 'free-create',
      component: () => import('@/views/FreeCreate.vue'),
      meta: { titleKey: 'route.freeCreate' }
    },
    {
      path: '/media-library',
      name: 'media-library',
      component: () => import('@/views/MediaLibrary.vue'),
      meta: { titleKey: 'route.mediaLibrary' }
    }
  ]
})

router.beforeEach((to) => {
  if (to.meta.titleKey) {
    const t = i18n.global.t
    document.title = `${t(to.meta.titleKey)} - DramaStudio`
  }
  return true
})

export default router
