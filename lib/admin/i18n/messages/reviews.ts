import type { Messages } from "../translate";

export const ru = {
  Rəylər: "Отзывы",
  "Yeni rəy": "Новый отзыв",
  "Rəyi redaktə et": "Редактировать отзыв",
  "Rəyi müştərinin yazdığı kimi, öz dilində köçürün. Uydurma rəy əlavə etməyin.":
    "Переносите отзыв так, как его написал клиент, на его языке. Не добавляйте выдуманные отзывы.",
  "Müştərinin adı": "Имя клиента",
  Rəy: "Отзыв",
  Qiymət: "Оценка",
  "Müştəri qiymət verməyibsə, boş saxlayın.": "Если клиент не ставил оценку, оставьте пустым.",
  "Qiymət yoxdur": "Без оценки",
  "Qiymət: {count}/5": "Оценка: {count}/5",
  "İstəyə bağlı. Yalnız müştərinin icazəsi ilə.": "Необязательно. Только с разрешения клиента.",
  Mənbə: "Источник",
  "Rəyin yazıldığı yer, məsələn Instagram və ya Google keçidi.":
    "Где оставлен отзыв, например ссылка на Instagram или Google.",
  "Müştəri rəyləri saytda bu sırada göstərilir. Yalnız real rəyləri əlavə edin. Sürüşdürərək və ya kart menyusundan sıranı dəyişin.":
    "Отзывы клиентов показываются на сайте в этом порядке. Добавляйте только настоящие отзывы. Меняйте порядок перетаскиванием или через меню карточки.",
  "Rəylər yüklənmədi.": "Не удалось загрузить отзывы.",
  "Hələ rəy əlavə olunmayıb.": "Отзывов пока нет.",
  "Rəy həmişəlik silinəcək. Foto media kitabxanasında qalır.":
    "Отзыв будет удалён навсегда. Фото останется в медиатеке.",
  "Rəy tapılmadı.": "Отзыв не найден.",
  "Müştərinin adını yazın.": "Укажите имя клиента.",
  "Rəyin mətnini yazın.": "Укажите текст отзыва.",
  "Qiymət 1 ilə 5 arasında olmalıdır.": "Оценка должна быть от 1 до 5.",
  "Ad yazılmalıdır": "Нужно указать имя",
} satisfies Messages;

export const en: Record<keyof typeof ru, string> = {
  Rəylər: "Reviews",
  "Yeni rəy": "New review",
  "Rəyi redaktə et": "Edit review",
  "Rəyi müştərinin yazdığı kimi, öz dilində köçürün. Uydurma rəy əlavə etməyin.":
    "Copy the review as the client wrote it, in their language. Never add made-up reviews.",
  "Müştərinin adı": "Client name",
  Rəy: "Review",
  Qiymət: "Rating",
  "Müştəri qiymət verməyibsə, boş saxlayın.": "Leave empty if the client gave no rating.",
  "Qiymət yoxdur": "No rating",
  "Qiymət: {count}/5": "Rating: {count}/5",
  "İstəyə bağlı. Yalnız müştərinin icazəsi ilə.": "Optional. Only with the client's permission.",
  Mənbə: "Source",
  "Rəyin yazıldığı yer, məsələn Instagram və ya Google keçidi.":
    "Where the review was written, for example an Instagram or Google link.",
  "Müştəri rəyləri saytda bu sırada göstərilir. Yalnız real rəyləri əlavə edin. Sürüşdürərək və ya kart menyusundan sıranı dəyişin.":
    "Client reviews are shown on the site in this order. Add real reviews only. Drag or use the card menu to change the order.",
  "Rəylər yüklənmədi.": "Reviews did not load.",
  "Hələ rəy əlavə olunmayıb.": "No reviews yet.",
  "Rəy həmişəlik silinəcək. Foto media kitabxanasında qalır.":
    "The review will be deleted for good. The photo stays in the media library.",
  "Rəy tapılmadı.": "Review not found.",
  "Müştərinin adını yazın.": "Enter the client's name.",
  "Rəyin mətnini yazın.": "Enter the review text.",
  "Qiymət 1 ilə 5 arasında olmalıdır.": "The rating must be between 1 and 5.",
  "Ad yazılmalıdır": "Name required",
};
