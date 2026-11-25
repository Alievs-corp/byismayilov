import type { ReviewDto, ReviewInput } from "@/lib/validation/reviews";
import type { ReorderInput, ToggleActiveInput } from "@/lib/validation/ordering";

import { baseApi } from "./base-api";

const list = { type: "Review", id: "LIST" } as const;
const mediaList = { type: "Media", id: "LIST" } as const;

export const reviewsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getReviews: build.query<ReviewDto[], void>({
      query: () => "admin/reviews",
      providesTags: [list],
    }),
    createReview: build.mutation<{ id: string }, ReviewInput>({
      query: (body) => ({ url: "admin/reviews", method: "POST", body }),
      invalidatesTags: [list, mediaList],
    }),
    updateReview: build.mutation<{ id: string }, ReviewInput & { id: string }>({
      query: ({ id, ...body }) => ({ url: `admin/reviews/${id}`, method: "PUT", body }),
      invalidatesTags: [list, mediaList],
    }),
    toggleReview: build.mutation<void, ToggleActiveInput & { id: string }>({
      query: ({ id, ...body }) => ({ url: `admin/reviews/${id}`, method: "PATCH", body }),
      async onQueryStarted({ id, isActive }, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          reviewsApi.util.updateQueryData("getReviews", undefined, (draft) => {
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
    reorderReviews: build.mutation<void, ReorderInput>({
      query: (body) => ({ url: "admin/reviews/reorder", method: "POST", body }),
      async onQueryStarted({ orderedIds }, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          reviewsApi.util.updateQueryData("getReviews", undefined, (draft) => {
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
    deleteReview: build.mutation<void, string>({
      query: (id) => ({ url: `admin/reviews/${id}`, method: "DELETE" }),
      invalidatesTags: [list, mediaList],
    }),
  }),
});

export const {
  useGetReviewsQuery,
  useCreateReviewMutation,
  useUpdateReviewMutation,
  useToggleReviewMutation,
  useReorderReviewsMutation,
  useDeleteReviewMutation,
} = reviewsApi;
