import type { GalleryItemDto, GalleryItemInput, GalleryOptionsDto } from "@/lib/validation/gallery";
import type { ReorderInput, ToggleActiveInput } from "@/lib/validation/ordering";

import { baseApi } from "./base-api";

const list = { type: "GalleryItem", id: "LIST" } as const;
const mediaList = { type: "Media", id: "LIST" } as const;

export const galleryItemsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getGalleryItems: build.query<GalleryItemDto[], void>({
      query: () => "admin/gallery-items",
      providesTags: [list],
    }),
    getGalleryOptions: build.query<GalleryOptionsDto, void>({
      query: () => "admin/gallery-items/options",
      providesTags: [
        { type: "Category", id: "LIST" },
        { type: "Master", id: "LIST" },
      ],
    }),
    createGalleryItem: build.mutation<{ id: string }, GalleryItemInput>({
      query: (body) => ({ url: "admin/gallery-items", method: "POST", body }),
      invalidatesTags: [list, mediaList],
    }),
    updateGalleryItem: build.mutation<{ id: string }, GalleryItemInput & { id: string }>({
      query: ({ id, ...body }) => ({ url: `admin/gallery-items/${id}`, method: "PUT", body }),
      invalidatesTags: [list, mediaList],
    }),
    toggleGalleryItem: build.mutation<void, ToggleActiveInput & { id: string }>({
      query: ({ id, ...body }) => ({ url: `admin/gallery-items/${id}`, method: "PATCH", body }),
      async onQueryStarted({ id, isActive }, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          galleryItemsApi.util.updateQueryData("getGalleryItems", undefined, (draft) => {
            const row = draft.find((item) => item.id === id);
            if (row) row.isActive = isActive;
          }),
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
    }),
    reorderGalleryItems: build.mutation<void, ReorderInput>({
      query: (body) => ({ url: "admin/gallery-items/reorder", method: "POST", body }),
      async onQueryStarted({ orderedIds }, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          galleryItemsApi.util.updateQueryData("getGalleryItems", undefined, (draft) => {
            for (const [index, id] of orderedIds.entries()) {
              const row = draft.find((item) => item.id === id);
              if (row) row.sortOrder = index;
            }
            draft.sort((a, b) => a.sortOrder - b.sortOrder);
          }),
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
      invalidatesTags: [list],
    }),
    deleteGalleryItem: build.mutation<void, string>({
      query: (id) => ({ url: `admin/gallery-items/${id}`, method: "DELETE" }),
      invalidatesTags: [list, mediaList],
    }),
  }),
});

export const {
  useGetGalleryItemsQuery,
  useGetGalleryOptionsQuery,
  useCreateGalleryItemMutation,
  useUpdateGalleryItemMutation,
  useToggleGalleryItemMutation,
  useReorderGalleryItemsMutation,
  useDeleteGalleryItemMutation,
} = galleryItemsApi;
