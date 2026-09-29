import type { Gender } from '../types'
import { CITIES, COUNTRIES, type KnownPlace, type PlaceValue } from '../lib/grammar'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Profile = Record<string, any>

export interface NameValue {
  gr?: string
  en?: string
}

export interface Child {
  id: string
  name?: NameValue
  gender?: Gender
  birthDate?: string
  birthPlace?: PlaceValue
  school?: string
  schoolName?: string
}

/* ------------------------------------------------ варианты с греческими формами */

/** Фраза, зависящая от рода говорящего. */
export interface GTri {
  gr: string
  grF?: string
  en: string
  ru: string
}

export interface Choice<T = GTri> {
  value: string
  label: string
  t: T
}

const c = <T,>(value: string, label: string, t: T): Choice<T> => ({ value, label, t })
const g = (gr: string, en: string, ru: string, grF?: string): GTri => ({ gr, grF, en, ru })

export const MOVE_REASONS: Choice[] = [
  c('work', 'Работа / релокация', g('Μετακόμισα στην Κύπρο για δουλειά. Η εταιρεία μου έχει γραφείο εδώ.', 'I moved to Cyprus for work. My company has an office here.', 'Я переехал(а) на Кипр из-за работы. У моей компании здесь офис.')),
  c('family', 'Вместе с семьёй', g('Ήρθαμε με την οικογένειά μου, για να ζήσουμε σε ένα ήρεμο μέρος.', 'We came as a family, to live in a calm place.', 'Мы приехали всей семьёй, чтобы жить в спокойном месте.')),
  c('safety', 'Безопасность', g('Η Κύπρος είναι ασφαλής χώρα, ιδανική για οικογένεια με παιδιά.', 'Cyprus is a safe country, ideal for a family with children.', 'Кипр — безопасная страна, идеальная для семьи с детьми.')),
  c('climate', 'Климат и море', g('Μου αρέσει πολύ το κλίμα, ο ήλιος και η θάλασσα.', 'I really like the climate, the sun and the sea.', 'Мне очень нравится климат, солнце и море.')),
  c('business', 'Свой бизнес', g('Άνοιξα τη δική μου εταιρεία εδώ.', 'I opened my own company here.', 'Я открыл(а) здесь свою компанию.')),
  c('love', 'Влюбился(-лась) в Кипр', g('Ήρθα πρώτα για διακοπές και ερωτεύτηκα την Κύπρο.', 'I first came on holiday and fell in love with Cyprus.', 'Сначала я приехал(а) в отпуск и влюбился(-лась) в Кипр.')),
  c('spouse', 'Супруг(а) работает здесь', g('Ο άντρας μου βρήκε δουλειά εδώ και ήρθαμε μαζί.', 'My husband found a job here and we came together.', 'Мой муж нашёл здесь работу, и мы приехали вместе.', 'Ο άντρας μου βρήκε δουλειά εδώ και ήρθαμε μαζί.')),
]

export const WORK_STATUS: Choice<null>[] = [
  c('employee', 'Работаю в компании на Кипре', null),
  c('remote', 'Удалённо на иностранную компанию', null),
  c('own', 'Свой бизнес', null),
  c('none', 'Не работаю', null),
]

export const JOBS: Choice[] = [
  c('dev', 'Программист', g('προγραμματιστής', 'software developer', 'программист', 'προγραμματίστρια')),
  c('eng', 'Инженер', g('μηχανικός', 'engineer', 'инженер', 'μηχανικός')),
  c('qa', 'Тестировщик', g('ελεγκτής λογισμικού', 'QA engineer', 'тестировщик', 'ελέγκτρια λογισμικού')),
  c('pm', 'Менеджер проектов', g('διευθυντής έργων', 'project manager', 'менеджер проектов', 'διευθύντρια έργων')),
  c('manager', 'Руководитель / менеджер', g('διευθυντής', 'manager', 'руководитель', 'διευθύντρια')),
  c('design', 'Дизайнер', g('σχεδιαστής', 'designer', 'дизайнер', 'σχεδιάστρια')),
  c('analyst', 'Аналитик', g('αναλυτής', 'analyst', 'аналитик', 'αναλύτρια')),
  c('marketing', 'Маркетолог', g('υπεύθυνος μάρκετινγκ', 'marketing specialist', 'маркетолог', 'υπεύθυνη μάρκετινγκ')),
  c('sales', 'Продажи', g('πωλητής', 'salesperson', 'менеджер по продажам', 'πωλήτρια')),
  c('accountant', 'Бухгалтер', g('λογιστής', 'accountant', 'бухгалтер', 'λογίστρια')),
  c('lawyer', 'Юрист', g('δικηγόρος', 'lawyer', 'юрист', 'δικηγόρος')),
  c('doctor', 'Врач', g('γιατρός', 'doctor', 'врач', 'γιατρός')),
  c('teacher', 'Учитель', g('δάσκαλος', 'teacher', 'учитель', 'δασκάλα')),
  c('hr', 'HR', g('υπεύθυνος προσωπικού', 'HR specialist', 'HR-специалист', 'υπεύθυνη προσωπικού')),
  c('owner', 'Владелец бизнеса', g('επιχειρηματίας', 'business owner', 'предприниматель', 'επιχειρηματίας')),
]

export const JOB_DUTIES: Choice[] = [
  c('code', 'Пишу код / приложения', g('Γράφω κώδικα και φτιάχνω εφαρμογές.', 'I write code and build applications.', 'Пишу код и делаю приложения.')),
  c('team', 'Руковожу командой', g('Είμαι υπεύθυνος για μια ομάδα και οργανώνω τη δουλειά της.', 'I am responsible for a team and organise its work.', 'Я отвечаю за команду и организую её работу.', 'Είμαι υπεύθυνη για μια ομάδα και οργανώνω τη δουλειά της.')),
  c('clients', 'Работаю с клиентами', g('Μιλάω με πελάτες και λύνω τα προβλήματά τους.', 'I talk to clients and solve their problems.', 'Общаюсь с клиентами и решаю их проблемы.')),
  c('design', 'Делаю дизайн', g('Σχεδιάζω ιστοσελίδες και εφαρμογές.', 'I design websites and applications.', 'Проектирую сайты и приложения.')),
  c('test', 'Тестирую', g('Ελέγχω τις εφαρμογές και βρίσκω λάθη.', 'I test applications and find bugs.', 'Проверяю приложения и нахожу ошибки.')),
  c('finance', 'Финансы и отчёты', g('Ετοιμάζω οικονομικές αναφορές και ελέγχω τα έξοδα.', 'I prepare financial reports and check expenses.', 'Готовлю финансовые отчёты и проверяю расходы.')),
  c('meetings', 'Много встреч и планирования', g('Έχω πολλές συναντήσεις και κάνω τον προγραμματισμό.', 'I have many meetings and do the planning.', 'У меня много встреч, и я занимаюсь планированием.')),
  c('computer', 'Работаю за компьютером', g('Δουλεύω κυρίως στον υπολογιστή.', 'I mostly work on the computer.', 'В основном работаю за компьютером.')),
]

export const INVESTMENTS: Choice<null>[] = [
  c('none', 'Нет', null),
  c('stocks', 'Акции / фонды', null),
  c('deposit', 'Депозит в банке', null),
  c('realty', 'Недвижимость', null),
]

export const MARITAL: Choice<null>[] = [
  c('married', 'Женат / замужем', null),
  c('single', 'Не женат / не замужем', null),
  c('divorced', 'В разводе', null),
  c('partner', 'Гражданский брак', null),
  c('widowed', 'Вдовец / вдова', null),
]

export const SCHOOLS: Choice[] = [
  c('home', 'Ещё маленький, дома', g('είναι ακόμα μικρό και μένει στο σπίτι', 'is still small and stays at home', 'ещё маленький и сидит дома')),
  c('nursery', 'Ясли / детский сад', g('πηγαίνει στον παιδικό σταθμό', 'goes to nursery', 'ходит в ясли')),
  c('kinder', 'Νηπιαγωγείο (подготовка)', g('πηγαίνει στο νηπιαγωγείο', 'goes to kindergarten', 'ходит в подготовительную группу')),
  c('primary', 'Начальная школа (Δημοτικό)', g('πηγαίνει στο δημοτικό', 'goes to primary school', 'ходит в начальную школу')),
  c('gymnasio', 'Средняя школа (Γυμνάσιο)', g('πηγαίνει στο γυμνάσιο', 'goes to secondary school', 'учится в средней школе')),
  c('lyceum', 'Старшая школа (Λύκειο)', g('πηγαίνει στο λύκειο', 'goes to high school', 'учится в старшей школе')),
  c('uni', 'Университет', g('σπουδάζει στο πανεπιστήμιο', 'studies at university', 'учится в университете')),
  c('adult', 'Взрослый, работает', g('είναι μεγάλος και δουλεύει', 'is grown up and works', 'взрослый и работает', 'είναι μεγάλη και δουλεύει')),
]

export const PARENT_STATUS: Choice<null>[] = [
  c('works', 'Работает', null),
  c('retired', 'На пенсии', null),
  c('deceased', 'Умер(ла)', null),
]

export const LANGUAGES: Choice[] = [
  c('ru', 'Русский', g('ρωσικά', 'Russian', 'русский')),
  c('uk', 'Украинский', g('ουκρανικά', 'Ukrainian', 'украинский')),
  c('en', 'Английский', g('αγγλικά', 'English', 'английский')),
  c('de', 'Немецкий', g('γερμανικά', 'German', 'немецкий')),
  c('fr', 'Французский', g('γαλλικά', 'French', 'французский')),
  c('es', 'Испанский', g('ισπανικά', 'Spanish', 'испанский')),
  c('he', 'Иврит', g('εβραϊκά', 'Hebrew', 'иврит')),
  c('ka', 'Грузинский', g('γεωργιανά', 'Georgian', 'грузинский')),
  c('hy', 'Армянский', g('αρμενικά', 'Armenian', 'армянский')),
  c('kk', 'Казахский', g('καζακικά', 'Kazakh', 'казахский')),
]

export const GREEK_WHERE: Choice[] = [
  c('teacher', 'С репетитором', g('Κάνω μαθήματα με δασκάλα δύο φορές την εβδομάδα.', 'I have lessons with a teacher twice a week.', 'Занимаюсь с преподавателем два раза в неделю.')),
  c('school', 'Языковые курсы', g('Πηγαίνω σε σχολή ξένων γλωσσών.', 'I go to a language school.', 'Хожу на языковые курсы.')),
  c('state', 'Государственные курсы', g('Κάνω μαθήματα στα κρατικά Επιμορφωτικά Κέντρα.', 'I take classes at the state Adult Education Centres.', 'Занимаюсь на государственных курсах для взрослых.')),
  c('online', 'Онлайн', g('Κάνω μαθήματα online και μαθαίνω με εφαρμογές.', 'I take online lessons and learn with apps.', 'Занимаюсь онлайн и учу с приложениями.')),
  c('self', 'Сам(а)', g('Μαθαίνω μόνος μου, με βιβλία και εφαρμογές.', 'I learn by myself with books and apps.', 'Учу сам(а) по книгам и приложениям.', 'Μαθαίνω μόνη μου, με βιβλία και εφαρμογές.')),
]

export interface Hobby {
  /** Глагольная фраза, 1 л. ед. ч.: «κολυμπάω» */
  verb: GTri
  /** Существительное с артиклем: «το κολύμπι» */
  noun: GTri
}
const h = (verb: GTri, noun: GTri): Hobby => ({ verb, noun })

export const HOBBIES: Choice<Hobby>[] = [
  c('swim', 'Плавание', h(g('κολυμπάω', 'I swim', 'плаваю'), g('το κολύμπι', 'swimming', 'плавание'))),
  c('gym', 'Спортзал', h(g('πηγαίνω στο γυμναστήριο', 'I go to the gym', 'хожу в спортзал'), g('η γυμναστική', 'working out', 'фитнес'))),
  c('yoga', 'Йога', h(g('κάνω γιόγκα', 'I do yoga', 'занимаюсь йогой'), g('η γιόγκα', 'yoga', 'йога'))),
  c('run', 'Бег', h(g('τρέχω δίπλα στη θάλασσα', 'I run by the sea', 'бегаю вдоль моря'), g('το τρέξιμο', 'running', 'бег'))),
  c('hike', 'Походы в горы', h(g('κάνω πεζοπορία στο Τρόοδος', 'I go hiking in Troodos', 'хожу в походы в Троодосе'), g('η πεζοπορία', 'hiking', 'пешие походы'))),
  c('bike', 'Велосипед', h(g('κάνω ποδήλατο', 'I cycle', 'катаюсь на велосипеде'), g('η ποδηλασία', 'cycling', 'велоспорт'))),
  c('tennis', 'Теннис', h(g('παίζω τένις', 'I play tennis', 'играю в теннис'), g('το τένις', 'tennis', 'теннис'))),
  c('padel', 'Падел', h(g('παίζω πάντελ', 'I play padel', 'играю в падел'), g('το πάντελ', 'padel', 'падел'))),
  c('football', 'Футбол', h(g('παίζω ποδόσφαιρο', 'I play football', 'играю в футбол'), g('το ποδόσφαιρο', 'football', 'футбол'))),
  c('dive', 'Дайвинг', h(g('κάνω καταδύσεις', 'I go diving', 'занимаюсь дайвингом'), g('οι καταδύσεις', 'diving', 'дайвинг'))),
  c('read', 'Чтение', h(g('διαβάζω βιβλία', 'I read books', 'читаю книги'), g('το διάβασμα', 'reading', 'чтение'))),
  c('cook', 'Готовка', h(g('μαγειρεύω', 'I cook', 'готовлю'), g('η μαγειρική', 'cooking', 'кулинария'))),
  c('travel', 'Путешествия по Кипру', h(g('ταξιδεύω σε όλη την Κύπρο', 'I travel all over Cyprus', 'путешествую по всему Кипру'), g('τα ταξίδια', 'travelling', 'путешествия'))),
  c('photo', 'Фотография', h(g('βγάζω φωτογραφίες', 'I take photos', 'фотографирую'), g('η φωτογραφία', 'photography', 'фотография'))),
  c('fish', 'Рыбалка', h(g('ψαρεύω', 'I go fishing', 'рыбачу'), g('το ψάρεμα', 'fishing', 'рыбалка'))),
  c('paint', 'Рисование', h(g('ζωγραφίζω', 'I paint', 'рисую'), g('η ζωγραφική', 'painting', 'живопись'))),
  c('dance', 'Танцы', h(g('χορεύω', 'I dance', 'танцую'), g('ο χορός', 'dancing', 'танцы'))),
  c('music', 'Музыка (гитара)', h(g('παίζω κιθάρα', 'I play the guitar', 'играю на гитаре'), g('η μουσική', 'music', 'музыка'))),
  c('garden', 'Сад', h(g('ασχολούμαι με τον κήπο', 'I do gardening', 'занимаюсь садом'), g('η κηπουρική', 'gardening', 'садоводство'))),
  c('chess', 'Шахматы', h(g('παίζω σκάκι', 'I play chess', 'играю в шахматы'), g('το σκάκι', 'chess', 'шахматы'))),
  c('movies', 'Кино', h(g('βλέπω ταινίες', 'I watch films', 'смотрю фильмы'), g('ο κινηματογράφος', 'cinema', 'кино'))),
  c('dog', 'Прогулки с собакой', h(g('βγάζω βόλτα τον σκύλο μου', 'I walk my dog', 'гуляю с собакой'), g('οι βόλτες με τον σκύλο', 'walks with the dog', 'прогулки с собакой'))),
  c('volunteer', 'Волонтёрство', h(g('κάνω εθελοντισμό', 'I volunteer', 'занимаюсь волонтёрством'), g('ο εθελοντισμός', 'volunteering', 'волонтёрство'))),
]

export interface Food {
  /** С артиклем, для «Το αγαπημένο μου φαγητό είναι …» */
  nom: GTri
  /** Без артикля, для «Τρώω συχνά …» */
  acc: string
}
export const FOODS: Choice<Food>[] = [
  c('halloumi', 'Халлуми', { nom: g('το χαλλούμι', 'halloumi', 'халлуми'), acc: 'χαλλούμι' }),
  c('souvlaki', 'Сувлаки', { nom: g('το σουβλάκι', 'souvlaki', 'сувлаки'), acc: 'σουβλάκια' }),
  c('sheftalia', 'Шефталья', { nom: g('η σεφταλιά', 'sheftalia', 'шефталья'), acc: 'σεφταλιές' }),
  c('kleftiko', 'Клефтико', { nom: g('το κλέφτικο', 'kleftiko', 'клефтико'), acc: 'κλέφτικο' }),
  c('moussaka', 'Мусака', { nom: g('ο μουσακάς', 'moussaka', 'мусака'), acc: 'μουσακά' }),
  c('koupepia', 'Купепья (долма)', { nom: g('τα κουπέπια', 'koupepia', 'купепья (долма)'), acc: 'κουπέπια' }),
  c('meze', 'Мезе', { nom: g('ο κυπριακός μεζές', 'Cypriot meze', 'кипрское мезе'), acc: 'μεζέ' }),
  c('afelia', 'Афелия', { nom: g('η αφέλια', 'afelia', 'афелия'), acc: 'αφέλια' }),
  c('stifado', 'Стифадо', { nom: g('το στιφάδο', 'stifado', 'стифадо'), acc: 'στιφάδο' }),
  c('makaronia', 'Макаронья ту фурну', { nom: g('τα μακαρόνια του φούρνου', 'baked pasta', 'макароны из духовки'), acc: 'μακαρόνια του φούρνου' }),
  c('salad', 'Деревенский салат', { nom: g('η χωριάτικη σαλάτα', 'village salad', 'деревенский салат'), acc: 'χωριάτικη σαλάτα' }),
  c('fish', 'Рыба', { nom: g('το φρέσκο ψάρι', 'fresh fish', 'свежая рыба'), acc: 'φρέσκο ψάρι' }),
  c('loukoumades', 'Лукумадес', { nom: g('οι λουκουμάδες', 'loukoumades', 'лукумадес'), acc: 'λουκουμάδες' }),
  c('flaouna', 'Флаунес', { nom: g('οι φλαούνες', 'flaounes', 'флаунес'), acc: 'φλαούνες' }),
  c('kolokasi', 'Колокаси', { nom: g('το κολοκάσι', 'kolokasi', 'колокаси'), acc: 'κολοκάσι' }),
]

export const RELIGION: Choice[] = [
  c('orthodox', 'Православный(-ая)', g('Είμαι χριστιανός ορθόδοξος.', 'I am an Orthodox Christian.', 'Я православный(-ая) христианин(-ка).', 'Είμαι χριστιανή ορθόδοξη.')),
  c('christian', 'Христианин (другая конфессия)', g('Είμαι χριστιανός.', 'I am a Christian.', 'Я христианин(-ка).', 'Είμαι χριστιανή.')),
  c('jewish', 'Иудаизм', g('Είμαι Εβραίος.', 'I am Jewish.', 'Я иудей(-ка).', 'Είμαι Εβραία.')),
  c('muslim', 'Ислам', g('Είμαι μουσουλμάνος.', 'I am Muslim.', 'Я мусульманин(-ка).', 'Είμαι μουσουλμάνα.')),
  c('none', 'Не религиозен(-на)', g('Δεν είμαι πολύ θρησκευόμενος, αλλά σέβομαι όλες τις θρησκείες.', 'I am not very religious, but I respect all religions.', 'Я не очень религиозен(-зна), но уважаю все религии.', 'Δεν είμαι πολύ θρησκευόμενη, αλλά σέβομαι όλες τις θρησκείες.')),
]

export const CHURCH_FREQ: Choice[] = [
  c('sunday', 'Каждое воскресенье', g('Ναι, πηγαίνω στην εκκλησία κάθε Κυριακή.', 'Yes, I go to church every Sunday.', 'Да, хожу в церковь каждое воскресенье.')),
  c('often', 'Иногда', g('Ναι, πηγαίνω στην εκκλησία μερικές φορές τον μήνα.', 'Yes, I go to church a few times a month.', 'Да, хожу в церковь несколько раз в месяц.')),
  c('holidays', 'По большим праздникам', g('Πηγαίνω στην εκκλησία στις μεγάλες γιορτές, τα Χριστούγεννα και το Πάσχα.', 'I go to church on the big holidays, Christmas and Easter.', 'Хожу в церковь по большим праздникам — на Рождество и Пасху.')),
  c('never', 'Не хожу', g('Όχι, δεν πηγαίνω συχνά στην εκκλησία.', 'No, I don\'t often go to church.', 'Нет, я нечасто хожу в церковь.')),
]

export const LIKE_CY: Choice[] = [
  c('climate', 'Климат', g('Μου αρέσει το κλίμα. Έχει ήλιο σχεδόν όλο τον χρόνο.', 'I like the climate. It is sunny almost all year.', 'Мне нравится климат. Солнце почти весь год.')),
  c('sea', 'Море', g('Λατρεύω τη θάλασσα και τις παραλίες.', 'I love the sea and the beaches.', 'Обожаю море и пляжи.')),
  c('people', 'Люди', g('Οι Κύπριοι είναι φιλικοί και φιλόξενοι άνθρωποι.', 'Cypriots are friendly and hospitable people.', 'Киприоты — дружелюбные и гостеприимные люди.')),
  c('safety', 'Безопасность', g('Η Κύπρος είναι ασφαλής χώρα.', 'Cyprus is a safe country.', 'Кипр — безопасная страна.')),
  c('nature', 'Природа', g('Η φύση είναι πανέμορφη, και η θάλασσα και τα βουνά.', 'The nature is beautiful, both the sea and the mountains.', 'Природа прекрасная — и море, и горы.')),
  c('food', 'Кухня', g('Μου αρέσει πολύ η κυπριακή κουζίνα.', 'I really like Cypriot cuisine.', 'Мне очень нравится кипрская кухня.')),
  c('calm', 'Спокойная жизнь', g('Η ζωή εδώ είναι πιο ήρεμη.', 'Life here is calmer.', 'Жизнь здесь спокойнее.')),
  c('kids', 'Хорошо для детей', g('Είναι ιδανικό μέρος για να μεγαλώσουν τα παιδιά.', 'It is an ideal place for children to grow up.', 'Это идеальное место, чтобы растить детей.')),
  c('history', 'История и культура', g('Η Κύπρος έχει πλούσια ιστορία και πολιτισμό.', 'Cyprus has a rich history and culture.', 'У Кипра богатая история и культура.')),
]

export const HOUSE_TYPE: Choice[] = [
  c('flat', 'Квартира', g('διαμέρισμα', 'an apartment', 'квартира')),
  c('house', 'Дом (μονοκατοικία)', g('μονοκατοικία', 'a detached house', 'частный дом')),
  c('maisonette', 'Таунхаус (μεζονέτα)', g('μεζονέτα', 'a maisonette', 'таунхаус')),
]

export const TENURE: Choice<null>[] = [
  c('rent', 'Снимаю', null),
  c('own', 'Своё жильё', null),
]

export const MONEY_SOURCES: Choice[] = [
  c('savings', 'Сбережения', g('από τις οικονομίες μου', 'from my savings', 'из моих сбережений')),
  c('sold', 'Продал(а) жильё на родине', g('από την πώληση του διαμερίσματός μου στη χώρα μου', 'from selling my apartment in my country', 'от продажи квартиры на родине')),
  c('loan', 'Кредит в банке', g('από δάνειο της τράπεζας', 'from a bank loan', 'из банковского кредита')),
  c('salary', 'Зарплата', g('από τον μισθό μου', 'from my salary', 'из моей зарплаты')),
]

export const OLD_HOME: Choice<null>[] = [
  c('sold', 'Продал(а)', null),
  c('kept', 'Осталось', null),
  c('never', 'Своего не было', null),
]

export const PASSPORT_REASONS: Choice[] = [
  c('belong', 'Стать полноправным членом общества', g('θέλω να είμαι πλήρες μέλος της κυπριακής κοινωνίας, γιατί η Κύπρος είναι το σπίτι μου', 'I want to be a full member of Cypriot society, because Cyprus is my home', 'я хочу быть полноправным членом кипрского общества, потому что Кипр — мой дом')),
  c('vote', 'Голосовать', g('θέλω να ψηφίζω στις εκλογές και να συμμετέχω στη ζωή της χώρας', 'I want to vote in elections and take part in the life of the country', 'я хочу голосовать на выборах и участвовать в жизни страны')),
  c('kids', 'Будущее детей', g('θέλω τα παιδιά μου να έχουν ένα ασφαλές μέλλον εδώ', 'I want my children to have a secure future here', 'я хочу, чтобы у моих детей было надёжное будущее здесь')),
  c('stability', 'Стабильность (без продления ВНЖ)', g('θέλω σταθερότητα, χωρίς να ανανεώνω την άδεια διαμονής', 'I want stability, without renewing my residence permit', 'я хочу стабильности, без продления вида на жительство')),
  c('travel', 'Свободно путешествовать', g('θέλω να ταξιδεύω πιο εύκολα με την οικογένειά μου', 'I want to travel more easily with my family', 'я хочу свободнее путешествовать с семьёй')),
]

export const BENEFITS: Choice[] = [
  c('taxes', 'Плачу налоги', g('Πληρώνω φόρους και κοινωνικές ασφαλίσεις στην Κύπρο.', 'I pay taxes and social insurance in Cyprus.', 'Я плачу налоги и соцстрах на Кипре.')),
  c('it', 'Развиваю IT/экономику', g('Δουλεύω στον τομέα της τεχνολογίας και βοηθάω την οικονομία της Κύπρου.', 'I work in technology and help the economy of Cyprus.', 'Я работаю в сфере технологий и помогаю экономике Кипра.')),
  c('jobs', 'Создаю рабочие места', g('Έχω δική μου εταιρεία και δίνω δουλειά σε Κύπριους.', 'I have my own company and give jobs to Cypriots.', 'У меня своя компания, и я даю работу киприотам.')),
  c('spend', 'Трачу деньги здесь', g('Ξοδεύω τα χρήματά μου εδώ, στην Κύπρο.', 'I spend my money here, in Cyprus.', 'Я трачу свои деньги здесь, на Кипре.')),
  c('experience', 'Делюсь опытом', g('Μπορώ να μοιραστώ τις γνώσεις και την εμπειρία μου.', 'I can share my knowledge and experience.', 'Я могу делиться знаниями и опытом.')),
  c('volunteer', 'Волонтёрство', g('Κάνω εθελοντισμό και βοηθάω όπου μπορώ.', 'I volunteer and help where I can.', 'Я занимаюсь волонтёрством и помогаю, где могу.')),
  c('kids', 'Дети растут здесь', g('Τα παιδιά μου μεγαλώνουν εδώ και στο μέλλον θα προσφέρουν κι αυτά στην Κύπρο.', 'My children are growing up here and in the future they will also contribute to Cyprus.', 'Мои дети растут здесь и в будущем тоже будут приносить пользу Кипру.')),
]

export const MET_PLACES: Choice[] = [
  c('work', 'На работе', g('στη δουλειά', 'at work', 'на работе')),
  c('neighbours', 'Соседи', g('είμαστε γείτονες', 'we are neighbours', 'мы соседи')),
  c('school', 'В школе детей', g('στο σχολείο των παιδιών μας', 'at our children\'s school', 'в школе наших детей')),
  c('gym', 'В спортзале', g('στο γυμναστήριο', 'at the gym', 'в спортзале')),
  c('greek', 'На курсах греческого', g('στα μαθήματα ελληνικών', 'at Greek lessons', 'на курсах греческого')),
  c('friends', 'Через друзей', g('μέσα από κοινούς φίλους', 'through mutual friends', 'через общих друзей')),
  c('church', 'В церкви', g('στην εκκλησία', 'at church', 'в церкви')),
]

export const WORK_MODE: Choice<null>[] = [
  c('office', 'В офисе', null),
  c('remote', 'Из дома', null),
  c('hybrid', 'Гибрид', null),
]

/* ------------------------------------------------ описание полей анкеты */

export type FieldType =
  | 'gender' | 'text' | 'textarea' | 'name' | 'date' | 'year' | 'number' | 'time' | 'bool'
  | 'select' | 'multi' | 'city' | 'country' | 'children'

export interface FieldDef {
  key: string
  label: string
  type: FieldType
  section: string
  hint?: string
  placeholder?: string
  /** Подсказка для латинского написания имени. */
  placeholderEn?: string
  options?: { value: string; label: string }[]
  places?: KnownPlace[]
  showIf?: (p: Profile) => boolean
}

const opts = (xs: Choice<unknown>[]) => xs.map(({ value, label }) => ({ value, label }))

export const SECTIONS = [
  { id: 'me', title: 'Обо мне', emoji: '🙂' },
  { id: 'move', title: 'Переезд и жильё', emoji: '🏠' },
  { id: 'work', title: 'Работа и деньги', emoji: '💼' },
  { id: 'family', title: 'Семья', emoji: '👨‍👩‍👧' },
  { id: 'parents', title: 'Родители', emoji: '👵' },
  { id: 'study', title: 'Учёба и языки', emoji: '🎓' },
  { id: 'life', title: 'Жизнь на Кипре', emoji: '🌞' },
  { id: 'referees', title: 'Поручители', emoji: '✍️' },
  { id: 'passport', title: 'Паспорт и будущее', emoji: '🛂' },
]

const GR_HINT = 'Пишите греческими буквами — так, как будете произносить.'
const married = (p: Profile) => p.marital === 'married' || p.marital === 'partner'
const working = (p: Profile) => p.workStatus && p.workStatus !== 'none'
const owns = (p: Profile) => p.tenure === 'own'

export const FIELDS: FieldDef[] = [
  // обо мне
  { key: 'gender', label: 'Ваш род (для греческих форм)', type: 'gender', section: 'me' },
  { key: 'name', label: 'Имя', type: 'name', section: 'me', hint: GR_HINT, placeholder: 'Ιβάν', placeholderEn: 'Ivan' },
  { key: 'surname', label: 'Фамилия', type: 'name', section: 'me', hint: GR_HINT, placeholder: 'Πετρόφ', placeholderEn: 'Petrov' },
  { key: 'birthDate', label: 'Дата рождения', type: 'date', section: 'me' },
  { key: 'birthCity', label: 'Город рождения', type: 'city', section: 'me', places: CITIES },
  { key: 'country', label: 'Страна происхождения', type: 'country', section: 'me', places: COUNTRIES },

  // переезд и жильё
  { key: 'moveDate', label: 'Дата переезда на Кипр', type: 'date', section: 'move' },
  { key: 'moveReasons', label: 'Почему переехали', type: 'multi', section: 'move', options: opts(MOVE_REASONS) },
  { key: 'moveReasonCustom', label: 'Своя причина (по-гречески)', type: 'textarea', section: 'move', placeholder: 'Ήθελα να αλλάξω τη ζωή μου.' },
  { key: 'cyCity', label: 'Город на Кипре', type: 'city', section: 'move', places: CITIES.filter((x) => ['limassol', 'nicosia', 'larnaca', 'paphos', 'ayianapa', 'paralimni'].includes(x.id)) },
  { key: 'area', label: 'Район', type: 'text', section: 'move', hint: GR_HINT, placeholder: 'Γερμασόγεια' },
  { key: 'address', label: 'Адрес (улица, дом, кв.)', type: 'text', section: 'move', hint: 'Как в документах, можно греческими буквами.', placeholder: 'Οδός Αγίου Ανδρέα 25, διαμέρισμα 3' },
  { key: 'postcode', label: 'Почтовый индекс', type: 'text', section: 'move', placeholder: '4040' },
  { key: 'phone', label: 'Телефон', type: 'text', section: 'move', placeholder: '99 123456' },
  { key: 'houseType', label: 'Тип жилья', type: 'select', section: 'move', options: opts(HOUSE_TYPE) },
  { key: 'bedrooms', label: 'Спален', type: 'number', section: 'move' },
  { key: 'tenure', label: 'Снимаете или своё', type: 'select', section: 'move', options: opts(TENURE) },
  { key: 'buyDate', label: 'Когда купили', type: 'date', section: 'move', showIf: owns },
  { key: 'price', label: 'Сколько заплатили, €', type: 'number', section: 'move', showIf: owns },
  { key: 'loan', label: 'Брали ипотеку', type: 'bool', section: 'move', showIf: owns },
  { key: 'bank', label: 'Банк', type: 'text', section: 'move', placeholder: 'Τράπεζα Κύπρου', showIf: (p) => owns(p) && p.loan },
  { key: 'moneySources', label: 'Откуда деньги на покупку', type: 'multi', section: 'move', options: opts(MONEY_SOURCES), showIf: owns },
  { key: 'monthly', label: 'Платёж в месяц (аренда / ипотека), €', type: 'number', section: 'move' },
  { key: 'oldHome', label: 'Жильё на родине', type: 'select', section: 'move', options: opts(OLD_HOME) },
  { key: 'oldHomeSoldYear', label: 'Год продажи', type: 'year', section: 'move', showIf: (p) => p.oldHome === 'sold' },

  // работа
  { key: 'workStatus', label: 'Работа', type: 'select', section: 'work', options: opts(WORK_STATUS) },
  { key: 'job', label: 'Должность', type: 'select', section: 'work', options: opts(JOBS), showIf: working },
  { key: 'jobCustom', label: 'Своя должность (по-гречески)', type: 'text', section: 'work', placeholder: 'αρχιτέκτονας', hint: 'Если нет в списке. В нужном роде.', showIf: working },
  { key: 'employer', label: 'Компания', type: 'text', section: 'work', placeholder: 'Wargaming', showIf: working },
  { key: 'workSince', label: 'Работаете там с (год)', type: 'year', section: 'work', showIf: working },
  { key: 'duties', label: 'Что делаете на работе', type: 'multi', section: 'work', options: opts(JOB_DUTIES), showIf: working },
  { key: 'workMode', label: 'Формат работы', type: 'select', section: 'work', options: opts(WORK_MODE), showIf: working },
  { key: 'salary', label: 'Зарплата в месяц (gross), €', type: 'number', section: 'work' },
  { key: 'bonus', label: 'Годовой бонус, € (0 — нет)', type: 'number', section: 'work' },
  { key: 'investments', label: 'Инвестиции', type: 'multi', section: 'work', options: opts(INVESTMENTS) },
  { key: 'dividends', label: 'Дивиденды в год, € (0 — нет)', type: 'number', section: 'work' },

  // семья
  { key: 'marital', label: 'Семейное положение', type: 'select', section: 'family', options: opts(MARITAL) },
  { key: 'spouseGender', label: 'Пол супруга(-и)', type: 'gender', section: 'family', showIf: married },
  { key: 'spouseName', label: 'Имя супруга(-и)', type: 'name', section: 'family', hint: GR_HINT, placeholder: 'Άννα', placeholderEn: 'Anna', showIf: married },
  { key: 'spouseBirthDate', label: 'Дата рождения супруга(-и)', type: 'date', section: 'family', showIf: married },
  { key: 'spouseBirthCity', label: 'Где родился(-ась)', type: 'city', section: 'family', places: CITIES, showIf: married },
  { key: 'weddingDate', label: 'Дата свадьбы', type: 'date', section: 'family', showIf: (p) => p.marital === 'married' },
  { key: 'weddingCity', label: 'Где поженились', type: 'city', section: 'family', places: CITIES, showIf: (p) => p.marital === 'married' },
  { key: 'spouseWorks', label: 'Супруг(а) работает', type: 'bool', section: 'family', showIf: married },
  { key: 'spouseJob', label: 'Кем работает (по-гречески)', type: 'text', section: 'family', placeholder: 'λογίστρια', showIf: (p) => married(p) && p.spouseWorks },
  { key: 'spouseEmployer', label: 'Где работает', type: 'text', section: 'family', placeholder: 'Bank of Cyprus', showIf: (p) => married(p) && p.spouseWorks },
  { key: 'spouseSalary', label: 'Зарплата супруга(-и), €/мес', type: 'number', section: 'family', showIf: (p) => married(p) && p.spouseWorks },
  { key: 'children', label: 'Дети', type: 'children', section: 'family' },
  { key: 'prevMarriage', label: 'Был предыдущий брак', type: 'bool', section: 'family' },
  { key: 'prevMarriageText', label: 'О предыдущем браке (по-гречески)', type: 'textarea', section: 'family', placeholder: 'Ήμουν παντρεμένος πριν, αλλά χωρίσαμε το 2012. Δεν έχω άλλα παιδιά.', showIf: (p) => p.prevMarriage },
  { key: 'relatives', label: 'Родственники на Кипре (по-гречески, пусто — нет)', type: 'textarea', section: 'family', placeholder: 'Η αδερφή μου μένει στη Λάρνακα.' },

  // родители
  { key: 'parentsCity', label: 'Где живут родители', type: 'city', section: 'parents', places: CITIES },
  { key: 'parentsCountry', label: 'Страна', type: 'country', section: 'parents', places: COUNTRIES },
  { key: 'fatherName', label: 'Имя отца', type: 'name', section: 'parents', hint: GR_HINT, placeholder: 'Σεργκέι', placeholderEn: 'Sergey' },
  { key: 'fatherStatus', label: 'Отец', type: 'select', section: 'parents', options: opts(PARENT_STATUS) },
  { key: 'fatherJob', label: 'Кем работает отец (по-гречески)', type: 'text', section: 'parents', placeholder: 'μηχανικός', showIf: (p) => p.fatherStatus === 'works' },
  { key: 'motherName', label: 'Имя матери', type: 'name', section: 'parents', hint: GR_HINT, placeholder: 'Έλενα', placeholderEn: 'Elena' },
  { key: 'motherStatus', label: 'Мать', type: 'select', section: 'parents', options: opts(PARENT_STATUS) },
  { key: 'motherJob', label: 'Кем работает мать (по-гречески)', type: 'text', section: 'parents', placeholder: 'δασκάλα', showIf: (p) => p.motherStatus === 'works' },

  // учёба и языки
  { key: 'uni', label: 'Университет (по-гречески)', type: 'text', section: 'study', hint: 'Начните со слова «Πανεπιστήμιο» или «Ινστιτούτο».', placeholder: 'Κρατικό Πανεπιστήμιο της Μόσχας' },
  { key: 'uniCity', label: 'Город университета', type: 'city', section: 'study', places: CITIES },
  { key: 'subject', label: 'Специальность (по-гречески)', type: 'text', section: 'study', placeholder: 'πληροφορική' },
  { key: 'gradYear', label: 'Год окончания', type: 'year', section: 'study' },
  { key: 'profession', label: 'Профессия по образованию (по-гречески)', type: 'text', section: 'study', placeholder: 'μηχανικός υπολογιστών', hint: 'В нужном роде.' },
  { key: 'nativeLang', label: 'Родной язык', type: 'select', section: 'study', options: opts(LANGUAGES) },
  { key: 'langs', label: 'Другие языки', type: 'multi', section: 'study', options: opts(LANGUAGES) },
  { key: 'greekSince', label: 'Учу греческий с (год)', type: 'year', section: 'study' },
  { key: 'greekWhere', label: 'Как учите греческий', type: 'select', section: 'study', options: opts(GREEK_WHERE) },

  // жизнь на Кипре
  { key: 'hobbies', label: 'Хобби и свободное время', type: 'multi', section: 'life', options: opts(HOBBIES) },
  { key: 'foods', label: 'Любимая кипрская еда (первая — самая любимая)', type: 'multi', section: 'life', options: opts(FOODS) },
  { key: 'likeCy', label: 'За что любите Кипр', type: 'multi', section: 'life', options: opts(LIKE_CY) },
  { key: 'religion', label: 'Религия', type: 'select', section: 'life', options: opts(RELIGION) },
  { key: 'churchFreq', label: 'Ходите в церковь', type: 'select', section: 'life', options: opts(CHURCH_FREQ) },
  { key: 'church', label: 'Какая церковь (род. падеж)', type: 'text', section: 'life', hint: 'Будет: «στην εκκλησία …». Пример: του Αγίου Νικολάου.', placeholder: 'του Αγίου Νικολάου' },
  { key: 'cyFriends', label: 'Имена друзей-киприотов', type: 'text', section: 'life', hint: GR_HINT, placeholder: 'Ανδρέας και Μαρία' },
  { key: 'cyFriendsMet', label: 'Где познакомились', type: 'select', section: 'life', options: opts(MET_PLACES) },
  { key: 'wakeTime', label: 'Встаю в', type: 'time', section: 'life' },
  { key: 'workStart', label: 'Начинаю работать в', type: 'time', section: 'life' },
  { key: 'workEnd', label: 'Заканчиваю в', type: 'time', section: 'life' },
  { key: 'sleepTime', label: 'Ложусь спать в', type: 'time', section: 'life' },

  // поручители
  { key: 'ref1Gender', label: 'Поручитель 1 — пол', type: 'gender', section: 'referees' },
  { key: 'ref1Name', label: 'Поручитель 1 — имя и фамилия', type: 'name', section: 'referees', hint: GR_HINT, placeholder: 'Ανδρέας Γεωργίου', placeholderEn: 'Andreas Georgiou' },
  { key: 'ref1Job', label: 'Кем работает (по-гречески, в нужном роде)', type: 'text', section: 'referees', placeholder: 'δικηγόρος' },
  { key: 'ref1Since', label: 'Знакомы с (год)', type: 'year', section: 'referees' },
  { key: 'ref1Met', label: 'Где познакомились', type: 'select', section: 'referees', options: opts(MET_PLACES) },
  { key: 'ref2Gender', label: 'Поручитель 2 — пол', type: 'gender', section: 'referees' },
  { key: 'ref2Name', label: 'Поручитель 2 — имя и фамилия', type: 'name', section: 'referees', hint: GR_HINT, placeholder: 'Μαρία Κωνσταντίνου', placeholderEn: 'Maria Konstantinou' },
  { key: 'ref2Job', label: 'Кем работает (по-гречески, в нужном роде)', type: 'text', section: 'referees', placeholder: 'δασκάλα' },
  { key: 'ref2Since', label: 'Знакомы с (год)', type: 'year', section: 'referees' },
  { key: 'ref2Met', label: 'Где познакомились', type: 'select', section: 'referees', options: opts(MET_PLACES) },

  // паспорт
  { key: 'passportReasons', label: 'Зачем паспорт (выберите 2, по порядку)', type: 'multi', section: 'passport', options: opts(PASSPORT_REASONS) },
  { key: 'benefits', label: 'Чем полезны Кипру', type: 'multi', section: 'passport', options: opts(BENEFITS) },
]

export const FIELD_BY_KEY = Object.fromEntries(FIELDS.map((f) => [f.key, f]))

export const DEFAULT_PROFILE: Profile = {
  gender: 'm',
  spouseGender: 'f',
  ref1Gender: 'm',
  ref2Gender: 'f',
  fatherStatus: 'works',
  motherStatus: 'works',
  children: [],
  religion: 'orthodox',
  churchFreq: 'holidays',
  nativeLang: 'ru',
  langs: ['en'],
  workStatus: 'employee',
  workMode: 'office',
  tenure: 'rent',
  houseType: 'flat',
  oldHome: 'never',
  wakeTime: '07:00',
  workStart: '09:00',
  workEnd: '18:00',
  sleepTime: '23:00',
  passportReasons: ['belong', 'kids'],
  benefits: ['taxes', 'spend', 'experience'],
  likeCy: ['climate', 'people', 'safety'],
  moveReasons: ['work', 'safety'],
  greekWhere: 'teacher',
}

/** Какие поля считаются в прогрессе заполнения. */
export function isFieldVisible(f: FieldDef, p: Profile) {
  return !f.showIf || f.showIf(p)
}

export function isFieldFilled(f: FieldDef, p: Profile): boolean {
  const v = p[f.key]
  switch (f.type) {
    case 'name': return !!v?.gr?.trim()
    case 'city':
    case 'country': return !!(v?.id || v?.name?.trim())
    case 'multi': return Array.isArray(v) && v.length > 0
    case 'children': return Array.isArray(v)
    case 'bool': return typeof v === 'boolean'
    case 'number':
    case 'year': return v !== undefined && v !== null && v !== ''
    default: return typeof v === 'string' ? v.trim().length > 0 : v !== undefined && v !== null
  }
}

/** Необязательные поля не влияют на прогресс анкеты. */
export const OPTIONAL_FIELDS = new Set(['moveReasonCustom', 'jobCustom', 'relatives', 'postcode', 'prevMarriage', 'prevMarriageText', 'church', 'bonus', 'dividends', 'investments', 'langs'])
