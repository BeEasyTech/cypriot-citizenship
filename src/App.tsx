import { Home as HomeIcon, MessagesSquare, BookOpen, UserRound } from 'lucide-react'
import { useNav, current, type Tab } from './router'
import { haptic } from './lib/telegram'
import { cx } from './ui/kit'
import Home from './screens/Home'
import Session from './screens/Session'
import Sim from './screens/Sim'
import Listen from './screens/Listen'
import { TopicsList, TopicDetail } from './screens/Topics'
import { EditItem, NewItem } from './screens/EditItem'
import { VocabList, DeckDetail } from './screens/Vocab'
import { ProfileHome, SectionForm, Settings } from './screens/Profile'
import TelegramHelp from './screens/TelegramHelp'

const TABS: { id: Tab; label: string; icon: typeof HomeIcon }[] = [
  { id: 'home', label: 'Главная', icon: HomeIcon },
  { id: 'topics', label: 'Вопросы', icon: MessagesSquare },
  { id: 'vocab', label: 'Словарь', icon: BookOpen },
  { id: 'profile', label: 'Анкета', icon: UserRound },
]

const FULLSCREEN = new Set(['session', 'sim', 'listen'])

export default function App() {
  const stack = useNav((s) => s.stack)
  const tab = useNav((s) => s.tab)
  const r = current(stack)
  const root = stack[0].name as Tab
  const key = stack.length + ':' + JSON.stringify(r)

  let screen: React.ReactNode
  switch (r.name) {
    case 'home': screen = <Home />; break
    case 'topics': screen = <TopicsList />; break
    case 'vocab': screen = <VocabList />; break
    case 'profile': screen = <ProfileHome />; break
    case 'topic': screen = <TopicDetail id={r.id} />; break
    case 'edit': screen = <EditItem id={r.id} />; break
    case 'newItem': screen = <NewItem topicId={r.topicId} />; break
    case 'deck': screen = <DeckDetail id={r.id} />; break
    case 'section': screen = <SectionForm id={r.id} />; break
    case 'settings': screen = <Settings />; break
    case 'session': screen = <Session filter={r.filter} title={r.title} />; break
    case 'sim': screen = <Sim />; break
    case 'listen': screen = <Listen />; break
    case 'telegram': screen = <TelegramHelp />; break
  }

  return (
    <>
      <div key={key}>{screen}</div>
      {!FULLSCREEN.has(r.name) && (
        <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card/95 backdrop-blur-md">
          <div className="mx-auto flex max-w-xl">
            {TABS.map((t) => {
              const on = root === t.id
              const Icon = t.icon
              return (
                <button key={t.id} onClick={() => { haptic.select(); tab(t.id) }}
                  className={cx('flex flex-1 flex-col items-center gap-0.5 pt-2 pb-1 text-[11px] font-semibold transition', on ? 'text-accent' : 'text-muted')}>
                  <Icon size={24} strokeWidth={on ? 2.3 : 1.8} />
                  {t.label}
                </button>
              )
            })}
          </div>
        </nav>
      )}
    </>
  )
}
