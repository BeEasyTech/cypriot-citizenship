/** Экранирование пользовательского текста для parse_mode: 'HTML'. */
export const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
