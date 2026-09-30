import { create } from 'zustand'
import type { SessionFilter } from './content'

export type Tab = 'home' | 'topics' | 'vocab' | 'profile'

export type Route =
  | { name: Tab }
  | { name: 'topic'; id: string }
  | { name: 'edit'; id: string }
  | { name: 'newItem'; topicId: string }
  | { name: 'deck'; id: string }
  | { name: 'section'; id: string }
  | { name: 'settings' }
  | { name: 'session'; filter?: SessionFilter; title?: string }
  | { name: 'sim' }
  | { name: 'listen' }
  | { name: 'cheat' }

interface Nav {
  stack: Route[]
  push: (r: Route) => void
  replace: (r: Route) => void
  back: () => void
  tab: (t: Tab) => void
}

/** Простая навигация стеком + синхронизация с кнопкой «назад» браузера/Telegram. */
export const useNav = create<Nav>((set, get) => ({
  // ?open=cheat — прямая ссылка на шпаргалку
  stack: typeof location !== 'undefined' && new URLSearchParams(location.search).get('open') === 'cheat'
    ? [{ name: 'topics' }, { name: 'cheat' }]
    : [{ name: 'home' }],
  push: (r) => {
    history.pushState({ depth: get().stack.length }, '')
    set((s) => ({ stack: [...s.stack, r] }))
    window.scrollTo(0, 0)
  },
  replace: (r) => set((s) => ({ stack: [...s.stack.slice(0, -1), r] })),
  back: () => {
    if (get().stack.length > 1) history.back()
  },
  tab: (t) => {
    const depth = get().stack.length
    if (depth > 1) {
      // сбросить историю до корня
      history.go(-(depth - 1))
    }
    set({ stack: [{ name: t }] })
    window.scrollTo(0, 0)
  },
}))

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    const { stack } = useNav.getState()
    if (stack.length > 1) useNav.setState({ stack: stack.slice(0, -1) })
  })
}

export const current = (stack: Route[]) => stack[stack.length - 1]
