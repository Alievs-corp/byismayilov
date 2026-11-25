import { defaultLocale, isLocale, type Locale } from "./config";

export const localeHeader = "x-byismayilov-locale";

export function localeFromHeader(value: string | null): Locale {
  return value && isLocale(value) ? value : defaultLocale;
}
