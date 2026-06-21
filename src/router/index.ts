import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/input',
    },
    {
      path: '/input',
      name: 'input',
      component: () => import('@/views/WordInput.vue'),
    },
    {
      path: '/docs',
      name: 'docs',
      component: () => import('@/views/DocManager.vue'),
    },
  ],
})

export default router
