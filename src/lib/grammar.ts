import type { Tri } from '../types'

/** Маркер незаполненного поля анкеты: ⟨Город рождения⟩. */
export const hole = (label: string) => `⟨${label}⟩`
export const HOLE_RE = /⟨([^⟩]+)⟩/g
export const hasHoles = (s: string) => /⟨[^⟩]+⟩/.test(s)

export const tri = (gr: string, en: string, ru: string): Tri => ({ gr, en, ru })
export const triAll = (s: string): Tri => ({ gr: s, en: s, ru: s })

/* ---------------------------------------------------------------- места */

/** Известное место: винительный падеж с артиклем + русские формы. */
export interface KnownPlace {
  id: string
  /** Именительный падеж, если отличается от винительного (Λεμεσός / τη Λεμεσό). */
  nom?: string
  /** Винительный с артиклем: «τη Μόσχα» → στη Μόσχα / από τη Μόσχα. */
  acc: string
  en: string
  /** [именительный, «в …», «из …»] */
  ru: [string, string, string]
}

const P = (id: string, acc: string, en: string, ru: [string, string, string], nom?: string): KnownPlace => ({ id, acc, en, ru, nom })

/** Название без артикля в именительном падеже: «Λεμεσός». */
export const placeNom = (p: KnownPlace) => p.nom ?? p.acc.replace(/^(?:τη|την|το|τον)\s+/, '')

export const COUNTRIES: KnownPlace[] = [
  P('ru', 'τη Ρωσία', 'Russia', ['Россия', 'в России', 'из России']),
  P('ua', 'την Ουκρανία', 'Ukraine', ['Украина', 'в Украине', 'из Украины']),
  P('by', 'τη Λευκορωσία', 'Belarus', ['Беларусь', 'в Беларуси', 'из Беларуси']),
  P('kz', 'το Καζακστάν', 'Kazakhstan', ['Казахстан', 'в Казахстане', 'из Казахстана']),
  P('uz', 'το Ουζμπεκιστάν', 'Uzbekistan', ['Узбекистан', 'в Узбекистане', 'из Узбекистана']),
  P('kg', 'την Κιργιζία', 'Kyrgyzstan', ['Кыргызстан', 'в Кыргызстане', 'из Кыргызстана']),
  P('am', 'την Αρμενία', 'Armenia', ['Армения', 'в Армении', 'из Армении']),
  P('ge', 'τη Γεωργία', 'Georgia', ['Грузия', 'в Грузии', 'из Грузии']),
  P('az', 'το Αζερμπαϊτζάν', 'Azerbaijan', ['Азербайджан', 'в Азербайджане', 'из Азербайджана']),
  P('md', 'τη Μολδαβία', 'Moldova', ['Молдова', 'в Молдове', 'из Молдовы']),
  P('il', 'το Ισραήλ', 'Israel', ['Израиль', 'в Израиле', 'из Израиля']),
  P('lv', 'τη Λετονία', 'Latvia', ['Латвия', 'в Латвии', 'из Латвии']),
  P('lt', 'τη Λιθουανία', 'Lithuania', ['Литва', 'в Литве', 'из Литвы']),
  P('ee', 'την Εσθονία', 'Estonia', ['Эстония', 'в Эстонии', 'из Эстонии']),
  P('cy', 'την Κύπρο', 'Cyprus', ['Кипр', 'на Кипре', 'с Кипра'], 'Κύπρος'),
]

export const CITIES: KnownPlace[] = [
  P('moscow', 'τη Μόσχα', 'Moscow', ['Москва', 'в Москве', 'из Москвы']),
  P('spb', 'την Αγία Πετρούπολη', 'Saint Petersburg', ['Санкт-Петербург', 'в Санкт-Петербурге', 'из Санкт-Петербурга']),
  P('novosibirsk', 'το Νοβοσιμπίρσκ', 'Novosibirsk', ['Новосибирск', 'в Новосибирске', 'из Новосибирска']),
  P('kazan', 'το Καζάν', 'Kazan', ['Казань', 'в Казани', 'из Казани']),
  P('samara', 'τη Σαμάρα', 'Samara', ['Самара', 'в Самаре', 'из Самары']),
  P('nnovgorod', 'το Νίζνι Νόβγκοροντ', 'Nizhny Novgorod', ['Нижний Новгород', 'в Нижнем Новгороде', 'из Нижнего Новгорода']),
  P('rostov', 'το Ροστόφ', 'Rostov-on-Don', ['Ростов-на-Дону', 'в Ростове-на-Дону', 'из Ростова-на-Дону']),
  P('krasnodar', 'το Κρασνοντάρ', 'Krasnodar', ['Краснодар', 'в Краснодаре', 'из Краснодара']),
  P('sochi', 'το Σότσι', 'Sochi', ['Сочи', 'в Сочи', 'из Сочи']),
  P('kyiv', 'το Κίεβο', 'Kyiv', ['Киев', 'в Киеве', 'из Киева']),
  P('kharkiv', 'το Χάρκοβο', 'Kharkiv', ['Харьков', 'в Харькове', 'из Харькова']),
  P('odesa', 'την Οδησσό', 'Odesa', ['Одесса', 'в Одессе', 'из Одессы'], 'Οδησσός'),
  P('minsk', 'το Μινσκ', 'Minsk', ['Минск', 'в Минске', 'из Минска']),
  P('almaty', 'το Αλμάτι', 'Almaty', ['Алматы', 'в Алматы', 'из Алматы']),
  P('tashkent', 'την Τασκένδη', 'Tashkent', ['Ташкент', 'в Ташкенте', 'из Ташкента']),
  P('tbilisi', 'την Τιφλίδα', 'Tbilisi', ['Тбилиси', 'в Тбилиси', 'из Тбилиси']),
  P('yerevan', 'το Ερεβάν', 'Yerevan', ['Ереван', 'в Ереване', 'из Еревана']),
  P('riga', 'τη Ρίγα', 'Riga', ['Рига', 'в Риге', 'из Риги']),
  P('telaviv', 'το Τελ Αβίβ', 'Tel Aviv', ['Тель-Авив', 'в Тель-Авиве', 'из Тель-Авива']),
  // Кипр
  P('limassol', 'τη Λεμεσό', 'Limassol', ['Лимассол', 'в Лимассоле', 'из Лимассола'], 'Λεμεσός'),
  P('nicosia', 'τη Λευκωσία', 'Nicosia', ['Никосия', 'в Никосии', 'из Никосии']),
  P('larnaca', 'τη Λάρνακα', 'Larnaca', ['Ларнака', 'в Ларнаке', 'из Ларнаки']),
  P('paphos', 'την Πάφο', 'Paphos', ['Пафос', 'в Пафосе', 'из Пафоса'], 'Πάφος'),
  P('ayianapa', 'την Αγία Νάπα', 'Ayia Napa', ['Айя-Напа', 'в Айя-Напе', 'из Айя-Напы']),
  P('paralimni', 'το Παραλίμνι', 'Paralimni', ['Паралимни', 'в Паралимни', 'из Паралимни']),
]

export const CY_CITY_IDS = ['limassol', 'nicosia', 'larnaca', 'paphos', 'ayianapa', 'paralimni']

/** Значение поля «место» в анкете. */
export interface PlaceValue {
  id?: string
  /** Своё название по-гречески, в именительном: «Όμσκ». */
  name?: string
  /** Для своего названия: женский род (τη/την) или средний (το). */
  fem?: boolean
  en?: string
  ru?: string
}

/** Перед гласными и глухими/взрывными артикль τη(ν) сохраняет -ν. */
const KEEP_N = /^(?:[αάεέηήιίοόυύωώΑΆΕΈΗΉΙΊΟΌΥΎΩΏκπτξψΚΠΤΞΨ]|μπ|ντ|γκ|τσ|τζ|Μπ|Ντ|Γκ|Τσ|Τζ)/
export const femArt = (word: string) => (KEEP_N.test(word) ? 'την' : 'τη')

export const guessFem = (name: string) => /[αάηή]$/.test(name.trim())

export interface PlaceForms {
  /** «στη Μόσχα» */
  in: Tri
  /** «από τη Μόσχα» */
  from: Tri
  /** «Μόσχα» (без артикля) */
  name: Tri
}

export function placeForms(v: PlaceValue | undefined, list: KnownPlace[], label: string): PlaceForms {
  const known = v?.id ? list.find((p) => p.id === v.id) : undefined
  if (known) {
    const bare = placeNom(known)
    return {
      in: tri('σ' + known.acc, 'in ' + known.en, known.ru[1]),
      from: tri('από ' + known.acc, 'from ' + known.en, known.ru[2]),
      name: tri(bare, known.en, known.ru[0]),
    }
  }
  const name = v?.name?.trim()
  if (!name) {
    const h = hole(label)
    return { in: triAll(h), from: triAll(h), name: triAll(h) }
  }
  const fem = v?.fem ?? guessFem(name)
  const acc = (fem ? femArt(name) : 'το') + ' ' + name
  const en = v?.en?.trim() || name
  const ru = v?.ru?.trim() || en
  return {
    in: tri('σ' + acc, 'in ' + en, `в г. ${ru}`),
    from: tri('από ' + acc, 'from ' + en, `из г. ${ru}`),
    name: tri(name, en, ru),
  }
}

/* ---------------------------------------------------------------- даты */

const MONTHS_GEN = ['Ιανουαρίου', 'Φεβρουαρίου', 'Μαρτίου', 'Απριλίου', 'Μαΐου', 'Ιουνίου', 'Ιουλίου', 'Αυγούστου', 'Σεπτεμβρίου', 'Οκτωβρίου', 'Νοεμβρίου', 'Δεκεμβρίου']
const MONTHS_ACC = ['τον Ιανουάριο', 'τον Φεβρουάριο', 'τον Μάρτιο', 'τον Απρίλιο', 'τον Μάιο', 'τον Ιούνιο', 'τον Ιούλιο', 'τον Αύγουστο', 'τον Σεπτέμβριο', 'τον Οκτώβριο', 'τον Νοέμβριο', 'τον Δεκέμβριο']
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const MONTHS_RU_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']
const MONTHS_RU_PREP = ['январе', 'феврале', 'марте', 'апреле', 'мае', 'июне', 'июле', 'августе', 'сентябре', 'октябре', 'ноябре', 'декабре']

export function parseDate(s: unknown): Date | null {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** «στις 15 Μαρτίου 1985» / «on 15 March 1985» / «15 марта 1985 года». */
export function onDate(s: unknown, label: string): Tri {
  const d = parseDate(s)
  if (!d) return triAll(hole(label))
  const day = d.getDate(), m = d.getMonth(), y = d.getFullYear()
  const gr = day === 1 ? `την 1η ${MONTHS_GEN[m]} ${y}` : `στις ${day} ${MONTHS_GEN[m]} ${y}`
  return tri(gr, `on ${day} ${MONTHS_EN[m]} ${y}`, `${day} ${MONTHS_RU_GEN[m]} ${y} года`)
}

/** «τον Ιούνιο του 2019» / «in June 2019» / «в июне 2019 года». */
export function inMonth(s: unknown, label: string): Tri {
  const d = parseDate(s)
  if (!d) return triAll(hole(label))
  const m = d.getMonth(), y = d.getFullYear()
  return tri(`${MONTHS_ACC[m]} του ${y}`, `in ${MONTHS_EN[m]} ${y}`, `в ${MONTHS_RU_PREP[m]} ${y} года`)
}

export function yearsBetween(from: Date, to = new Date()): number {
  let y = to.getFullYear() - from.getFullYear()
  const m = to.getMonth() - from.getMonth()
  if (m < 0 || (m === 0 && to.getDate() < from.getDate())) y--
  return y
}

export function monthsBetween(from: Date, to = new Date()): number {
  let m = (to.getFullYear() - from.getFullYear()) * 12 + to.getMonth() - from.getMonth()
  if (to.getDate() < from.getDate()) m--
  return m
}

/* ---------------------------------------------------------------- числа */

/** Русское склонение: plural(5, 'год', 'года', 'лет'). */
export function ruPlural(n: number, one: string, few: string, many: string) {
  const n10 = n % 10, n100 = n % 100
  if (n10 === 1 && n100 !== 11) return one
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return few
  return many
}

/** Срок в годах/месяцах: «εδώ και 5 χρόνια». */
export function duration(from: Date): Tri {
  const y = yearsBetween(from)
  if (y >= 1) {
    return y === 1
      ? tri('ένα χρόνο', 'one year', '1 год')
      : tri(`${y} χρόνια`, `${y} years`, `${y} ${ruPlural(y, 'год', 'года', 'лет')}`)
  }
  const m = Math.max(1, monthsBetween(from))
  return m === 1
    ? tri('ένα μήνα', 'one month', '1 месяц')
    : tri(`${m} μήνες`, `${m} months`, `${m} ${ruPlural(m, 'месяц', 'месяца', 'месяцев')}`)
}

/** Деньги: 3.500 (греческий разделитель тысяч — точка). */
export function money(n: unknown, label: string): Tri {
  const v = typeof n === 'number' ? n : Number(n)
  if (!n && n !== 0) return triAll(hole(label))
  if (!Number.isFinite(v)) return triAll(hole(label))
  const gr = v.toLocaleString('de-DE')
  const en = v.toLocaleString('en-US')
  const ru = v.toLocaleString('ru-RU')
  return tri(`${gr} ευρώ`, `${en} euros`, `${ru} евро`)
}

/** Числительные среднего рода для счёта предметов (παιδιά, υπνοδωμάτια). */
const NEUT = ['μηδέν', 'ένα', 'δύο', 'τρία', 'τέσσερα', 'πέντε', 'έξι', 'επτά', 'οκτώ', 'εννιά', 'δέκα']
const MASC_ACC = ['μηδέν', 'έναν', 'δύο', 'τρεις', 'τέσσερις', 'πέντε', 'έξι', 'επτά', 'οκτώ', 'εννιά', 'δέκα']
const FEM = ['μηδέν', 'μία', 'δύο', 'τρεις', 'τέσσερις', 'πέντε', 'έξι', 'επτά', 'οκτώ', 'εννιά', 'δέκα']
const EN_NUM = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']
export const numNeut = (n: number) => NEUT[n] ?? String(n)
export const numMascAcc = (n: number) => MASC_ACC[n] ?? String(n)
export const numFem = (n: number) => FEM[n] ?? String(n)
export const numEn = (n: number) => EN_NUM[n] ?? String(n)

/* ---------------------------------------------------------------- списки */

export function joinGr(xs: string[]) {
  return xs.length <= 1 ? xs.join('') : xs.slice(0, -1).join(', ') + ' και ' + xs[xs.length - 1]
}
export function joinEn(xs: string[]) {
  return xs.length <= 1 ? xs.join('') : xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1]
}
export function joinRu(xs: string[]) {
  return xs.length <= 1 ? xs.join('') : xs.slice(0, -1).join(', ') + ' и ' + xs[xs.length - 1]
}
export function joinTri(xs: Tri[]): Tri {
  return tri(joinGr(xs.map((x) => x.gr)), joinEn(xs.map((x) => x.en)), joinRu(xs.map((x) => x.ru)))
}

/** Первая буква заглавная (для начала предложения). */
export const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s)
export const capTri = (t: Tri): Tri => tri(cap(t.gr), cap(t.en), cap(t.ru))

/** Телефон группами для чтения вслух: 99123456 → 99 12 34 56. */
export function phoneSpaced(s: string) {
  const d = s.replace(/[^\d+]/g, '')
  const plus = d.startsWith('+') ? d.slice(0, 4) + ' ' : ''
  const rest = d.startsWith('+') ? d.slice(4) : d
  return plus + (rest.match(/.{1,2}/g) ?? []).join(' ')
}
