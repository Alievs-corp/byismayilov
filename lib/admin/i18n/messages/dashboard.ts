import type { Messages } from "../translate";

export const ru = {
  "İdarə paneli": "Панель управления",
  "Xoş gəldiniz, {name}.": "Добро пожаловать, {name}.",
  "Sayt ziyarətçiləri": "Посетители сайта",
  "Bu gün": "Сегодня",
  "Son 7 gün": "За 7 дней",
  "Son 30 gün": "За 30 дней",
  "Unikal ziyarətçilər, Bakı vaxtı ilə. Botlar və daxil olmuş istifadəçilər sayılmır.":
    "Уникальные посетители, по бакинскому времени. Боты и вошедшие пользователи не учитываются.",
  "Cavab gözləyən: {count}": "Ждут ответа: {count}",
  "{published} dərc olunub, {draft} qaralama": "Опубликовано: {published}, черновики: {draft}",
  Qaralamalar: "Черновики",
  Hamısı: "Все",
  Ad: "Имя",
  Telefon: "Телефон",
  Status: "Статус",
  Tarix: "Дата",
  "Tez keçidlər": "Быстрые ссылки",
  "Media kitabxanası": "Медиатека",
  "Əlaqə məlumatları və SEO": "Контакты и SEO",
  Tapılmadı: "Не найдено",
  "İdarə panelinə qayıt": "Вернуться в панель управления",
  "Bu bölmə növbəti mərhələdə əlavə olunacaq.": "Этот раздел появится на следующем этапе.",
  "Səhifə tapılmadı": "Страница не найдена",
  "Bu ünvanda bölmə yoxdur və ya element silinib.":
    "По этому адресу нет раздела, или элемент был удалён.",
} satisfies Messages;

export const en: Record<keyof typeof ru, string> = {
  "İdarə paneli": "Dashboard",
  "Xoş gəldiniz, {name}.": "Welcome, {name}.",
  "Sayt ziyarətçiləri": "Site visitors",
  "Bu gün": "Today",
  "Son 7 gün": "Last 7 days",
  "Son 30 gün": "Last 30 days",
  "Unikal ziyarətçilər, Bakı vaxtı ilə. Botlar və daxil olmuş istifadəçilər sayılmır.":
    "Unique visitors, Baku time. Bots and signed-in users are not counted.",
  "Cavab gözləyən: {count}": "Awaiting reply: {count}",
  "{published} dərc olunub, {draft} qaralama": "Published: {published}, drafts: {draft}",
  Qaralamalar: "Drafts",
  Hamısı: "All",
  Ad: "Name",
  Telefon: "Phone",
  Status: "Status",
  Tarix: "Date",
  "Tez keçidlər": "Quick links",
  "Media kitabxanası": "Media library",
  "Əlaqə məlumatları və SEO": "Contact details and SEO",
  Tapılmadı: "Not found",
  "İdarə panelinə qayıt": "Back to the dashboard",
  "Bu bölmə növbəti mərhələdə əlavə olunacaq.": "This section will be added in the next stage.",
  "Səhifə tapılmadı": "Page not found",
  "Bu ünvanda bölmə yoxdur və ya element silinib.":
    "There is no section at this address, or the item was deleted.",
};
