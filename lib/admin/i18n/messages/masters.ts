import type { Messages } from "../translate";

export const ru = {
  Foto: "Фото",
  "Kvadrat və ya portret foto, ən azı 800 px.": "Квадратное или портретное фото, не меньше 800 px.",
  "Ad və soyad ({locale})": "Имя и фамилия ({locale})",
  "Hər dil üçün o dildəki yazılışı ilə.": "В написании, принятом в каждом языке.",
  Telefonlar: "Телефоны",
  "Telefon {count}": "Телефон {count}",
  "Telefon {count}: sil": "Телефон {count}: удалить",
  WhatsApp: "WhatsApp",
  "Şəkil düzgün deyil.": "Изображение указано неверно.",
  "{count} əlaqə şəxsi": "{count} {count|контактное лицо|контактных лица|контактных лиц}",
  Ustalar: "Мастера",
  "Yeni usta": "Новый мастер",
  Yüklənir: "Загрузка",
  "Axtarışa uyğun xidmət yoxdur.": "Нет услуг по запросу.",
  "Hələ xidmət əlavə olunmayıb.": "Услуг пока нет.",
  "Xidmət axtar": "Найти услугу",
  "Xidmətlər yüklənmədi.": "Не удалось загрузить услуги.",
  "Seçilib: {count}": "Выбрано: {count}",
  Qaralama: "Черновик",
  "Ustanı redaktə et": "Редактировать мастера",
  "Usta «Ustalar» səhifəsində və qeydiyyat formasında göstərilir.":
    "Мастер показывается на странице «Мастера» и в форме записи.",
  "İxtisas ({locale})": "Специализация ({locale})",
  "Məsələn: saç ustası, manikür ustası.": "Например: парикмахер, мастер маникюра.",
  "Qısa bioqrafiya ({locale})": "Краткая биография ({locale})",
  "Bir-iki cümlə. Boş qalsa, saytda göstərilmir.":
    "Одно-два предложения. Если пусто, на сайте не показывается.",
  "Profilin tam ünvanı. Boş qalsa, saytda göstərilmir.":
    "Полный адрес профиля. Если пусто, на сайте не показывается.",
  "Etdiyi xidmətlər": "Услуги мастера",
  "Qeydiyyat formasında bu xidmətlər üçün usta kimi təklif olunur.":
    "В форме записи предлагается мастером для этих услуг.",
  "Ustalar «Ustalar» səhifəsində və qeydiyyat formasında bu sırada göstərilir. Sürüşdürərək və ya kart menyusundan sıranı dəyişin.":
    "Мастера показываются на странице «Мастера» и в форме записи в этом порядке. Меняйте порядок перетаскиванием или через меню карточки.",
  "Ustalar yüklənmədi.": "Не удалось загрузить мастеров.",
  "Hələ usta əlavə olunmayıb.": "Мастеров пока нет.",
  "Usta saytdan götürüləcək. Foto media kitabxanasında qalır, keçmiş qeydiyyatlarda adı saxlanılır.":
    "Мастер будет убран с сайта. Фото останется в медиатеке, имя сохранится в прошлых записях.",
  "{count} xidmət": "{count} {count|услуга|услуги|услуг}",
  "Usta tapılmadı.": "Мастер не найден.",
  "Instagram profilinin tam ünvanını yazın, məsələn https://www.instagram.com/ad":
    "Укажите полный адрес профиля Instagram, например https://www.instagram.com/ad",
  "İxtisası yazın.": "Укажите специализацию.",
  "Adı yazın.": "Укажите имя.",
  "Ən çox {max} xidmət seçmək olar.": "Можно выбрать не более {max} {max|услуги|услуг|услуг}.",
  Instagram: "Instagram",
} satisfies Messages;

export const en: Record<keyof typeof ru, string> = {
  Foto: "Photo",
  "Kvadrat və ya portret foto, ən azı 800 px.": "A square or portrait photo, at least 800 px.",
  "Ad və soyad ({locale})": "Full name ({locale})",
  "Hər dil üçün o dildəki yazılışı ilə.": "As it is spelled in each language.",
  Telefonlar: "Phones",
  "Telefon {count}": "Phone {count}",
  "Telefon {count}: sil": "Phone {count}: remove",
  WhatsApp: "WhatsApp",
  "Şəkil düzgün deyil.": "The image is not valid.",
  "{count} əlaqə şəxsi": "{count} {count|contact person|contact persons}",
  Ustalar: "Masters",
  "Yeni usta": "New master",
  Yüklənir: "Loading",
  "Axtarışa uyğun xidmət yoxdur.": "No services match the search.",
  "Hələ xidmət əlavə olunmayıb.": "No services yet.",
  "Xidmət axtar": "Find a service",
  "Xidmətlər yüklənmədi.": "Services did not load.",
  "Seçilib: {count}": "Selected: {count}",
  Qaralama: "Draft",
  "Ustanı redaktə et": "Edit master",
  "Usta «Ustalar» səhifəsində və qeydiyyat formasında göstərilir.":
    "The master is shown on the Masters page and in the booking form.",
  "İxtisas ({locale})": "Speciality ({locale})",
  "Məsələn: saç ustası, manikür ustası.": "For example: hair stylist, nail technician.",
  "Qısa bioqrafiya ({locale})": "Short bio ({locale})",
  "Bir-iki cümlə. Boş qalsa, saytda göstərilmir.":
    "One or two sentences. Left empty, it is not shown on the site.",
  "Profilin tam ünvanı. Boş qalsa, saytda göstərilmir.":
    "The full profile address. Left empty, it is not shown on the site.",
  "Etdiyi xidmətlər": "Services this master does",
  "Qeydiyyat formasında bu xidmətlər üçün usta kimi təklif olunur.":
    "Offered as the master for these services in the booking form.",
  "Ustalar «Ustalar» səhifəsində və qeydiyyat formasında bu sırada göstərilir. Sürüşdürərək və ya kart menyusundan sıranı dəyişin.":
    "Masters are shown on the Masters page and in the booking form in this order. Drag or use the card menu to change the order.",
  "Ustalar yüklənmədi.": "Masters did not load.",
  "Hələ usta əlavə olunmayıb.": "No masters yet.",
  "Usta saytdan götürüləcək. Foto media kitabxanasında qalır, keçmiş qeydiyyatlarda adı saxlanılır.":
    "The master will be removed from the site. The photo stays in the media library and past bookings keep the name.",
  "{count} xidmət": "{count} {count|service|services}",
  "Usta tapılmadı.": "Master not found.",
  "Instagram profilinin tam ünvanını yazın, məsələn https://www.instagram.com/ad":
    "Enter the full Instagram profile address, for example https://www.instagram.com/name",
  "İxtisası yazın.": "Enter the speciality.",
  "Adı yazın.": "Enter the name.",
  "Ən çox {max} xidmət seçmək olar.": "You can choose at most {max} {max|service|services}.",
  Instagram: "Instagram",
};
