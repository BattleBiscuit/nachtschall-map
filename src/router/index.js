import { createRouter, createWebHistory } from 'vue-router'
import LobbyView from '../views/LobbyView.vue'
import MapView from '../views/MapView.vue'

const routes = [
  {
    path: '/',
    name: 'Lobby',
    component: LobbyView
  },
  {
    path: '/room/:code',
    name: 'Map',
    component: MapView,
    props: true,
    beforeEnter: (to, from, next) => {
      // Validate room code format (6 alphanumeric)
      if (!/^[A-Z0-9]{6}$/.test(to.params.code)) {
        next({ name: 'Lobby' })
      } else {
        next()
      }
    }
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/'
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
