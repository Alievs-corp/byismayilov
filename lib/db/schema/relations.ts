import { relations } from "drizzle-orm";

import { bookingRequestServices, bookingRequests } from "./bookings";
import { heroFilms, pages, posts } from "./content";
import { media } from "./media";
import { menuItems, menus } from "./navigation";
import { galleryItems, masterServices, masters, reviews } from "./salon";
import { serviceCategories, serviceCategoryLinks, serviceImages, services } from "./services";

export const serviceCategoriesRelations = relations(serviceCategories, ({ one, many }) => ({
  parent: one(serviceCategories, {
    fields: [serviceCategories.parentId],
    references: [serviceCategories.id],
    relationName: "service_category_parent",
  }),
  children: many(serviceCategories, { relationName: "service_category_parent" }),
  image: one(media, { fields: [serviceCategories.imageId], references: [media.id] }),
  services: many(serviceCategoryLinks),
}));

export const servicesRelations = relations(services, ({ many }) => ({
  categories: many(serviceCategoryLinks),
  images: many(serviceImages),
  masters: many(masterServices),
}));

export const serviceCategoryLinksRelations = relations(serviceCategoryLinks, ({ one }) => ({
  service: one(services, { fields: [serviceCategoryLinks.serviceId], references: [services.id] }),
  category: one(serviceCategories, {
    fields: [serviceCategoryLinks.categoryId],
    references: [serviceCategories.id],
  }),
}));

export const serviceImagesRelations = relations(serviceImages, ({ one }) => ({
  service: one(services, { fields: [serviceImages.serviceId], references: [services.id] }),
  media: one(media, { fields: [serviceImages.mediaId], references: [media.id] }),
}));

export const mastersRelations = relations(masters, ({ one, many }) => ({
  photo: one(media, { fields: [masters.photoId], references: [media.id] }),
  services: many(masterServices),
}));

export const masterServicesRelations = relations(masterServices, ({ one }) => ({
  master: one(masters, { fields: [masterServices.masterId], references: [masters.id] }),
  service: one(services, { fields: [masterServices.serviceId], references: [services.id] }),
}));

export const galleryItemsRelations = relations(galleryItems, ({ one }) => ({
  media: one(media, {
    fields: [galleryItems.mediaId],
    references: [media.id],
    relationName: "gallery_item_media",
  }),
  before: one(media, {
    fields: [galleryItems.beforeMediaId],
    references: [media.id],
    relationName: "gallery_item_before",
  }),
  category: one(serviceCategories, {
    fields: [galleryItems.categoryId],
    references: [serviceCategories.id],
  }),
  master: one(masters, { fields: [galleryItems.masterId], references: [masters.id] }),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  photo: one(media, { fields: [reviews.photoId], references: [media.id] }),
}));

export const pagesRelations = relations(pages, ({ one }) => ({
  cover: one(media, { fields: [pages.coverId], references: [media.id] }),
}));

export const postsRelations = relations(posts, ({ one }) => ({
  cover: one(media, { fields: [posts.coverId], references: [media.id] }),
}));

export const heroFilmsRelations = relations(heroFilms, ({ one }) => ({
  poster: one(media, { fields: [heroFilms.posterId], references: [media.id] }),
}));

export const menusRelations = relations(menus, ({ many }) => ({
  items: many(menuItems),
}));

export const menuItemsRelations = relations(menuItems, ({ one, many }) => ({
  menu: one(menus, { fields: [menuItems.menuId], references: [menus.id] }),
  parent: one(menuItems, {
    fields: [menuItems.parentId],
    references: [menuItems.id],
    relationName: "menu_item_parent",
  }),
  children: many(menuItems, { relationName: "menu_item_parent" }),
  category: one(serviceCategories, {
    fields: [menuItems.categoryId],
    references: [serviceCategories.id],
  }),
  page: one(pages, { fields: [menuItems.pageId], references: [pages.id] }),
}));

export const bookingRequestsRelations = relations(bookingRequests, ({ one, many }) => ({
  services: many(bookingRequestServices),
  master: one(masters, { fields: [bookingRequests.masterId], references: [masters.id] }),
}));

export const bookingRequestServicesRelations = relations(bookingRequestServices, ({ one }) => ({
  bookingRequest: one(bookingRequests, {
    fields: [bookingRequestServices.bookingRequestId],
    references: [bookingRequests.id],
  }),
  service: one(services, {
    fields: [bookingRequestServices.serviceId],
    references: [services.id],
  }),
}));
