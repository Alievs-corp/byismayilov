export const routes = {
  home: () => "/",
  services: () => "/xidmetler",
  service: (slug: string) => `/xidmetler/${slug}`,
  masters: () => "/ustalar",
  gallery: () => "/islerimiz",
  blog: () => "/bloq",
  post: (slug: string) => `/bloq/${slug}`,
  contact: () => "/elaqe",
  booking: () => "/qeydiyyat",
  page: (slug: string) => `/${slug}`,
  media: (key: string) => `/media/${key}`,
};
