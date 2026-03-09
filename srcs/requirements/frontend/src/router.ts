import { createRouter as _createRouter, createMemoryHistory, createWebHistory } from 'vue-router'
// Note: We rename the import to _createRouter to avoid naming conflicts
import type { RouteRecordRaw } from 'vue-router'

// 1. Define the Routes (The Map)
// This is static. It doesn't change, so it's safe to keep outside the function.
const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('./views/HomeView.vue')
  },
  {
path: '/login',
    name: 'login',
    component: () => import('./views/LoginView.vue')
  },
  {
    path: '/notes',
    name: 'notes',
    component: () => import('./views/NotesView.vue')
  },
  {
    path: '/mindmap',
    name: 'mindmap',
    component: () => import('./views/MindmapView.vue')
  }
]

// 2. The Factory Function
// We export this function. Every time it is called, it returns a FRESH object.
export function createRouter(type: 'client' | 'server') {
  // A. Choose the History Mode
  // The Server cannot look at the browser URL bar (it has no window).
  // So it uses 'MemoryHistory' (it imagines the URL in its head).
  // The Client uses 'WebHistory' (it looks at the actual address bar).
  const history = type === 'client' 
    ? createWebHistory() 
    : createMemoryHistory()

  // B. return the New Instance
  return _createRouter({
    history: history,
    routes: routes
  })
}
