import type { Tri } from '../types'
import type { Ctx } from '../lib/ctx'
import {
  CITIES, cap, capTri, femArt, hole, joinGr, joinEn, joinRu, joinTri, numEn, numFem, numMascAcc, numNeut, onDate,
  parseDate, phoneSpaced, placeForms, ruPlural, tri, triAll,
} from '../lib/grammar'
import {
  BENEFITS, CHURCH_FREQ, FOODS, GREEK_WHERE, HOBBIES, HOUSE_TYPE, JOB_DUTIES, JOBS, LANGUAGES, LIKE_CY,
  MET_PLACES, MONEY_SOURCES, MOVE_REASONS, PASSPORT_REASONS, RELIGION, SCHOOLS, type Child,
} from './profile'

export interface QItem {
  id: string
  /** Короткое название по-русски: для списков и квиза «Узнай вопрос». */
  title: string
  /** Формулировки вопроса экзаменатором (все варианты). */
  questions: (c: Ctx) => Tri[]
  /** Эталонный ответ по строкам (предложениям). */
  answer: (c: Ctx) => Tri[]
  /** Поля анкеты, от которых зависит ответ (для быстрой правки). */
  fields?: string[]
  /** Вопрос актуален только при условии (например, есть дети). */
  when?: (c: Ctx) => boolean
}

export interface Topic {
  id: string
  num: number
  title: string
  emoji: string
  items: QItem[]
}

const t = tri
const Q = (...qs: Tri[]) => () => qs

/* ------------------------------------------------ общие помощники */

const isMarried = (c: Ctx) => c.p.marital === 'married' || c.p.marital === 'partner'
const kids = (c: Ctx): Child[] => (Array.isArray(c.p.children) ? c.p.children : [])
const hasKids = (c: Ctx) => kids(c).length > 0
const isWorking = (c: Ctx) => !!c.p.workStatus && c.p.workStatus !== 'none'
const owns = (c: Ctx) => c.p.tenure === 'own'
/** «Мы» для семейных, «я» для одиноких. */
const we = (c: Ctx, sg: Tri, pl: Tri) => (isMarried(c) || hasKids(c) ? pl : sg)

/** Супруг(а): формы в зависимости от пола супруга. */
function spouse(c: Ctx) {
  const f = c.p.spouseGender !== 'm'
  const partner = c.p.marital === 'partner'
  const name = c.name('spouseName', 'Имя супруга(-и)')
  return {
    f,
    /** «η γυναίκα μου» */
    nom: partner
      ? t(f ? 'η σύντροφός μου' : 'ο σύντροφός μου', 'my partner', f ? 'моя партнёрша' : 'мой партнёр')
      : t(f ? 'η γυναίκα μου' : 'ο άντρας μου', f ? 'my wife' : 'my husband', f ? 'моя жена' : 'мой муж'),
    /** «τη γυναίκα σας» — в вопросах */
    yours: partner
      ? t(f ? 'τη σύντροφό σας' : 'τον σύντροφό σας', 'your partner', f ? 'вашу партнёршу' : 'вашего партнёра')
      : t(f ? 'τη γυναίκα σας' : 'τον άντρα σας', f ? 'your wife' : 'your husband', f ? 'вашу жену' : 'вашего мужа'),
    yoursNom: partner
      ? t(f ? 'η σύντροφός σας' : 'ο σύντροφός σας', 'your partner', f ? 'ваша партнёрша' : 'ваш партнёр')
      : t(f ? 'η γυναίκα σας' : 'ο άντρας σας', f ? 'your wife' : 'your husband', f ? 'ваша жена' : 'ваш муж'),
    /** Τη/Τον (λένε) */
    acc: f ? 'Τη' : 'Τον',
    /** της/του (μισθός) */
    gen: f ? 'της' : 'του',
    he: t(f ? 'Η' : 'Ο', f ? 'She' : 'He', f ? 'Она' : 'Он'),
    name,
    /** «την Άννα» с правильным артиклем */
    nameAcc: f ? `${femArt(name.gr)} ${name.gr}` : `τον ${name.gr}`,
  }
}

/** Должность с учётом рода говорящего. */
function jobTitle(c: Ctx): Tri {
  const custom = typeof c.p.jobCustom === 'string' ? c.p.jobCustom.trim() : ''
  if (custom) return triAll(custom)
  const j = c.pick(JOBS, 'job')
  return j ? c.gt(j.t) : triAll(hole('Должность'))
}

const childArt = (ch: Child) => (ch.gender === 'f' ? 'η' : 'ο')
const childName = (ch: Child): Tri => {
  const gr = ch.name?.gr?.trim()
  if (!gr) return triAll(hole('Имя ребёнка'))
  const en = ch.name?.en?.trim() || gr
  return t(gr, en, en)
}

/** «18:00» → «στις 6 το απόγευμα» / «at 6 p.m.» / «в 6 вечера». */
const atTime = (v: unknown, label: string): Tri => {
  if (typeof v !== 'string' || !/^\d{1,2}:\d{2}$/.test(v)) return triAll(hole(label))
  const [H, M] = v.split(':').map(Number)
  const h12 = H % 12 === 0 ? 12 : H % 12
  const mm = M ? `:${String(M).padStart(2, '0')}` : ''
  const gr = H >= 5 && H < 12 ? 'το πρωί' : H === 12 || H === 13 ? 'το μεσημέρι' : H >= 14 && H < 20 ? 'το απόγευμα' : H >= 20 ? 'το βράδυ' : 'τη νύχτα'
  const ru = H >= 5 && H < 12 ? 'утра' : H >= 12 && H < 17 ? 'дня' : H >= 17 ? 'вечера' : 'ночи'
  return tri(`${h12 === 1 ? 'στη' : 'στις'} ${h12}${mm} ${gr}`, `at ${h12}${mm} ${H < 12 ? 'a.m.' : 'p.m.'}`, `в ${h12}${mm} ${ru}`)
}

const ordinals = [
  t('Πρώτον', 'First', 'Во-первых'),
  t('Δεύτερον', 'Second', 'Во-вторых'),
  t('Τρίτον', 'Third', 'В-третьих'),
]

/* ------------------------------------------------ темы */

export const TOPICS: Topic[] = [
  {
    id: 't01', num: 1, title: 'Имя', emoji: '👋',
    items: [
      {
        id: 'q01-name', title: 'Как вас зовут?', fields: ['name', 'surname'],
        questions: Q(
          t('Πώς σας λένε;', 'What is your name?', 'Как вас зовут?'),
          t('Πώς ονομάζεστε;', 'What is your name?', 'Как ваше имя?'),
          t('Πώς λέγεστε;', 'What are you called?', 'Как вас зовут?'),
        ),
        answer: (c) => {
          const n = c.name('name', 'Имя'), s = c.name('surname', 'Фамилия')
          return [
            t(`Με λένε ${n.gr} ${s.gr}.`, `My name is ${n.en} ${s.en}.`, `Меня зовут ${n.ru} ${s.ru}.`),
            t(`Το όνομά μου είναι ${n.gr} και το επώνυμό μου είναι ${s.gr}.`, `My first name is ${n.en} and my surname is ${s.en}.`, `Моё имя — ${n.ru}, а фамилия — ${s.ru}.`),
          ]
        },
      },
    ],
  },
  {
    id: 't02', num: 2, title: 'Откуда вы', emoji: '🌍',
    items: [
      {
        id: 'q02-from', title: 'Откуда вы?', fields: ['country', 'birthCity'],
        questions: Q(t('Από πού είστε;', 'Where are you from?', 'Откуда вы?')),
        answer: (c) => {
          const co = c.country('country', 'Страна'), ci = c.city('birthCity', 'Город рождения')
          return [t(`Είμαι ${co.from.gr}, ${ci.from.gr}.`, `I am ${co.from.en}, ${ci.from.en}.`, `Я ${co.from.ru}, ${ci.from.ru}.`)]
        },
      },
      {
        id: 'q02-born', title: 'Где вы родились?', fields: ['birthCity', 'country'],
        questions: Q(t('Πού γεννηθήκατε;', 'Where were you born?', 'Где вы родились?')),
        answer: (c) => {
          const co = c.country('country', 'Страна'), ci = c.city('birthCity', 'Город рождения')
          return [t(
            `Γεννήθηκα ${ci.in.gr}, ${co.in.gr}.`,
            `I was born ${ci.in.en}, ${co.in.en}.`,
            `${c.g('Я родился', 'Я родилась')} ${ci.in.ru}, ${co.in.ru}.`,
          )]
        },
      },
    ],
  },
  {
    id: 't03', num: 3, title: 'Возраст и дата рождения', emoji: '🎂',
    items: [
      {
        id: 'q03-age', title: 'Сколько вам лет?', fields: ['birthDate'],
        questions: Q(t('Πόσων χρονών είστε;', 'How old are you?', 'Сколько вам лет?')),
        answer: (c) => {
          const a = c.age('birthDate', 'Дата рождения')
          const n = Number(a.gr)
          return [t(`Είμαι ${a.gr} χρονών.`, `I am ${a.en} years old.`, `Мне ${a.ru} ${Number.isFinite(n) ? ruPlural(n, 'год', 'года', 'лет') : 'лет'}.`)]
        },
      },
      {
        id: 'q03-birth', title: 'Когда вы родились?', fields: ['birthDate'],
        questions: Q(
          t('Πότε γεννηθήκατε;', 'When were you born?', 'Когда вы родились?'),
          t('Ποια είναι η ημερομηνία γέννησής σας;', 'What is your date of birth?', 'Какая у вас дата рождения?'),
        ),
        answer: (c) => {
          const d = c.date('birthDate', 'Дата рождения')
          return [t(`Γεννήθηκα ${d.gr}.`, `I was born ${d.en}.`, `${c.g('Я родился', 'Я родилась')} ${d.ru}.`)]
        },
      },
    ],
  },
  {
    id: 't04', num: 4, title: 'Переезд на Кипр', emoji: '✈️',
    items: [
      {
        id: 'q04-why', title: 'Почему вы переехали на Кипр?', fields: ['moveReasons', 'moveReasonCustom'],
        questions: Q(t('Γιατί μετακομίσατε στην Κύπρο;', 'Why did you move to Cyprus?', 'Почему вы переехали на Кипр?')),
        answer: (c) => {
          const out: Tri[] = c.picks(MOVE_REASONS, 'moveReasons').map((r) => {
            if (r.value === 'spouse') {
              const sp = spouse(c)
              const nom = capTri(sp.nom)
              return t(`${nom.gr} βρήκε δουλειά εδώ και ήρθαμε μαζί.`, `${nom.en} found a job here and we came together.`, `${nom.ru} ${sp.f ? 'нашла' : 'нашёл'} здесь работу, и мы приехали вместе.`)
            }
            return c.gt(r.t)
          })
          const custom = typeof c.p.moveReasonCustom === 'string' ? c.p.moveReasonCustom.trim() : ''
          if (custom) out.push(triAll(custom))
          return out.length ? out : [triAll(hole('Причина переезда'))]
        },
      },
      {
        id: 'q04-when', title: 'Когда точно вы переехали?', fields: ['moveDate'],
        questions: Q(
          t('Πότε μετακομίσατε ακριβώς στην Κύπρο;', 'When exactly did you move to Cyprus?', 'Когда именно вы переехали на Кипр?'),
          t('Πέστε μου την ακριβή ημερομηνία μετακόμισης.', 'Tell me the exact date of your move.', 'Назовите точную дату переезда.'),
        ),
        answer: (c) => {
          const d = c.date('moveDate', 'Дата переезда')
          return [t(`Μετακόμισα στην Κύπρο ${d.gr}.`, `I moved to Cyprus ${d.en}.`, `${c.g('Я переехал', 'Я переехала')} на Кипр ${d.ru}.`)]
        },
      },
    ],
  },
  {
    id: 't05', num: 5, title: 'Сколько живёте на Кипре', emoji: '⏳',
    items: [
      {
        id: 'q05-howlong', title: 'Как долго вы живёте на Кипре?', fields: ['moveDate'],
        questions: Q(
          t('Πόσα χρόνια μένετε στην Κύπρο;', 'How many years have you lived in Cyprus?', 'Сколько лет вы живёте на Кипре?'),
          t('Πόσον καιρό ζείτε στην Κύπρο;', 'How long have you been living in Cyprus?', 'Как долго вы живёте на Кипре?'),
        ),
        answer: (c) => {
          const dur = c.sinceYears('moveDate', 'Дата переезда')
          const d = parseDate(c.p.moveDate)
          const y = d ? String(d.getFullYear()) : hole('Год переезда')
          return [t(`Μένω στην Κύπρο εδώ και ${dur.gr}, από το ${y}.`, `I have lived in Cyprus for ${dur.en}, since ${y}.`, `Я живу на Кипре уже ${dur.ru}, с ${y} года.`)]
        },
      },
    ],
  },
  {
    id: 't06', num: 6, title: 'Работа', emoji: '💼',
    items: [
      {
        id: 'q06-work', title: 'Вы работаете?', fields: ['workStatus'],
        questions: Q(
          t('Δουλεύετε;', 'Do you work?', 'Вы работаете?'),
          t('Εργάζεστε;', 'Are you employed?', 'Вы работаете?'),
        ),
        answer: (c) => {
          switch (c.p.workStatus) {
            case 'own': return [t('Ναι, έχω τη δική μου επιχείρηση.', 'Yes, I have my own business.', 'Да, у меня свой бизнес.')]
            case 'none': return [
              t('Όχι, αυτή τη στιγμή δεν δουλεύω.', 'No, I am not working at the moment.', 'Нет, сейчас я не работаю.'),
              hasKids(c)
                ? t('Φροντίζω το σπίτι και τα παιδιά.', 'I take care of the house and the children.', 'Я занимаюсь домом и детьми.')
                : t('Φροντίζω το σπίτι και μαθαίνω ελληνικά.', 'I take care of the house and learn Greek.', 'Я занимаюсь домом и учу греческий.'),
            ]
            default: return [t('Ναι, δουλεύω.', 'Yes, I work.', 'Да, работаю.')]
          }
        },
      },
      {
        id: 'q06-where', title: 'Где вы работаете?', fields: ['workStatus', 'employer', 'workSince', 'workMode', 'cyCity'],
        when: isWorking,
        questions: Q(
          t('Πού δουλεύετε;', 'Where do you work?', 'Где вы работаете?'),
          t('Πού εργάζεστε;', 'Where are you employed?', 'Где вы работаете?'),
        ),
        answer: (c) => {
          const e = c.text('employer', 'Компания')
          const out: Tri[] = []
          if (c.p.workStatus === 'own') {
            out.push(t(`Έχω τη δική μου εταιρεία, την ${e.gr}.`, `I have my own company, ${e.en}.`, `У меня своя компания — ${e.ru}.`))
          } else if (c.p.workStatus === 'remote') {
            out.push(t(`Δουλεύω από το σπίτι για την εταιρεία ${e.gr}.`, `I work from home for the company ${e.en}.`, `Я работаю из дома на компанию ${e.ru}.`))
          } else {
            const city = c.city('cyCity', 'Город на Кипре')
            out.push(t(`Δουλεύω στην εταιρεία ${e.gr}, ${city.in.gr}.`, `I work at ${e.en}, ${city.in.en}.`, `Я работаю в компании ${e.ru}, ${city.in.ru}.`))
            if (c.p.workMode === 'hybrid') out.push(t('Μερικές μέρες δουλεύω στο γραφείο και μερικές από το σπίτι.', 'Some days I work at the office and some from home.', 'Несколько дней работаю в офисе, несколько — из дома.'))
            else if (c.p.workMode === 'remote') out.push(t('Συνήθως δουλεύω από το σπίτι.', 'I usually work from home.', 'Обычно работаю из дома.'))
            else out.push(t('Πηγαίνω στο γραφείο κάθε μέρα.', 'I go to the office every day.', 'Каждый день езжу в офис.'))
          }
          if (c.num('workSince')) {
            const y = c.year('workSince', 'Год')
            out.push(t(`Δουλεύω εκεί από το ${y.gr}.`, `I have worked there since ${y.en}.`, `Работаю там с ${y.ru} года.`))
          }
          return out
        },
      },
      {
        id: 'q06-what', title: 'Чем вы занимаетесь на работе?', fields: ['job', 'jobCustom', 'duties'],
        when: isWorking,
        questions: Q(
          t('Με τι ασχολείστε στη δουλειά;', 'What do you do at work?', 'Чем вы занимаетесь на работе?'),
          t('Τι δουλειά κάνετε;', 'What is your job?', 'Кем вы работаете?'),
        ),
        answer: (c) => {
          const j = jobTitle(c)
          return [
            t(`Είμαι ${j.gr}.`, `I am a ${j.en}.`, `Я ${j.ru}.`),
            ...c.picks(JOB_DUTIES, 'duties').map((d) => c.gt(d.t)),
          ]
        },
      },
    ],
  },
  {
    id: 't07', num: 7, title: 'Зарплата и доходы', emoji: '💶',
    items: [
      {
        id: 'q07-salary', title: 'Какая у вас зарплата?', fields: ['salary'],
        questions: Q(
          t('Τι μισθό έχετε;', 'What is your salary?', 'Какая у вас зарплата?'),
          t('Πόσα χρήματα κερδίζετε τον μήνα;', 'How much money do you earn per month?', 'Сколько денег вы зарабатываете в месяц?'),
          t('Πόσα λεφτά κερδίζετε τον χρόνο;', 'How much money do you earn per year?', 'Сколько денег вы зарабатываете в год?'),
        ),
        answer: (c) => {
          const m = c.money('salary', 'Зарплата')
          const n = c.num('salary')
          const out = [t(`Ο μισθός μου είναι ${m.gr} τον μήνα, μικτά.`, `My salary is ${m.en} per month, gross.`, `Моя зарплата — ${m.ru} в месяц, до вычета налогов.`)]
          if (n) {
            const yy = n * 12
            out.push(t(`Δηλαδή περίπου ${yy.toLocaleString('de-DE')} ευρώ τον χρόνο.`, `That is about ${yy.toLocaleString('en-US')} euros per year.`, `То есть примерно ${yy.toLocaleString('ru-RU')} евро в год.`))
          }
          return out
        },
      },
      {
        id: 'q07-bonus', title: 'У вас есть бонусы?', fields: ['bonus'],
        questions: Q(t('Έχετε μπόνους;', 'Do you get a bonus?', 'У вас есть бонусы?')),
        answer: (c) => {
          const b = c.num('bonus')
          if (!b) return [t('Όχι, δεν παίρνω μπόνους.', 'No, I don\'t get a bonus.', 'Нет, бонусов я не получаю.')]
          const m = c.money('bonus', 'Бонус')
          return [t(`Ναι, παίρνω μπόνους μία φορά τον χρόνο, περίπου ${m.gr}.`, `Yes, I get a bonus once a year, about ${m.en}.`, `Да, получаю бонус раз в год, примерно ${m.ru}.`)]
        },
      },
      {
        id: 'q07-invest', title: 'У вас есть инвестиции?', fields: ['investments'],
        questions: Q(t('Έχετε επενδύσεις;', 'Do you have investments?', 'У вас есть инвестиции?')),
        answer: (c) => {
          const xs = (Array.isArray(c.p.investments) ? c.p.investments : []).filter((x: string) => x !== 'none')
          if (!xs.length) return [t('Όχι, δεν έχω επενδύσεις.', 'No, I don\'t have any investments.', 'Нет, инвестиций у меня нет.')]
          const out = [t('Ναι, έχω μερικές επενδύσεις.', 'Yes, I have some investments.', 'Да, у меня есть небольшие инвестиции.')]
          if (xs.includes('stocks')) out.push(t('Έχω μετοχές και αμοιβαία κεφάλαια.', 'I have shares and investment funds.', 'У меня есть акции и фонды.'))
          if (xs.includes('deposit')) out.push(t('Έχω μια κατάθεση στην τράπεζα.', 'I have a deposit in the bank.', 'У меня есть депозит в банке.'))
          if (xs.includes('realty')) out.push(t('Έχω ένα διαμέρισμα που το νοικιάζω.', 'I have an apartment that I rent out.', 'У меня есть квартира, которую я сдаю.'))
          return out
        },
      },
      {
        id: 'q07-div', title: 'У вас есть дивиденды?', fields: ['dividends'],
        questions: Q(t('Έχετε μερίσματα;', 'Do you receive dividends?', 'Вы получаете дивиденды?')),
        answer: (c) => {
          if (!c.num('dividends')) return [t('Όχι, δεν έχω μερίσματα.', 'No, I don\'t have dividends.', 'Нет, дивидендов у меня нет.')]
          const m = c.money('dividends', 'Дивиденды')
          return [t(`Ναι, παίρνω μικρά μερίσματα, περίπου ${m.gr} τον χρόνο.`, `Yes, I receive small dividends, about ${m.en} per year.`, `Да, получаю небольшие дивиденды, примерно ${m.ru} в год.`)]
        },
      },
    ],
  },
  {
    id: 't08', num: 8, title: 'Семья: супруг(а) и дети', emoji: '👨‍👩‍👧',
    items: [
      {
        id: 'q08-married', title: 'Вы женаты / замужем?', fields: ['marital', 'spouseName', 'spouseGender'],
        questions: (c) => [t(c.g('Είστε παντρεμένος;', 'Είστε παντρεμένη;'), 'Are you married?', c.g('Вы женаты?', 'Вы замужем?'))],
        answer: (c) => {
          const sp = spouse(c)
          switch (c.p.marital) {
            case 'married': {
              const nom = capTri(sp.nom)
              return [
                t(`Ναι, είμαι ${c.g('παντρεμένος', 'παντρεμένη')}.`, 'Yes, I am married.', c.g('Да, я женат.', 'Да, я замужем.')),
                t(`${nom.gr} λέγεται ${sp.name.gr}.`, `${nom.en}'s name is ${sp.name.en}.`, `${nom.ru} — ${sp.name.ru}.`),
              ]
            }
            case 'partner':
              return [t(
                `Δεν είμαστε παντρεμένοι, αλλά ζω με ${sp.f ? 'τη σύντροφό' : 'τον σύντροφό'} μου, ${sp.nameAcc}.`,
                `We are not married, but I live with my partner, ${sp.name.en}.`,
                `Мы не женаты, но я живу с ${sp.f ? 'партнёршей' : 'партнёром'} — ${sp.name.ru}.`,
              )]
            case 'divorced':
              return [t(`Όχι, είμαι ${c.g('διαζευγμένος', 'διαζευγμένη')}.`, 'No, I am divorced.', c.g('Нет, я в разводе.', 'Нет, я в разводе.'))]
            case 'widowed':
              return [t(`Είμαι ${c.g('χήρος', 'χήρα')}.`, c.g('I am a widower.', 'I am a widow.'), c.g('Я вдовец.', 'Я вдова.'))]
            case 'single':
              return [t(`Όχι, δεν είμαι ${c.g('παντρεμένος', 'παντρεμένη')}.`, 'No, I am not married.', c.g('Нет, я не женат.', 'Нет, я не замужем.'))]
            default:
              return [triAll(hole('Семейное положение'))]
          }
        },
      },
      {
        id: 'q08-kids', title: 'У вас есть дети?', fields: ['children'],
        questions: Q(t('Έχετε παιδιά;', 'Do you have children?', 'У вас есть дети?')),
        answer: (c) => {
          const ks = kids(c)
          if (!ks.length) return [t('Όχι, δεν έχω παιδιά.', 'No, I don\'t have children.', 'Нет, детей у меня нет.')]
          const sons = ks.filter((k) => k.gender !== 'f').length
          const daughters = ks.length - sons
          const grParts: string[] = [], enParts: string[] = [], ruParts: string[] = []
          if (sons) {
            grParts.push(sons === 1 ? 'έναν γιο' : `${numMascAcc(sons)} γιους`)
            enParts.push(sons === 1 ? 'a son' : `${numEn(sons)} sons`)
            ruParts.push(sons === 1 ? 'сын' : `${sons} ${ruPlural(sons, 'сын', 'сына', 'сыновей')}`)
          }
          if (daughters) {
            grParts.push(daughters === 1 ? 'μία κόρη' : `${numFem(daughters)} κόρες`)
            enParts.push(daughters === 1 ? 'a daughter' : `${numEn(daughters)} daughters`)
            ruParts.push(daughters === 1 ? 'дочь' : `${daughters} ${ruPlural(daughters, 'дочь', 'дочери', 'дочерей')}`)
          }
          const out: Tri[] = []
          if (ks.length === 1) {
            out.push(t(`Ναι, έχω ${grParts[0]}.`, `Yes, I have ${enParts[0]}.`, `Да, у меня ${ruParts[0]}.`))
            const n = childName(ks[0])
            out.push(t(`${ks[0].gender === 'f' ? 'Τη' : 'Τον'} λένε ${n.gr}.`, `${ks[0].gender === 'f' ? 'Her' : 'His'} name is ${n.en}.`, `${ks[0].gender === 'f' ? 'Её' : 'Его'} зовут ${n.ru}.`))
          } else {
            out.push(t(
              `Ναι, έχω ${numNeut(ks.length)} παιδιά: ${joinGr(grParts)}.`,
              `Yes, I have ${numEn(ks.length)} children: ${joinEn(enParts)}.`,
              `Да, у меня ${ks.length} ${ruPlural(ks.length, 'ребёнок', 'ребёнка', 'детей')}: ${joinRu(ruParts)}.`,
            ))
            const names = joinTri(ks.map(childName))
            out.push(t(`${daughters === ks.length ? 'Τις' : 'Τους'} λένε ${names.gr}.`, `Their names are ${names.en}.`, `Их зовут ${names.ru}.`))
          }
          return out
        },
      },
      {
        id: 'q08-wedding', title: 'Когда и где вы поженились?', fields: ['weddingDate', 'weddingCity'],
        when: (c) => c.p.marital === 'married',
        questions: Q(t('Πότε και πού παντρευτήκατε;', 'When and where did you get married?', 'Когда и где вы поженились?')),
        answer: (c) => {
          const d = c.date('weddingDate', 'Дата свадьбы'), w = c.city('weddingCity', 'Где поженились')
          return [t(`Παντρευτήκαμε ${d.gr}, ${w.in.gr}.`, `We got married ${d.en}, ${w.in.en}.`, `Мы поженились ${d.ru}, ${w.in.ru}.`)]
        },
      },
      {
        id: 'q08-spouse-name', title: 'Как зовут вашего мужа / жену?', fields: ['spouseName', 'spouseGender'],
        when: isMarried,
        questions: (c) => {
          const sp = spouse(c)
          return [t(`Πώς λένε ${sp.yours.gr};`, `What is ${sp.yours.en}'s name?`, `Как зовут ${sp.yours.ru}?`)]
        },
        answer: (c) => {
          const sp = spouse(c)
          return [t(`${sp.acc} λένε ${sp.name.gr}.`, `${sp.f ? 'Her' : 'His'} name is ${sp.name.en}.`, `${sp.f ? 'Её' : 'Его'} зовут ${sp.name.ru}.`)]
        },
      },
      {
        id: 'q08-spouse-born', title: 'Где и когда родился(-ась) супруг(а)?', fields: ['spouseBirthDate', 'spouseBirthCity'],
        when: isMarried,
        questions: (c) => {
          const sp = spouse(c)
          return [
            t(`Πού και πότε γεννήθηκε ${sp.yoursNom.gr};`, `Where and when was ${sp.yoursNom.en} born?`, `Где и когда ${sp.f ? 'родилась' : 'родился'} ${sp.yoursNom.ru}?`),
            t('Πού και πότε γεννήθηκε;', `Where and when was ${sp.f ? 'she' : 'he'} born?`, `Где и когда ${sp.f ? 'она родилась' : 'он родился'}?`),
          ]
        },
        answer: (c) => {
          const sp = spouse(c)
          const nom = capTri(sp.nom)
          const d = c.date('spouseBirthDate', 'Дата рождения супруга(-и)'), w = c.city('spouseBirthCity', 'Где родился(-ась)')
          return [t(`${nom.gr} γεννήθηκε ${d.gr}, ${w.in.gr}.`, `${nom.en} was born ${d.en}, ${w.in.en}.`, `${nom.ru} ${sp.f ? 'родилась' : 'родился'} ${d.ru}, ${w.in.ru}.`)]
        },
      },
      {
        id: 'q08-spouse-work', title: 'Супруг(а) работает? Где?', fields: ['spouseWorks', 'spouseJob', 'spouseEmployer'],
        when: isMarried,
        questions: (c) => {
          const sp = spouse(c)
          return [
            t(`Δουλεύει ${sp.yoursNom.gr};`, `Does ${sp.yoursNom.en} work?`, `${capTri(sp.yoursNom).ru} работает?`),
            t('Πού δουλεύει;', `Where does ${sp.f ? 'she' : 'he'} work?`, `Где ${sp.f ? 'она' : 'он'} работает?`),
          ]
        },
        answer: (c) => {
          const sp = spouse(c)
          if (c.p.spouseWorks === false) {
            return [
              t('Όχι, δεν δουλεύει.', `No, ${sp.f ? 'she' : 'he'} doesn't work.`, `Нет, ${sp.f ? 'она' : 'он'} не работает.`),
              hasKids(c)
                ? t('Είναι στο σπίτι με τα παιδιά.', `${sp.f ? 'She' : 'He'} stays at home with the children.`, `${sp.f ? 'Она' : 'Он'} дома с детьми.`)
                : t('Αυτή τη στιγμή μαθαίνει ελληνικά.', `At the moment ${sp.f ? 'she' : 'he'} is learning Greek.`, `Сейчас ${sp.f ? 'она' : 'он'} учит греческий.`),
            ]
          }
          const j = c.text('spouseJob', 'Кем работает'), e = c.text('spouseEmployer', 'Где работает')
          return [
            t(`Ναι, δουλεύει. Είναι ${j.gr}.`, `Yes, ${sp.f ? 'she' : 'he'} works. ${sp.f ? 'She' : 'He'} is a ${j.en}.`, `Да, работает. ${sp.f ? 'Она' : 'Он'} — ${j.ru}.`),
            t(`Δουλεύει στην εταιρεία ${e.gr}.`, `${sp.f ? 'She' : 'He'} works at ${e.en}.`, `${sp.f ? 'Она' : 'Он'} работает в компании ${e.ru}.`),
          ]
        },
      },
      {
        id: 'q08-spouse-salary', title: 'Какая зарплата у супруга(-и)?', fields: ['spouseSalary'],
        when: isMarried,
        questions: Q(t('Τι μισθό έχει;', 'What is the salary?', 'Какая у него/неё зарплата?')),
        answer: (c) => {
          const sp = spouse(c)
          if (c.p.spouseWorks === false) return [t('Δεν δουλεύει, οπότε δεν έχει μισθό.', `${sp.f ? 'She' : 'He'} doesn't work, so there is no salary.`, `${sp.f ? 'Она' : 'Он'} не работает, поэтому зарплаты нет.`)]
          const m = c.money('spouseSalary', 'Зарплата супруга(-и)')
          return [t(`Ο μισθός ${sp.gen} είναι ${m.gr} τον μήνα.`, `${sp.f ? 'Her' : 'His'} salary is ${m.en} per month.`, `${sp.f ? 'Её' : 'Его'} зарплата — ${m.ru} в месяц.`)]
        },
      },
      {
        id: 'q08-kids-born', title: 'Когда и где родились дети?', fields: ['children'],
        when: hasKids,
        questions: Q(
          t('Πότε και πού γεννήθηκαν τα παιδιά σας;', 'When and where were your children born?', 'Когда и где родились ваши дети?'),
          t('Τα παιδιά. Πότε και πού γεννήθηκαν;', 'The children. When and where were they born?', 'Дети. Когда и где они родились?'),
        ),
        answer: (c) => kids(c).map((k) => {
          const n = childName(k), f = k.gender === 'f'
          const dd = onDate(k.birthDate, 'Дата рождения ребёнка')
          const pl = placeForms(k.birthPlace, CITIES, 'Место рождения ребёнка').in
          return t(
            `${f ? 'Η κόρη μου, η' : 'Ο γιος μου, ο'} ${n.gr}, γεννήθηκε ${dd.gr}, ${pl.gr}.`,
            `My ${f ? 'daughter' : 'son'} ${n.en} was born ${dd.en}, ${pl.en}.`,
            `${f ? 'Моя дочь' : 'Мой сын'} ${n.ru} ${f ? 'родилась' : 'родился'} ${dd.ru}, ${pl.ru}.`,
          )
        }),
      },
      {
        id: 'q08-kids-school', title: 'В какую школу ходят дети?', fields: ['children'],
        when: hasKids,
        questions: Q(
          t('Σε τι σχολείο πηγαίνουν τα παιδιά σας;', 'What school do your children go to?', 'В какую школу ходят ваши дети?'),
          t('Πού σπουδάζουν;', 'Where do they study?', 'Где они учатся?'),
          t('Πού πάνε σχολείο τα παιδιά;', 'Where do the children go to school?', 'Куда дети ходят в школу?'),
        ),
        answer: (c) => kids(c).flatMap((k) => {
          const n = childName(k), f = k.gender === 'f'
          const art = childArt(k)
          const s = SCHOOLS.find((x) => x.value === k.school)
          if (!s) return [t(`${cap(art)} ${n.gr} ${hole('Школа')}.`, `${n.en} ${hole('Школа')}.`, `${n.ru} ${hole('Школа')}.`)]
          let what: Tri = s.t
          if (s.value === 'home') what = t(`είναι ακόμα ${f ? 'μικρή' : 'μικρός'} και μένει στο σπίτι`, s.t.en, s.t.ru.replace('маленький', f ? 'маленькая' : 'маленький'))
          if (s.value === 'adult') what = t(`είναι ${f ? 'μεγάλη' : 'μεγάλος'} και δουλεύει`, s.t.en, f ? 'взрослая и работает' : 'взрослый и работает')
          const out = [t(`${cap(art)} ${n.gr} ${what.gr}.`, `${n.en} ${what.en}.`, `${n.ru} ${what.ru}.`)]
          const sn = k.schoolName?.trim()
          if (sn && s.value !== 'home' && s.value !== 'adult') {
            out.push(s.value === 'uni'
              ? t(`Το πανεπιστήμιο λέγεται ${sn}.`, `The university is called ${sn}.`, `Университет называется ${sn}.`)
              : t(`Το σχολείο λέγεται ${sn}.`, `The school is called ${sn}.`, `Школа называется ${sn}.`))
          }
          return out
        }),
      },
    ],
  },
  {
    id: 't09', num: 9, title: 'Родители', emoji: '👵',
    items: [
      {
        id: 'q09-where', title: 'Где живут ваши родители?', fields: ['parentsCity', 'parentsCountry', 'fatherStatus', 'motherStatus'],
        questions: Q(t('Πού μένουν οι γονείς σας;', 'Where do your parents live?', 'Где живут ваши родители?')),
        answer: (c) => {
          const ci = c.city('parentsCity', 'Город родителей'), co = c.country('parentsCountry', 'Страна родителей')
          const fd = c.p.fatherStatus === 'deceased', md = c.p.motherStatus === 'deceased'
          if (fd && md) return [t('Δυστυχώς, οι γονείς μου δεν ζουν πια.', 'Unfortunately, my parents are no longer alive.', 'К сожалению, моих родителей уже нет в живых.')]
          const where = t(`${ci.in.gr}, ${co.in.gr}`, `${ci.in.en}, ${co.in.en}`, `${ci.in.ru}, ${co.in.ru}`)
          if (fd) return [
            t(`Η μητέρα μου μένει ${where.gr}.`, `My mother lives ${where.en}.`, `Моя мама живёт ${where.ru}.`),
            t('Ο πατέρας μου δυστυχώς δεν ζει πια.', 'My father, unfortunately, is no longer alive.', 'Моего папы, к сожалению, уже нет.'),
          ]
          if (md) return [
            t(`Ο πατέρας μου μένει ${where.gr}.`, `My father lives ${where.en}.`, `Мой папа живёт ${where.ru}.`),
            t('Η μητέρα μου δυστυχώς δεν ζει πια.', 'My mother, unfortunately, is no longer alive.', 'Моей мамы, к сожалению, уже нет.'),
          ]
          return [t(`Οι γονείς μου μένουν ${where.gr}.`, `My parents live ${where.en}.`, `Мои родители живут ${where.ru}.`)]
        },
      },
      {
        id: 'q09-work', title: 'Родители работают?', fields: ['fatherStatus', 'fatherJob', 'motherStatus', 'motherJob'],
        questions: Q(
          t('Δουλεύουν;', 'Do they work?', 'Они работают?'),
          t('Δουλεύουν οι γονείς σας;', 'Do your parents work?', 'Ваши родители работают?'),
        ),
        answer: (c) => {
          const one = (who: 'father' | 'mother'): Tri => {
            const f = who === 'mother'
            const W = t(f ? 'Η μητέρα μου' : 'Ο πατέρας μου', f ? 'My mother' : 'My father', f ? 'Моя мама' : 'Мой папа')
            const st = c.p[`${who}Status`]
            if (st === 'retired') return t(`${W.gr} είναι συνταξιούχος.`, `${W.en} is retired.`, `${W.ru} на пенсии.`)
            if (st === 'deceased') return t(`${W.gr} δεν ζει πια.`, `${W.en} is no longer alive.`, `${W.ru} ${f ? 'умерла' : 'умер'}.`)
            const j = c.text(`${who}Job`, f ? 'Кем работает мать' : 'Кем работает отец')
            return t(`${W.gr} δουλεύει ακόμα, είναι ${j.gr}.`, `${W.en} still works, ${f ? 'she' : 'he'} is a ${j.en}.`, `${W.ru} ещё работает, ${f ? 'она' : 'он'} — ${j.ru}.`)
          }
          return [one('father'), one('mother')]
        },
      },
      {
        id: 'q09-names', title: 'Как зовут ваших родителей?', fields: ['fatherName', 'motherName'],
        questions: Q(
          t('Πώς τους λένε;', 'What are their names?', 'Как их зовут?'),
          t('Πώς λένε τους γονείς σας;', 'What are your parents\' names?', 'Как зовут ваших родителей?'),
        ),
        answer: (c) => {
          const f = c.name('fatherName', 'Имя отца'), m = c.name('motherName', 'Имя матери')
          const fd = c.p.fatherStatus === 'deceased', md = c.p.motherStatus === 'deceased'
          return [
            t(`Ο πατέρας μου ${fd ? 'λεγόταν' : 'λέγεται'} ${f.gr}.`, `My father${fd ? '\'s name was' : '\'s name is'} ${f.en}.`, `Моего папу ${fd ? 'звали' : 'зовут'} ${f.ru}.`),
            t(`Η μητέρα μου ${md ? 'λεγόταν' : 'λέγεται'} ${m.gr}.`, `My mother${md ? '\'s name was' : '\'s name is'} ${m.en}.`, `Мою маму ${md ? 'звали' : 'зовут'} ${m.ru}.`),
          ]
        },
      },
    ],
  },
  {
    id: 't10', num: 10, title: 'Другая семья', emoji: '🔍',
    items: [
      {
        id: 'q10-other', title: 'Есть ли другая жена/муж, другие дети?', fields: ['prevMarriage', 'prevMarriageText'],
        questions: (c) => [
          t(
            c.g('Έχετε άλλη γυναίκα ή άλλα παιδιά;', 'Έχετε άλλον άντρα ή άλλα παιδιά;'),
            c.g('Do you have another wife or other children?', 'Do you have another husband or other children?'),
            c.g('У вас есть другая жена или другие дети?', 'У вас есть другой муж или другие дети?'),
          ),
        ],
        answer: (c) => {
          const txt = typeof c.p.prevMarriageText === 'string' ? c.p.prevMarriageText.trim() : ''
          if (c.p.prevMarriage && txt) return [triAll(txt)]
          return [t(
            `Όχι. Δεν έχω ${c.g('άλλη γυναίκα', 'άλλον άντρα')} και δεν έχω άλλα παιδιά.`,
            `No. I don't have another ${c.g('wife', 'husband')} and I don't have other children.`,
            `Нет. У меня нет ${c.g('другой жены', 'другого мужа')} и нет других детей.`,
          )]
        },
      },
    ],
  },
  {
    id: 't11', num: 11, title: 'Родственники на Кипре', emoji: '🧑‍🤝‍🧑',
    items: [
      {
        id: 'q11-relatives', title: 'Есть ли родственники на Кипре?', fields: ['relatives'],
        questions: Q(t('Έχετε συγγενείς στην Κύπρο;', 'Do you have relatives in Cyprus?', 'У вас есть родственники на Кипре?')),
        answer: (c) => {
          const txt = typeof c.p.relatives === 'string' ? c.p.relatives.trim() : ''
          if (txt) return [t('Ναι.', 'Yes.', 'Да.'), triAll(txt)]
          const out = [t('Όχι, δεν έχω συγγενείς στην Κύπρο.', 'No, I don\'t have relatives in Cyprus.', 'Нет, родственников на Кипре у меня нет.')]
          if (isMarried(c) || hasKids(c)) out.push(t('Εδώ μένω μόνο με την οικογένειά μου.', 'Here I live only with my family.', 'Здесь я живу только со своей семьёй.'))
          return out
        },
      },
    ],
  },
  {
    id: 't12', num: 12, title: 'Языки', emoji: '🗣️',
    items: [
      {
        id: 'q12-langs', title: 'Какие языки вы знаете?', fields: ['nativeLang', 'langs'],
        questions: Q(
          t('Τι γλώσσες μιλάτε;', 'What languages do you speak?', 'На каких языках вы говорите?'),
          t('Τι γλώσσες ξέρετε;', 'What languages do you know?', 'Какие языки вы знаете?'),
        ),
        answer: (c) => {
          const native = c.pick(LANGUAGES, 'nativeLang')
          const others = c.picks(LANGUAGES, 'langs').filter((l) => l.value !== native?.value)
          const all = [...(native ? [native.t] : []), ...others.map((l) => l.t)]
          const gr = joinGr([...all.map((x) => x.gr), 'λίγα ελληνικά'])
          const en = joinEn([...all.map((x) => x.en), 'a little Greek'])
          const ru = joinRu([...all.map((x) => x.ru), 'немного по-гречески'])
          const out = [t(`Μιλάω ${gr}.`, `I speak ${en}.`, `Я говорю: ${ru}.`)]
          if (native) out.push(t(`Τα ${native.t.gr} είναι η μητρική μου γλώσσα.`, `${native.t.en} is my native language.`, `${cap(native.t.ru)} — мой родной язык.`))
          return out
        },
      },
      {
        id: 'q12-greek', title: 'Где и сколько учите греческий?', fields: ['greekSince', 'greekWhere'],
        questions: Q(
          t('Πού μάθατε ελληνικά;', 'Where did you learn Greek?', 'Где вы учили греческий?'),
          t('Πόσον καιρό μαθαίνετε ελληνικά;', 'How long have you been learning Greek?', 'Сколько вы учите греческий?'),
        ),
        answer: (c) => {
          const y = c.year('greekSince', 'Год начала')
          const w = c.pick(GREEK_WHERE, 'greekWhere')
          return [
            t(`Μαθαίνω ελληνικά από το ${y.gr}.`, `I have been learning Greek since ${y.en}.`, `Я учу греческий с ${y.ru} года.`),
            ...(w ? [c.gt(w.t)] : []),
            t('Καταλαβαίνω περισσότερα απ\' όσα μπορώ να πω.', 'I understand more than I can say.', 'Я понимаю больше, чем могу сказать.'),
          ]
        },
      },
    ],
  },
  {
    id: 't13', num: 13, title: 'Свободное время', emoji: '🌴',
    items: [
      {
        id: 'q13-free', title: 'Что делаете в свободное время?', fields: ['hobbies'],
        questions: Q(
          t('Με τι ασχολείστε στον ελεύθερο χρόνο;', 'What do you do in your free time?', 'Чем вы занимаетесь в свободное время?'),
          t('Τι κάνετε στον ελεύθερό σας χρόνο;', 'What do you do in your free time?', 'Что вы делаете в свободное время?'),
        ),
        answer: (c) => {
          const hs = c.picks(HOBBIES, 'hobbies').slice(0, 4)
          const out: Tri[] = []
          if (hs.length) {
            const v = joinTri(hs.map((x) => c.gt(x.t.verb)))
            out.push(t(`Στον ελεύθερο χρόνο μου ${v.gr}.`, `In my free time ${v.en}.`, `В свободное время я ${v.ru}.`))
          } else out.push(triAll(hole('Хобби')))
          out.push(we(c,
            t('Τα Σαββατοκύριακα πηγαίνω στη θάλασσα ή στο βουνό.', 'At weekends I go to the sea or to the mountains.', 'По выходным езжу на море или в горы.'),
            t('Τα Σαββατοκύριακα πηγαίνουμε με την οικογένεια στη θάλασσα ή στο βουνό.', 'At weekends we go with the family to the sea or to the mountains.', 'По выходным мы с семьёй ездим на море или в горы.'),
          ))
          return out
        },
      },
    ],
  },
  {
    id: 't14', num: 14, title: 'За что вы любите Кипр', emoji: '❤️',
    items: [
      {
        id: 'q14-like', title: 'Почему вам нравится Кипр?', fields: ['likeCy'],
        questions: Q(
          t('Γιατί σας αρέσει η Κύπρος;', 'Why do you like Cyprus?', 'Почему вам нравится Кипр?'),
          t('Γιατί αγαπάτε την Κύπρο;', 'Why do you love Cyprus?', 'Почему вы любите Кипр?'),
        ),
        answer: (c) => [
          ...c.picks(LIKE_CY, 'likeCy').map((x) => c.gt(x.t)),
          t('Νιώθω ότι η Κύπρος είναι το σπίτι μου.', 'I feel that Cyprus is my home.', 'Я чувствую, что Кипр — мой дом.'),
        ],
      },
    ],
  },
  {
    id: 't15', num: 15, title: 'Жильё и адрес', emoji: '🏠',
    items: [
      {
        id: 'q15-area', title: 'В каком районе вы живёте?', fields: ['cyCity', 'area'],
        questions: Q(t('Σε ποια περιοχή μένετε;', 'Which area do you live in?', 'В каком районе вы живёте?')),
        answer: (c) => {
          const ci = c.city('cyCity', 'Город на Кипре'), a = c.text('area', 'Район')
          return [t(`Μένω ${ci.in.gr}, στην περιοχή ${a.gr}.`, `I live ${ci.in.en}, in the ${a.en} area.`, `Я живу ${ci.in.ru}, в районе ${a.ru}.`)]
        },
      },
      {
        id: 'q15-address', title: 'Ваш адрес?', fields: ['address', 'postcode', 'cyCity'],
        questions: Q(
          t('Ποια είναι η διεύθυνσή σας;', 'What is your address?', 'Какой у вас адрес?'),
          t('Διεύθυνση;', 'Address?', 'Адрес?'),
        ),
        answer: (c) => {
          const a = c.text('address', 'Адрес'), ci = c.city('cyCity', 'Город на Кипре')
          const pc = typeof c.p.postcode === 'string' && c.p.postcode.trim() ? ` ${c.p.postcode.trim()}` : ''
          return [t(`Η διεύθυνσή μου είναι ${a.gr},${pc} ${ci.name.gr}.`, `My address is ${a.en},${pc} ${ci.name.en}.`, `Мой адрес: ${a.ru},${pc} ${ci.name.ru}.`)]
        },
      },
      {
        id: 'q15-phone', title: 'Ваш телефон?', fields: ['phone'],
        questions: Q(
          t('Ποιο είναι το τηλέφωνό σας;', 'What is your phone number?', 'Какой у вас номер телефона?'),
          t('Τηλέφωνο;', 'Phone?', 'Телефон?'),
        ),
        answer: (c) => {
          const ph = typeof c.p.phone === 'string' && c.p.phone.trim() ? phoneSpaced(c.p.phone) : hole('Телефон')
          return [t(`Το τηλέφωνό μου είναι ${ph}.`, `My phone number is ${ph}.`, `Мой телефон: ${ph}.`)]
        },
      },
      {
        id: 'q15-type', title: 'Дом или квартира?', fields: ['houseType', 'bedrooms'],
        questions: Q(
          t('Μένετε σε μονοκατοικία ή σε διαμέρισμα;', 'Do you live in a house or an apartment?', 'Вы живёте в доме или в квартире?'),
        ),
        answer: (c) => {
          const ht = c.pick(HOUSE_TYPE, 'houseType')
          const n = c.num('bedrooms')
          const what = ht ? ht.t : triAll(hole('Тип жилья'))
          const ruWhat = ht?.value === 'flat' ? 'квартире' : ht?.value === 'house' ? 'частном доме' : ht?.value === 'maisonette' ? 'таунхаусе' : what.ru
          if (!n) return [t(`Μένω σε ${what.gr}.`, `I live in ${what.en}.`, `Я живу в ${ruWhat}.`)]
          return [t(
            `Μένω σε ${what.gr} με ${n === 1 ? 'ένα υπνοδωμάτιο' : `${numNeut(n)} υπνοδωμάτια`}.`,
            `I live in ${what.en} with ${n === 1 ? 'one bedroom' : `${numEn(n)} bedrooms`}.`,
            `Я живу в ${ruWhat} с ${n === 1 ? 'одной спальней' : `${n} спальнями`}.`,
          )]
        },
      },
      {
        id: 'q15-own', title: 'Снимаете или своё жильё?', fields: ['tenure'],
        questions: Q(
          t('Νοικιάζετε ή έχετε το δικό σας σπίτι;', 'Do you rent or do you have your own home?', 'Вы снимаете или у вас своё жильё?'),
          t('Νοικιάζετε;', 'Do you rent?', 'Вы снимаете жильё?'),
          t('Έχετε το δικό σας σπίτι;', 'Do you have your own home?', 'У вас есть своё жильё?'),
        ),
        answer: (c) => owns(c)
          ? [t('Έχω το δικό μου σπίτι.', 'I have my own home.', 'У меня своё жильё.')]
          : [t('Νοικιάζω. Το σπίτι δεν είναι δικό μου.', 'I rent. The home is not mine.', 'Я снимаю. Жильё не моё.')],
      },
      {
        id: 'q15-bought', title: 'Когда купили жильё?', fields: ['tenure', 'buyDate'],
        questions: Q(
          t('Πότε αγοράσατε;', 'When did you buy it?', 'Когда вы купили?'),
          t('Πότε αγοράσατε το σπίτι;', 'When did you buy the house?', 'Когда вы купили дом?'),
        ),
        answer: (c) => {
          if (!owns(c)) return [t('Δεν έχω αγοράσει σπίτι. Νοικιάζω.', 'I haven\'t bought a home. I rent.', 'Я не покупал(а) жильё. Я снимаю.')]
          const m = c.month('buyDate', 'Когда купили')
          return [we(c,
            t(`Το αγόρασα ${m.gr}.`, `I bought it ${m.en}.`, `${c.g('Я купил', 'Я купила')} его ${m.ru}.`),
            t(`Το αγοράσαμε ${m.gr}.`, `We bought it ${m.en}.`, `Мы купили его ${m.ru}.`),
          )]
        },
      },
      {
        id: 'q15-price', title: 'Сколько заплатили?', fields: ['price'],
        when: owns,
        questions: Q(t('Πόσα πληρώσατε;', 'How much did you pay?', 'Сколько вы заплатили?')),
        answer: (c) => {
          const m = c.money('price', 'Цена')
          return [we(c,
            t(`Πλήρωσα ${m.gr}.`, `I paid ${m.en}.`, `${c.g('Я заплатил', 'Я заплатила')} ${m.ru}.`),
            t(`Πληρώσαμε ${m.gr}.`, `We paid ${m.en}.`, `Мы заплатили ${m.ru}.`),
          )]
        },
      },
      {
        id: 'q15-loan', title: 'Брали кредит?', fields: ['loan', 'bank'],
        when: owns,
        questions: Q(
          t('Πήρατε δάνειο;', 'Did you take a loan?', 'Вы брали кредит?'),
          t('Πήρατε το δάνειο;', 'Did you take the loan?', 'Вы брали кредит?'),
        ),
        answer: (c) => {
          if (!c.p.loan) return [t('Όχι, δεν πήραμε δάνειο.', 'No, we didn\'t take a loan.', 'Нет, кредит мы не брали.')]
          const b = c.text('bank', 'Банк')
          return [t(`Ναι, πήραμε στεγαστικό δάνειο από την ${b.gr}.`, `Yes, we took a mortgage from ${b.en}.`, `Да, мы взяли ипотеку в ${b.ru}.`)]
        },
      },
      {
        id: 'q15-money', title: 'Откуда деньги на жильё?', fields: ['moneySources'],
        when: owns,
        questions: Q(
          t('Πού πήρατε τα χρήματα;', 'Where did you get the money?', 'Где вы взяли деньги?'),
          t('Από πού ήταν τα χρήματα;', 'Where was the money from?', 'Откуда были деньги?'),
        ),
        answer: (c) => {
          const xs = c.picks(MONEY_SOURCES, 'moneySources')
          if (!xs.length) return [triAll(hole('Откуда деньги'))]
          const j = joinTri(xs.map((x) => x.t))
          return [t(`Τα χρήματα ήταν ${j.gr}.`, `The money came ${j.en}.`, `Деньги — ${j.ru}.`)]
        },
      },
      {
        id: 'q15-sold', title: 'Продали жильё на родине?', fields: ['oldHome', 'oldHomeSoldYear', 'country'],
        questions: Q(
          t('Πουλήσατε το σπίτι ή το διαμέρισμα στη χώρα σας;', 'Did you sell your house or apartment in your country?', 'Вы продали дом или квартиру на родине?'),
        ),
        answer: (c) => {
          const co = c.country('country', 'Страна')
          switch (c.p.oldHome) {
            case 'sold': {
              const y = c.year('oldHomeSoldYear', 'Год продажи')
              return [t(`Ναι, πούλησα το διαμέρισμά μου ${co.in.gr} το ${y.gr}.`, `Yes, I sold my apartment ${co.in.en} in ${y.en}.`, `Да, я ${c.g('продал', 'продала')} свою квартиру ${co.in.ru} в ${y.ru} году.`)]
            }
            case 'kept':
              return [t(`Όχι, έχω ακόμα ένα διαμέρισμα ${co.in.gr}.`, `No, I still have an apartment ${co.in.en}.`, `Нет, у меня ещё есть квартира ${co.in.ru}.`)]
            default:
              return [t('Όχι, δεν είχα δικό μου σπίτι εκεί.', 'No, I didn\'t have my own home there.', 'Нет, своего жилья там у меня не было.')]
          }
        },
      },
      {
        id: 'q15-monthly', title: 'Сколько платите в месяц?', fields: ['monthly', 'tenure', 'loan'],
        questions: Q(
          t('Πόσο πληρώνετε το ενοίκιο ή το δάνειο κάθε μήνα;', 'How much do you pay for rent or the loan every month?', 'Сколько вы платите за аренду или кредит каждый месяц?'),
        ),
        answer: (c) => {
          const m = c.money('monthly', 'Платёж в месяц')
          if (!owns(c)) return [t(`Πληρώνω ${m.gr} ενοίκιο τον μήνα.`, `I pay ${m.en} rent per month.`, `Я плачу ${m.ru} аренды в месяц.`)]
          if (c.p.loan) return [t(`Πληρώνω ${m.gr} για το δάνειο κάθε μήνα.`, `I pay ${m.en} for the loan every month.`, `Я плачу ${m.ru} по кредиту каждый месяц.`)]
          return [t('Δεν πληρώνω ούτε ενοίκιο ούτε δάνειο. Το σπίτι είναι δικό μου.', 'I pay neither rent nor a loan. The home is mine.', 'Я не плачу ни аренду, ни кредит. Жильё моё.')]
        },
      },
    ],
  },
  {
    id: 't16', num: 16, title: 'Кипрская еда', emoji: '🥙',
    items: [
      {
        id: 'q16-food', title: 'Какая еда вам нравится?', fields: ['foods'],
        questions: Q(
          t('Τι φαγητό σας αρέσει;', 'What food do you like?', 'Какая еда вам нравится?'),
          t('Κυπριακό φαγητό. Τι σας αρέσει;', 'Cypriot food. What do you like?', 'Кипрская еда. Что вам нравится?'),
        ),
        answer: (c) => {
          const fs = c.picks(FOODS, 'foods')
          const out = [t('Μου αρέσει πολύ η κυπριακή κουζίνα.', 'I really like Cypriot cuisine.', 'Мне очень нравится кипрская кухня.')]
          if (!fs.length) return [...out, triAll(hole('Любимая еда'))]
          const first = fs[0].t.nom
          out.push(t(`Το αγαπημένο μου φαγητό είναι ${first.gr}.`, `My favourite dish is ${first.en}.`, `Моё любимое блюдо — ${first.ru}.`))
          const rest = fs.slice(1, 4).map((x) => x.t.nom)
          if (rest.length) {
            const j = joinTri(rest)
            const plural = rest.length > 1 || /^(?:τα|οι) /.test(rest[0].gr)
            out.push(t(`Μου ${plural ? 'αρέσουν' : 'αρέσει'} επίσης ${j.gr}.`, `I also like ${j.en}.`, `Ещё мне ${plural ? 'нравятся' : 'нравится'} ${j.ru}.`))
          }
          return out
        },
      },
      {
        id: 'q16-trad', title: 'Едите традиционную кипрскую еду?', fields: ['foods'],
        questions: Q(t('Τρώτε παραδοσιακό κυπριακό φαγητό;', 'Do you eat traditional Cypriot food?', 'Вы едите традиционную кипрскую еду?')),
        answer: (c) => {
          const fs = c.picks(FOODS, 'foods').slice(0, 3)
          const out = [t('Ναι, φυσικά!', 'Yes, of course!', 'Да, конечно!')]
          if (fs.length) {
            const gr = joinGr(fs.map((x) => x.t.acc)), en = joinEn(fs.map((x) => x.t.nom.en)), ru = joinRu(fs.map((x) => x.t.nom.ru))
            out.push(t(`Τρώω συχνά ${gr}.`, `I often eat ${en}.`, `Я часто ем ${ru}.`))
          }
          out.push(we(c,
            t('Συχνά πηγαίνω σε ταβέρνα με φίλους και τρώμε κυπριακό μεζέ.', 'I often go to a tavern with friends and we eat Cypriot meze.', 'Я часто хожу в таверну с друзьями, и мы едим кипрское мезе.'),
            t('Τα Σαββατοκύριακα πηγαίνουμε σε ταβέρνα και τρώμε κυπριακό μεζέ.', 'At weekends we go to a tavern and eat Cypriot meze.', 'По выходным мы ходим в таверну и едим кипрское мезе.'),
          ))
          return out
        },
      },
    ],
  },
  {
    id: 't17', num: 17, title: 'Праздники и традиции', emoji: '🎉',
    items: [
      {
        id: 'q17-customs', title: 'Какие обычаи вы знаете?',
        questions: Q(
          t('Τι ήθη και έθιμα ξέρετε;', 'What customs and traditions do you know?', 'Какие обычаи и традиции вы знаете?'),
          t('Γιορτές στην Κύπρο, έθιμα. Τι ξέρετε;', 'Holidays in Cyprus, customs. What do you know?', 'Праздники на Кипре, обычаи. Что вы знаете?'),
        ),
        answer: () => [
          t('Ξέρω αρκετά κυπριακά ήθη και έθιμα.', 'I know quite a few Cypriot customs.', 'Я знаю довольно много кипрских обычаев.'),
          t('Το Πάσχα βάφουμε κόκκινα αυγά και τα τσουγκρίζουμε.', 'At Easter we dye red eggs and crack them together.', 'На Пасху мы красим яйца в красный и бьёмся ими.'),
          t('Φτιάχνουμε φλαούνες για το Πάσχα.', 'We make flaounes for Easter.', 'Печём флаунес на Пасху.'),
          t('Τη Μεγάλη Παρασκευή ακολουθούμε τον Επιτάφιο.', 'On Good Friday we follow the Epitaphios procession.', 'В Страстную пятницу идём за Плащаницей (Эпитафиос).'),
          t('Το Μεγάλο Σάββατο το βράδυ πηγαίνουμε στην εκκλησία και λέμε «Χριστός Ανέστη!».', 'On Holy Saturday night we go to church and say "Christ is risen!".', 'В Великую субботу вечером идём в церковь и говорим «Христос воскресе!».'),
          t('Την Καθαρά Δευτέρα πετάμε χαρταετό και τρώμε νηστίσιμα.', 'On Clean Monday we fly kites and eat Lenten food.', 'В Чистый понедельник запускаем воздушных змеев и едим постное.'),
          t('Την Πρωτοχρονιά κόβουμε τη βασιλόπιτα.', 'On New Year\'s Day we cut the vasilopita.', 'На Новый год разрезаем василопиту.'),
        ],
      },
      {
        id: 'q17-celebrate', title: 'Как вы празднуете праздники?',
        questions: Q(t('Πώς γιορτάζετε θρησκευτικές και εθνικές γιορτές;', 'How do you celebrate religious and national holidays?', 'Как вы празднуете религиозные и национальные праздники?')),
        answer: () => [
          t('Τις θρησκευτικές γιορτές, όπως τα Χριστούγεννα και το Πάσχα, τις γιορτάζουμε με την οικογένεια και τους φίλους μας.', 'We celebrate religious holidays, like Christmas and Easter, with our family and friends.', 'Религиозные праздники, например Рождество и Пасху, мы отмечаем с семьёй и друзьями.'),
          t('Πηγαίνουμε στην εκκλησία και μετά τρώμε όλοι μαζί.', 'We go to church and then we all eat together.', 'Ходим в церковь, а потом все вместе едим.'),
          t('Στις εθνικές γιορτές, την 25η Μαρτίου, την 1η Απριλίου και την 1η Οκτωβρίου, βλέπουμε τις παρελάσεις.', 'On national holidays, 25 March, 1 April and 1 October, we watch the parades.', 'В национальные праздники — 25 марта, 1 апреля и 1 октября — смотрим парады.'),
        ],
      },
      {
        id: 'q17-festivals', title: 'Какие фестивали вы знаете?',
        questions: Q(
          t('Ξέρετε κυπριακά φεστιβάλ;', 'Do you know any Cypriot festivals?', 'Вы знаете кипрские фестивали?'),
          t('Τα φεστιβάλ. Ποια ξέρετε;', 'Festivals. Which ones do you know?', 'Фестивали. Какие вы знаете?'),
        ),
        answer: () => [
          t('Ξέρω το Καρναβάλι της Λεμεσού, πριν από την Καθαρά Δευτέρα.', 'I know the Limassol Carnival, before Clean Monday.', 'Знаю Лимассольский карнавал — перед Чистым понедельником.'),
          t('Τη Γιορτή του Κρασιού στη Λεμεσό, στο τέλος του καλοκαιριού.', 'The Wine Festival in Limassol, at the end of summer.', 'Праздник вина в Лимассоле, в конце лета.'),
          t('Και τον Κατακλυσμό, τη γιορτή του νερού, στη Λάρνακα, πενήντα μέρες μετά το Πάσχα.', 'And Kataklysmos, the water festival, in Larnaca, fifty days after Easter.', 'И Катаклизмос — праздник воды в Ларнаке, через пятьдесят дней после Пасхи.'),
          t('Επίσης, το καλοκαίρι γίνονται πολλά πανηγύρια στα χωριά.', 'Also, in summer there are many village fairs.', 'Ещё летом в деревнях проходит много праздничных ярмарок (панигирья).'),
        ],
      },
    ],
  },
  {
    id: 't18', num: 18, title: 'Религия и церковь', emoji: '⛪',
    items: [
      {
        id: 'q18-religion', title: 'Какая у вас религия?', fields: ['religion'],
        questions: (c) => [
          t('Τι θρησκεία έχετε;', 'What is your religion?', 'Какая у вас религия?'),
          t(c.g('Είστε χριστιανός ορθόδοξος;', 'Είστε χριστιανή ορθόδοξη;'), 'Are you an Orthodox Christian?', c.g('Вы православный христианин?', 'Вы православная христианка?')),
        ],
        answer: (c) => {
          const r = c.pick(RELIGION, 'religion')
          return r ? [c.gt(r.t)] : [triAll(hole('Религия'))]
        },
      },
      {
        id: 'q18-church', title: 'Ходите в церковь? В какую?', fields: ['churchFreq', 'church'],
        questions: Q(
          t('Πηγαίνετε στην εκκλησία;', 'Do you go to church?', 'Вы ходите в церковь?'),
          t('Σε ποια εκκλησία πηγαίνετε;', 'Which church do you go to?', 'В какую церковь вы ходите?'),
        ),
        answer: (c) => {
          const f = c.pick(CHURCH_FREQ, 'churchFreq')
          const out = f ? [c.gt(f.t)] : [triAll(hole('Как часто'))]
          const ch = typeof c.p.church === 'string' ? c.p.church.trim() : ''
          if (ch && c.p.churchFreq !== 'never') out.push(t(`Συνήθως πηγαίνω στην εκκλησία ${ch}, κοντά στο σπίτι μου.`, `I usually go to the church ${ch}, near my home.`, `Обычно хожу в церковь ${ch}, рядом с домом.`))
          return out
        },
      },
    ],
  },
  {
    id: 't19', num: 19, title: 'Поручители', emoji: '✍️',
    items: [
      {
        id: 'q19-who', title: 'Кто подписал ваше заявление?', fields: ['ref1Name', 'ref1Gender', 'ref2Name', 'ref2Gender'],
        questions: Q(
          t('Ποιοι υπέγραψαν την αίτηση;', 'Who signed the application?', 'Кто подписал заявление?'),
          t('Ποιοι υπέγραψαν την αίτησή σας;', 'Who signed your application?', 'Кто подписал ваше заявление?'),
        ),
        answer: (c) => {
          const r1 = c.name('ref1Name', 'Поручитель 1'), r2 = c.name('ref2Name', 'Поручитель 2')
          const a1 = c.p.ref1Gender === 'f' ? 'η' : 'ο', a2 = c.p.ref2Gender === 'f' ? 'η' : 'ο'
          return [t(
            `Την αίτηση υπέγραψαν δύο Κύπριοι πολίτες: ${a1} ${r1.gr} και ${a2} ${r2.gr}.`,
            `The application was signed by two Cypriot citizens: ${r1.en} and ${r2.en}.`,
            `Заявление подписали два гражданина Кипра: ${r1.ru} и ${r2.ru}.`,
          )]
        },
      },
      {
        id: 'q19-about', title: 'Что вы знаете об этих людях?', fields: ['ref1Job', 'ref1Since', 'ref1Met', 'ref2Job', 'ref2Since', 'ref2Met'],
        questions: Q(t('Τι ξέρετε για αυτούς τους ανθρώπους;', 'What do you know about these people?', 'Что вы знаете об этих людях?')),
        answer: (c) => (['ref1', 'ref2'] as const).flatMap((r, i) => {
          const f = c.p[`${r}Gender`] === 'f'
          const n = c.name(`${r}Name`, `Поручитель ${i + 1}`)
          const first = t(n.gr.split(' ')[0], n.en.split(' ')[0], n.ru.split(' ')[0])
          const j = c.text(`${r}Job`, 'Профессия')
          const y = c.year(`${r}Since`, 'С какого года')
          const met = c.pick(MET_PLACES, `${r}Met`)
          const out = [
            t(`${f ? 'Η' : 'Ο'} ${first.gr} είναι ${j.gr}.`, `${first.en} is a ${j.en}.`, `${first.ru} — ${j.ru}.`),
            t(`${f ? 'Την' : 'Τον'} ξέρω από το ${y.gr}.`, `I have known ${f ? 'her' : 'him'} since ${y.en}.`, `Я ${f ? 'её' : 'его'} знаю с ${y.ru} года.`),
          ]
          if (met) out.push(met.value === 'neighbours'
            ? t('Είμαστε γείτονες.', 'We are neighbours.', 'Мы соседи.')
            : t(`Γνωριστήκαμε ${met.t.gr}.`, `We met ${met.t.en}.`, `Мы познакомились ${met.t.ru}.`))
          out.push(t(`Είναι ${f ? 'καλή μου φίλη' : 'καλός μου φίλος'}.`, `${f ? 'She' : 'He'} is a good friend of mine.`, `${f ? 'Она моя хорошая подруга' : 'Он мой хороший друг'}.`))
          return out
        }),
      },
    ],
  },
  {
    id: 't20', num: 20, title: 'Образование и профессия', emoji: '🎓',
    items: [
      {
        id: 'q20-study', title: 'Где вы учились?', fields: ['uni', 'uniCity', 'subject', 'gradYear'],
        questions: Q(
          t('Πού σπουδάσατε;', 'Where did you study?', 'Где вы учились?'),
          t('Σε ποιο πανεπιστήμιο σπουδάσατε;', 'Which university did you study at?', 'В каком университете вы учились?'),
        ),
        answer: (c) => {
          const s = c.text('subject', 'Специальность'), u = c.text('uni', 'Университет'), ci = c.city('uniCity', 'Город университета')
          const y = c.year('gradYear', 'Год окончания')
          return [
            t(`Σπούδασα ${s.gr} στο ${u.gr}, ${ci.in.gr}.`, `I studied ${s.en} at ${u.en}, ${ci.in.en}.`, `Я ${c.g('учился', 'училась')} на специальности «${s.ru}» в ${u.ru}, ${ci.in.ru}.`),
            t(`Τελείωσα το ${y.gr}.`, `I graduated in ${y.en}.`, `${c.g('Окончил', 'Окончила')} в ${y.ru} году.`),
          ]
        },
      },
      {
        id: 'q20-prof', title: 'Какая у вас профессия?', fields: ['profession', 'job'],
        questions: Q(t('Τι επάγγελμα έχετε;', 'What is your profession?', 'Какая у вас профессия?')),
        answer: (c) => {
          const p = c.text('profession', 'Профессия')
          const out = [t(`Το επάγγελμά μου είναι ${p.gr}.`, `By profession I am a ${p.en}.`, `По профессии я ${p.ru}.`)]
          if (isWorking(c)) {
            const j = jobTitle(c)
            if (j.gr !== p.gr) out.push(t(`Τώρα δουλεύω ως ${j.gr}.`, `Now I work as a ${j.en}.`, `Сейчас работаю: ${j.ru}.`))
          }
          return out
        },
      },
    ],
  },
  {
    id: 't21', num: 21, title: 'Хобби', emoji: '🎨',
    items: [
      {
        id: 'q21-hobby', title: 'Какое у вас хобби?', fields: ['hobbies'],
        questions: Q(
          t('Τι χόμπι έχετε;', 'What hobbies do you have?', 'Какое у вас хобби?'),
          t('Με τι ασχολείστε ως χόμπι;', 'What do you do as a hobby?', 'Чем вы занимаетесь как хобби?'),
        ),
        answer: (c) => {
          const hs = c.picks(HOBBIES, 'hobbies')
          if (!hs.length) return [triAll(hole('Хобби'))]
          const first = hs[0].t.noun
          const out = [t(`Το αγαπημένο μου χόμπι είναι ${first.gr}.`, `My favourite hobby is ${first.en}.`, `Моё любимое хобби — ${first.ru}.`)]
          const v = c.gt(hs[0].t.verb)
          out.push(t(`${cap(v.gr)} σχεδόν κάθε εβδομάδα.`, `${v.en} almost every week.`, `${cap(v.ru)} почти каждую неделю.`))
          const rest = hs.slice(1, 3).map((x) => x.t.noun)
          if (rest.length) {
            const j = joinTri(rest)
            const plural = rest.length > 1 || /^(?:τα|οι) /.test(rest[0].gr)
            out.push(t(`Μου ${plural ? 'αρέσουν' : 'αρέσει'} επίσης ${j.gr}.`, `I also like ${j.en}.`, `Ещё мне ${plural ? 'нравятся' : 'нравится'} ${j.ru}.`))
          }
          return out
        },
      },
    ],
  },
  {
    id: 't22', num: 22, title: 'Кипрский паспорт', emoji: '🛂',
    items: [
      {
        id: 'q22-why', title: 'Две причины, зачем вам паспорт', fields: ['passportReasons'],
        questions: Q(
          t('Πείτε μου δύο λόγους γιατί χρειάζεστε το κυπριακό διαβατήριο.', 'Tell me two reasons why you need the Cypriot passport.', 'Назовите две причины, зачем вам кипрский паспорт.'),
          t('Γιατί χρειάζεστε το κυπριακό διαβατήριο;', 'Why do you need the Cypriot passport?', 'Зачем вам кипрский паспорт?'),
        ),
        answer: (c) => {
          const rs = c.picks(PASSPORT_REASONS, 'passportReasons')
          if (!rs.length) return [triAll(hole('Причины'))]
          return rs.slice(0, 3).map((r, i) => {
            const o = ordinals[i]
            return t(`${o.gr}, ${r.t.gr}.`, `${o.en}, ${r.t.en}.`, `${o.ru}, ${r.t.ru}.`)
          })
        },
      },
      {
        id: 'q22-celebrate', title: 'Как отпразднуете получение паспорта?',
        questions: Q(t('Πώς θα γιορτάσετε όταν πάρετε το κυπριακό διαβατήριο;', 'How will you celebrate when you get the Cypriot passport?', 'Как вы отпразднуете получение кипрского паспорта?')),
        answer: (c) => [
          we(c,
            t('Θα κάνω ένα μεγάλο τραπέζι στο σπίτι με τους φίλους μου.', 'I will have a big dinner at home with my friends.', 'Я устрою большое застолье дома с друзьями.'),
            t('Θα κάνουμε ένα μεγάλο τραπέζι στο σπίτι με την οικογένεια και τους φίλους μας.', 'We will have a big dinner at home with our family and friends.', 'Мы устроим большое застолье дома с семьёй и друзьями.'),
          ),
          t('Θα καλέσω και τους Κύπριους φίλους μου και θα φάμε κυπριακό μεζέ!', 'I will also invite my Cypriot friends and we will eat Cypriot meze!', 'Позову и друзей-киприотов, и мы будем есть кипрское мезе!'),
        ],
      },
      {
        id: 'q22-change', title: 'Как изменится ваша жизнь с паспортом?',
        questions: Q(t('Πώς θα αλλάξει η ζωή σας με το κυπριακό διαβατήριο;', 'How will your life change with the Cypriot passport?', 'Как изменится ваша жизнь с кипрским паспортом?')),
        answer: (c) => [
          t(`Θα νιώθω πιο ${c.g('σίγουρος', 'σίγουρη')} για το μέλλον.`, 'I will feel more confident about the future.', 'Я буду увереннее в будущем.'),
          t('Θα νιώθω ότι ανήκω πραγματικά εδώ.', 'I will feel that I really belong here.', 'Я буду чувствовать, что по-настоящему принадлежу этому месту.'),
          t('Θα μπορώ να ψηφίζω και να ταξιδεύω πιο εύκολα.', 'I will be able to vote and travel more easily.', 'Смогу голосовать и легче путешествовать.'),
        ],
      },
    ],
  },
  {
    id: 't23', num: 23, title: 'Польза для Кипра', emoji: '🤝',
    items: [
      {
        id: 'q23-benefit', title: 'Чем вы будете полезны Кипру?', fields: ['benefits'],
        questions: (c) => [t(`Σε τι θα είστε ${c.g('ωφέλιμος', 'ωφέλιμη')} για την Κύπρο;`, 'How will you be useful to Cyprus?', `Чем вы будете ${c.g('полезен', 'полезна')} Кипру?`)],
        answer: (c) => [
          t(`Νομίζω ότι μπορώ να είμαι ${c.g('ωφέλιμος', 'ωφέλιμη')} για την Κύπρο.`, 'I think I can be useful to Cyprus.', `Думаю, я могу быть ${c.g('полезен', 'полезна')} Кипру.`),
          ...c.picks(BENEFITS, 'benefits').map((b) => c.gt(b.t)),
        ],
      },
    ],
  },
  {
    id: 't24', num: 24, title: 'Друзья-киприоты', emoji: '🫂',
    items: [
      {
        id: 'q24-friends', title: 'У вас есть друзья-киприоты?', fields: ['cyFriends'],
        questions: Q(t('Έχετε φίλους Κύπριους;', 'Do you have Cypriot friends?', 'У вас есть друзья-киприоты?')),
        answer: (c) => {
          const n = c.text('cyFriends', 'Имена друзей')
          return [
            t('Ναι, έχω αρκετούς Κύπριους φίλους.', 'Yes, I have quite a few Cypriot friends.', 'Да, у меня довольно много друзей-киприотов.'),
            t(`Οι πιο καλοί μου φίλοι είναι ${n.gr}.`, `My closest friends are ${n.en}.`, `Мои самые близкие друзья — ${n.ru}.`),
          ]
        },
      },
      {
        id: 'q24-met', title: 'Где вы познакомились?', fields: ['cyFriendsMet'],
        questions: Q(t('Πού γνωριστήκατε;', 'Where did you meet?', 'Где вы познакомились?')),
        answer: (c) => {
          const m = c.pick(MET_PLACES, 'cyFriendsMet')
          if (!m) return [triAll(hole('Где познакомились'))]
          return m.value === 'neighbours'
            ? [t('Είμαστε γείτονες, μένουμε στην ίδια γειτονιά.', 'We are neighbours, we live in the same neighbourhood.', 'Мы соседи, живём в одном районе.')]
            : [t(`Γνωριστήκαμε ${m.t.gr}.`, `We met ${m.t.en}.`, `Мы познакомились ${m.t.ru}.`)]
        },
      },
    ],
  },
  {
    id: 't25', num: 25, title: 'Распорядок дня', emoji: '⏰',
    items: [
      {
        id: 'q25-daily', title: 'Что вы делаете каждый день?', fields: ['wakeTime', 'workStart', 'workEnd', 'sleepTime', 'workMode', 'hobbies'],
        questions: Q(
          t('Τι κάνετε κάθε μέρα;', 'What do you do every day?', 'Что вы делаете каждый день?'),
          t('Πείτε μου για την καθημερινή σας ρουτίνα.', 'Tell me about your daily routine.', 'Расскажите о своём распорядке дня.'),
          t('Καθημερινή ζωή. Πώς είναι μια μέρα σας;', 'Daily life. What is your typical day like?', 'Повседневная жизнь. Как проходит ваш день?'),
        ),
        answer: (c) => {
          const wake = atTime(c.p.wakeTime, 'Подъём'), ws = atTime(c.p.workStart, 'Начало работы')
          const we_ = atTime(c.p.workEnd, 'Конец работы'), sl = atTime(c.p.sleepTime, 'Отбой')
          const out = [
            t(`Ξυπνάω ${wake.gr}.`, `I wake up ${wake.en}.`, `Я встаю ${wake.ru}.`),
            t('Πλένομαι, ντύνομαι και πίνω καφέ.', 'I wash, get dressed and drink coffee.', 'Умываюсь, одеваюсь и пью кофе.'),
          ]
          const schoolKids = kids(c).some((k) => ['nursery', 'kinder', 'primary', 'gymnasio', 'lyceum'].includes(k.school ?? ''))
          if (schoolKids) out.push(t('Μετά πηγαίνω τα παιδιά στο σχολείο.', 'Then I take the children to school.', 'Потом отвожу детей в школу.'))
          if (isWorking(c)) {
            const home = c.p.workStatus === 'remote' || c.p.workMode === 'remote'
            out.push(t(
              `${cap(ws.gr)} αρχίζω δουλειά ${home ? 'από το σπίτι' : 'στο γραφείο'}.`,
              `${cap(ws.en)} I start work ${home ? 'from home' : 'at the office'}.`,
              `${cap(ws.ru)} начинаю работать ${home ? 'из дома' : 'в офисе'}.`,
            ))
            out.push(t(`Τελειώνω ${we_.gr}.`, `I finish ${we_.en}.`, `Заканчиваю ${we_.ru}.`))
          } else {
            out.push(t('Το πρωί κάνω τις δουλειές του σπιτιού και ψωνίζω.', 'In the morning I do the housework and go shopping.', 'Утром делаю дела по дому и хожу в магазин.'))
          }
          const h = c.picks(HOBBIES, 'hobbies')[0]
          if (h) {
            const v = c.gt(h.t.verb)
            out.push(t(`Το απόγευμα ${v.gr}.`, `In the afternoon ${v.en}.`, `После обеда ${v.ru}.`))
          }
          out.push(we(c,
            t('Το βράδυ μαγειρεύω, διαβάζω λίγο ή βλέπω μια ταινία.', 'In the evening I cook, read a little or watch a film.', 'Вечером готовлю, немного читаю или смотрю фильм.'),
            t('Το βράδυ τρώμε όλοι μαζί και μιλάμε για τη μέρα μας.', 'In the evening we all eat together and talk about our day.', 'Вечером мы все вместе ужинаем и рассказываем, как прошёл день.'),
          ))
          out.push(t(`Κοιμάμαι ${sl.gr}.`, `I go to bed ${sl.en}.`, `Ложусь спать ${sl.ru}.`))
          return out
        },
      },
    ],
  },
  {
    id: 't26', num: 26, title: 'Полиция', emoji: '👮',
    items: [
      {
        id: 'q26-police', title: 'Были проблемы с полицией?',
        questions: Q(
          t('Είχατε ποτέ συγκρούσεις ή προβλήματα με την αστυνομία;', 'Have you ever had conflicts or problems with the police?', 'У вас когда-нибудь были конфликты или проблемы с полицией?'),
          t('Είχατε ποτέ προβλήματα με την αστυνομία;', 'Have you ever had problems with the police?', 'У вас были проблемы с полицией?'),
        ),
        answer: (c) => {
          const co = c.country('country', 'Страна')
          return [
            t('Όχι, ποτέ.', 'No, never.', 'Нет, никогда.'),
            t(`Δεν είχα ποτέ κανένα πρόβλημα με την αστυνομία, ούτε στην Κύπρο ούτε ${co.in.gr}.`, `I have never had any problem with the police, neither in Cyprus nor ${co.in.en}.`, `У меня никогда не было проблем с полицией — ни на Кипре, ни ${co.in.ru}.`),
            t('Έχω καθαρό ποινικό μητρώο.', 'I have a clean criminal record.', 'У меня чистая справка о несудимости.'),
          ]
        },
      },
    ],
  },
  {
    id: 't27', num: 27, title: 'Останетесь на Кипре?', emoji: '🏝️',
    items: [
      {
        id: 'q27-stay', title: 'Останетесь на Кипре после паспорта?',
        questions: Q(
          t('Θα μείνετε στην Κύπρο όταν πάρετε το κυπριακό διαβατήριο;', 'Will you stay in Cyprus when you get the Cypriot passport?', 'Вы останетесь на Кипре, когда получите паспорт?'),
          t('Έχετε πρόθεση να μείνετε στην Κύπρο;', 'Do you intend to stay in Cyprus?', 'Вы намерены остаться на Кипре?'),
        ),
        answer: (c) => [
          t('Ναι, φυσικά! Η Κύπρος είναι το σπίτι μου.', 'Yes, of course! Cyprus is my home.', 'Да, конечно! Кипр — мой дом.'),
          we(c,
            t('Εδώ είναι η δουλειά μου και οι φίλοι μου.', 'My work and my friends are here.', 'Здесь моя работа и мои друзья.'),
            t('Εδώ είναι η οικογένειά μου, η δουλειά μου και οι φίλοι μου.', 'My family, my work and my friends are here.', 'Здесь моя семья, моя работа и мои друзья.'),
          ),
          t('Θέλω να μείνω εδώ για πάντα.', 'I want to stay here forever.', 'Я хочу остаться здесь навсегда.'),
        ],
      },
    ],
  },
  {
    id: 't28', num: 28, title: 'Дополнительные вопросы', emoji: '➕',
    items: [
      {
        id: 'x-how', title: 'Как дела? (начало беседы)',
        questions: Q(
          t('Τι κάνετε;', 'How are you?', 'Как дела?'),
          t('Πώς είστε;', 'How are you?', 'Как вы?'),
        ),
        answer: (c) => [t(
          `Καλά, ευχαριστώ. Λίγο ${c.g('αγχωμένος', 'αγχωμένη')}, αλλά καλά. Εσείς;`,
          'Fine, thank you. A little nervous, but fine. And you?',
          `Хорошо, спасибо. Немного ${c.g('волнуюсь', 'волнуюсь')}, но хорошо. А вы?`,
        )],
      },
      {
        id: 'x-capital', title: 'Столица Кипра?',
        questions: Q(t('Ποια είναι η πρωτεύουσα της Κύπρου;', 'What is the capital of Cyprus?', 'Какая столица Кипра?')),
        answer: () => [t('Η πρωτεύουσα της Κύπρου είναι η Λευκωσία.', 'The capital of Cyprus is Nicosia.', 'Столица Кипра — Никосия.')],
      },
      {
        id: 'x-districts', title: 'Сколько районов на Кипре?',
        questions: Q(t('Πόσες επαρχίες έχει η Κύπρος;', 'How many districts does Cyprus have?', 'Сколько районов на Кипре?')),
        answer: () => [t(
          'Η Κύπρος έχει έξι επαρχίες: Λευκωσία, Λεμεσό, Λάρνακα, Πάφο, Αμμόχωστο και Κερύνεια.',
          'Cyprus has six districts: Nicosia, Limassol, Larnaca, Paphos, Famagusta and Kyrenia.',
          'На Кипре шесть районов: Никосия, Лимассол, Ларнака, Пафос, Фамагуста и Кирения.',
        )],
      },
      {
        id: 'x-president', title: 'Кто президент Кипра?',
        questions: Q(t('Ποιος είναι ο Πρόεδρος της Κύπρου;', 'Who is the President of Cyprus?', 'Кто президент Кипра?')),
        answer: () => [t('Ο Πρόεδρος της Κυπριακής Δημοκρατίας είναι ο Νίκος Χριστοδουλίδης.', 'The President of the Republic of Cyprus is Nikos Christodoulides.', 'Президент Республики Кипр — Никос Христодулидис.')],
      },
      {
        id: 'x-independence', title: 'Когда День независимости?',
        questions: Q(t('Πότε γιορτάζει η Κύπρος την ανεξαρτησία της;', 'When does Cyprus celebrate its independence?', 'Когда Кипр празднует независимость?')),
        answer: () => [
          t('Την 1η Οκτωβρίου.', 'On the 1st of October.', '1 октября.'),
          t('Η Κύπρος έγινε ανεξάρτητη το 1960.', 'Cyprus became independent in 1960.', 'Кипр стал независимым в 1960 году.'),
        ],
      },
      {
        id: 'x-flag', title: 'Как выглядит флаг Кипра?',
        questions: Q(t('Πώς είναι η σημαία της Κύπρου;', 'What does the flag of Cyprus look like?', 'Как выглядит флаг Кипра?')),
        answer: () => [
          t('Η σημαία είναι λευκή.', 'The flag is white.', 'Флаг белый.'),
          t('Στη μέση έχει τον χάρτη της Κύπρου σε χρώμα χαλκού και από κάτω δύο πράσινα κλαδιά ελιάς.', 'In the middle there is the map of Cyprus in copper colour and below it two green olive branches.', 'В центре — карта Кипра медного цвета, а под ней две зелёные оливковые ветви.'),
        ],
      },
      {
        id: 'x-eu', title: 'Когда Кипр вступил в ЕС?',
        questions: Q(t('Πότε μπήκε η Κύπρος στην Ευρωπαϊκή Ένωση;', 'When did Cyprus join the European Union?', 'Когда Кипр вступил в Евросоюз?')),
        answer: () => [t('Το 2004. Και το 2008 η Κύπρος πήρε το ευρώ.', 'In 2004. And in 2008 Cyprus adopted the euro.', 'В 2004 году. А в 2008 году Кипр перешёл на евро.')],
      },
      {
        id: 'x-mountain', title: 'Самая высокая гора Кипра?',
        questions: Q(t('Ποιο είναι το ψηλότερο βουνό της Κύπρου;', 'What is the highest mountain in Cyprus?', 'Какая самая высокая гора Кипра?')),
        answer: () => [t('Ο Όλυμπος, στο Τρόοδος. Έχει ύψος 1.952 μέτρα.', 'Mount Olympus, in Troodos. It is 1,952 metres high.', 'Олимп в Троодосе. Его высота — 1952 метра.')],
      },
      {
        id: 'x-places', title: 'Где на Кипре вы были?',
        questions: Q(t('Ποια μέρη της Κύπρου έχετε επισκεφτεί;', 'Which places in Cyprus have you visited?', 'Какие места Кипра вы посетили?')),
        answer: () => [
          t('Έχω επισκεφτεί την Πάφο, τη Λάρνακα, την Αγία Νάπα και το Τρόοδος.', 'I have visited Paphos, Larnaca, Ayia Napa and Troodos.', 'Я был(а) в Пафосе, Ларнаке, Айя-Напе и Троодосе.'),
          t('Μου άρεσαν πολύ η Πέτρα του Ρωμιού και το μοναστήρι του Κύκκου.', 'I really liked Aphrodite\'s Rock and Kykkos Monastery.', 'Мне очень понравились Скала Афродиты и монастырь Киккос.'),
        ],
      },
      {
        id: 'x-weekend', title: 'Что вы делали в прошлые выходные?',
        questions: Q(t('Τι κάνατε το περασμένο Σαββατοκύριακο;', 'What did you do last weekend?', 'Что вы делали в прошлые выходные?')),
        answer: (c) => [
          we(c,
            t('Το Σάββατο πήγα στη θάλασσα και κολύμπησα.', 'On Saturday I went to the sea and swam.', 'В субботу я ездил(а) на море и плавал(а).'),
            t('Το Σάββατο πήγαμε με την οικογένεια στη θάλασσα.', 'On Saturday we went to the sea with the family.', 'В субботу мы с семьёй ездили на море.'),
          ),
          t('Την Κυριακή μαγείρεψα, ξεκουράστηκα και είδα μια ταινία.', 'On Sunday I cooked, rested and watched a film.', 'В воскресенье я готовил(а), отдыхал(а) и посмотрел(а) фильм.'),
        ],
      },
      {
        id: 'x-future', title: 'Какие у вас планы на будущее?',
        questions: Q(t('Τι σχέδια έχετε για το μέλλον;', 'What plans do you have for the future?', 'Какие у вас планы на будущее?')),
        answer: (c) => [
          t('Θέλω να συνεχίσω να δουλεύω εδώ και να μάθω καλύτερα ελληνικά.', 'I want to keep working here and learn Greek better.', 'Хочу продолжать работать здесь и лучше выучить греческий.'),
          hasKids(c)
            ? t('Θέλω τα παιδιά μου να μεγαλώσουν στην Κύπρο.', 'I want my children to grow up in Cyprus.', 'Хочу, чтобы мои дети выросли на Кипре.')
            : t('Θέλω να ζήσω όλη μου τη ζωή στην Κύπρο.', 'I want to live my whole life in Cyprus.', 'Хочу прожить всю жизнь на Кипре.'),
        ],
      },
    ],
  },
]

/* ------------------------------------------------ служебное */

export const ALL_ITEMS: QItem[] = TOPICS.flatMap((tp) => tp.items)
export const ITEM_BY_ID: Record<string, QItem> = Object.fromEntries(ALL_ITEMS.map((i) => [i.id, i]))
export const TOPIC_OF_ITEM: Record<string, Topic> = Object.fromEntries(TOPICS.flatMap((tp) => tp.items.map((i) => [i.id, tp])))
