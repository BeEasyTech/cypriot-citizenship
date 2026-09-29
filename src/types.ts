/** Одна фраза на трёх языках. */
export interface Tri {
  gr: string
  en: string
  ru: string
}

export type Gender = 'm' | 'f'

/** Слово или фраза для словаря / фраз-спасателей. */
export interface VocabItem {
  id: string
  gr: string
  en: string
  ru: string
  /** Необязательная женская форма греческого (если отличается). */
  grF?: string
  /** Короткая заметка (грамматика, употребление), по-русски. */
  note?: string
}

export interface VocabDeck {
  id: string
  titleRu: string
  emoji: string
  /** Фразы-спасатели учатся иначе (приоритет в ежедневной сессии). */
  kind: 'phrases' | 'words'
  items: VocabItem[]
}
