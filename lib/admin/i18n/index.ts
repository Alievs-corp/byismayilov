import { createTranslator } from "./translate";
import * as common from "./messages/common";
import * as validation from "./messages/validation";
import * as dashboard from "./messages/dashboard";
import * as services from "./messages/services";
import * as categories from "./messages/categories";
import * as media from "./messages/media";
import * as pages from "./messages/pages";
import * as blog from "./messages/blog";
import * as masters from "./messages/masters";
import * as gallery from "./messages/gallery";
import * as reviews from "./messages/reviews";
import * as menus from "./messages/menus";
import * as homeSections from "./messages/home-sections";
import * as heroFilms from "./messages/hero-films";
import * as settings from "./messages/settings";
import * as redirects from "./messages/redirects";
import * as bookings from "./messages/bookings";
import * as users from "./messages/users";
import * as auth from "./messages/auth";
import * as localization from "./messages/localization";
import * as seo from "./messages/seo";

export const ru = {
  ...common.ru,
  ...validation.ru,
  ...dashboard.ru,
  ...services.ru,
  ...categories.ru,
  ...media.ru,
  ...pages.ru,
  ...blog.ru,
  ...masters.ru,
  ...gallery.ru,
  ...reviews.ru,
  ...menus.ru,
  ...homeSections.ru,
  ...heroFilms.ru,
  ...settings.ru,
  ...redirects.ru,
  ...bookings.ru,
  ...users.ru,
  ...auth.ru,
  ...localization.ru,
  ...seo.ru,
};

export type MessageKey = keyof typeof ru;

export const en: Record<MessageKey, string> = {
  ...common.en,
  ...validation.en,
  ...dashboard.en,
  ...services.en,
  ...categories.en,
  ...media.en,
  ...pages.en,
  ...blog.en,
  ...masters.en,
  ...gallery.en,
  ...reviews.en,
  ...menus.en,
  ...homeSections.en,
  ...heroFilms.en,
  ...settings.en,
  ...redirects.en,
  ...bookings.en,
  ...users.en,
  ...auth.en,
  ...localization.en,
  ...seo.en,
};

export const { translate, translateMessage } = createTranslator({ ru, en });
