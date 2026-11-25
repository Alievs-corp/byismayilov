import type {
  CategoryDetailDto,
  CategoryInput,
  CategoryNodeDto,
  DeleteCategoryInput,
  ReorderCategoriesInput,
  ToggleCategoryInput,
} from "@/lib/validation/categories";
import type {
  CompleteUploadInput,
  MediaDto,
  MediaLibraryItem,
  MediaListArgs,
  MediaUsageItem,
  ReplaceMediaInput,
  UpdateMediaInput,
  UploadRequestInput,
  UploadTicket,
} from "@/lib/validation/media";
import type {
  BulkServicesInput,
  BulkServicesResult,
  ServiceDetailDto,
  ServiceInput,
  ServiceListArgs,
  ServiceListItemDto,
} from "@/lib/validation/services";
import type { SlugCheckArgs, SlugCheckResult } from "@/lib/validation/slugs";
import type {
  InviteUserInput,
  UpdateUserInput,
  UserDto,
  UserListArgs,
} from "@/lib/validation/users";

import { baseApi } from "./base-api";
import type { Page } from "./types";

export const adminApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getUsers: build.query<Page<UserDto>, UserListArgs>({
      query: (params) => ({ url: "admin/users", params }),
      providesTags: (result) => [
        { type: "User", id: "LIST" },
        ...(result?.rows ?? []).map((user) => ({ type: "User" as const, id: user.id })),
      ],
    }),
    inviteUser: build.mutation<UserDto, InviteUserInput>({
      query: (body) => ({ url: "admin/users", method: "POST", body }),
      invalidatesTags: [{ type: "User", id: "LIST" }],
    }),
    updateUser: build.mutation<UserDto, UpdateUserInput & { id: string }>({
      query: ({ id, ...body }) => ({ url: `admin/users/${id}`, method: "PATCH", body }),
      async onQueryStarted({ id, role, active }, { dispatch, getState, queryFulfilled }) {
        const patches = adminApi.util.selectCachedArgsForQuery(getState(), "getUsers").map((args) =>
          dispatch(
            adminApi.util.updateQueryData("getUsers", args, (draft) => {
              const user = draft.rows.find((row) => row.id === id);
              if (!user) return;
              if (role !== undefined) user.role = role;
              if (active !== undefined) user.active = active;
            }),
          ),
        );
        try {
          await queryFulfilled;
        } catch {
          for (const patch of patches) patch.undo();
        }
      },
      invalidatesTags: (_result, _error, { id }) => [{ type: "User", id }],
    }),
    resendInvite: build.mutation<void, string>({
      query: (id) => ({ url: `admin/users/${id}/invite`, method: "POST" }),
    }),
    getUnreadBookingCount: build.query<{ count: number }, void>({
      query: () => "admin/booking-requests/unread-count",
      providesTags: [{ type: "BookingRequest", id: "UNREAD" }],
    }),

    getMedia: build.query<Page<MediaLibraryItem>, MediaListArgs>({
      query: ({ kind = "image", unused = false, ...params }) => ({
        url: "admin/media",
        params: { ...params, kind, unused: String(unused) },
      }),
      providesTags: [{ type: "Media", id: "LIST" }],
    }),
    requestUpload: build.mutation<UploadTicket, UploadRequestInput>({
      query: (body) => ({ url: "admin/media/uploads", method: "POST", body }),
    }),
    completeUpload: build.mutation<MediaDto, CompleteUploadInput>({
      query: (body) => ({ url: "admin/media", method: "POST", body }),
      invalidatesTags: [{ type: "Media", id: "LIST" }],
    }),
    updateMedia: build.mutation<MediaDto, UpdateMediaInput & { id: string }>({
      query: ({ id, ...body }) => ({ url: `admin/media/${id}`, method: "PATCH", body }),
      invalidatesTags: [{ type: "Media", id: "LIST" }],
    }),
    getMediaUsage: build.query<MediaUsageItem[], string>({
      query: (id) => `admin/media/${id}/usage`,
      providesTags: (_result, _error, id) => [{ type: "Media", id }],
    }),
    replaceMedia: build.mutation<MediaDto, ReplaceMediaInput & { id: string }>({
      query: ({ id, ...body }) => ({ url: `admin/media/${id}/replace`, method: "POST", body }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Media", id: "LIST" },
        { type: "Media", id },
        { type: "Service", id: "LIST" },
        { type: "Category", id: "LIST" },
        { type: "Master", id: "LIST" },
        { type: "GalleryItem", id: "LIST" },
        { type: "Review", id: "LIST" },
      ],
    }),
    deleteMedia: build.mutation<void, string>({
      query: (id) => ({ url: `admin/media/${id}`, method: "DELETE" }),
      invalidatesTags: [{ type: "Media", id: "LIST" }],
    }),

    getServices: build.query<Page<ServiceListItemDto>, ServiceListArgs>({
      query: (params) => ({ url: "admin/services", params }),
      providesTags: [{ type: "Service", id: "LIST" }],
    }),
    getService: build.query<ServiceDetailDto, string>({
      query: (id) => `admin/services/${id}`,
      providesTags: (_result, _error, id) => [{ type: "Service", id }],
    }),
    createService: build.mutation<{ id: string }, ServiceInput>({
      query: (body) => ({ url: "admin/services", method: "POST", body }),
      invalidatesTags: [
        { type: "Service", id: "LIST" },
        { type: "Category", id: "LIST" },
        { type: "Media", id: "LIST" },
      ],
    }),
    updateService: build.mutation<{ id: string }, ServiceInput & { id: string }>({
      query: ({ id, ...body }) => ({ url: `admin/services/${id}`, method: "PUT", body }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Service", id },
        { type: "Service", id: "LIST" },
        { type: "Category", id: "LIST" },
        { type: "Media", id: "LIST" },
      ],
    }),
    duplicateService: build.mutation<{ id: string }, string>({
      query: (id) => ({ url: `admin/services/${id}/duplicate`, method: "POST" }),
      invalidatesTags: [{ type: "Service", id: "LIST" }],
    }),
    bulkServices: build.mutation<BulkServicesResult, BulkServicesInput>({
      query: (body) => ({ url: "admin/services/bulk", method: "POST", body }),
      invalidatesTags: (_result, _error, { ids }) => [
        { type: "Service", id: "LIST" },
        { type: "Category", id: "LIST" },
        ...ids.map((id) => ({ type: "Service" as const, id })),
      ],
    }),

    getCategories: build.query<CategoryNodeDto[], void>({
      query: () => "admin/categories",
      providesTags: [{ type: "Category", id: "LIST" }],
    }),
    getCategory: build.query<CategoryDetailDto, string>({
      query: (id) => `admin/categories/${id}`,
      providesTags: (_result, _error, id) => [{ type: "Category", id }],
    }),
    createCategory: build.mutation<{ id: string }, CategoryInput>({
      query: (body) => ({ url: "admin/categories", method: "POST", body }),
      invalidatesTags: [{ type: "Category", id: "LIST" }],
    }),
    updateCategory: build.mutation<{ id: string }, CategoryInput & { id: string }>({
      query: ({ id, ...body }) => ({ url: `admin/categories/${id}`, method: "PUT", body }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Category", id },
        { type: "Category", id: "LIST" },
      ],
    }),
    toggleCategory: build.mutation<void, ToggleCategoryInput & { id: string }>({
      query: ({ id, ...body }) => ({ url: `admin/categories/${id}`, method: "PATCH", body }),
      async onQueryStarted({ id, isActive }, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          adminApi.util.updateQueryData("getCategories", undefined, (draft) => {
            const node = draft.find((item) => item.id === id);
            if (node) node.isActive = isActive;
          }),
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
      invalidatesTags: (_result, _error, { id }) => [{ type: "Category", id }],
    }),
    reorderCategories: build.mutation<void, ReorderCategoriesInput>({
      query: (body) => ({ url: "admin/categories/reorder", method: "POST", body }),
      async onQueryStarted({ parentId, orderedIds }, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          adminApi.util.updateQueryData("getCategories", undefined, (draft) => {
            for (const [index, id] of orderedIds.entries()) {
              const node = draft.find((item) => item.id === id);
              if (!node) continue;
              node.parentId = parentId;
              node.sortOrder = index;
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
      invalidatesTags: [{ type: "Category", id: "LIST" }],
    }),
    deleteCategory: build.mutation<void, DeleteCategoryInput & { id: string }>({
      query: ({ id, ...body }) => ({ url: `admin/categories/${id}`, method: "DELETE", body }),
      invalidatesTags: [
        { type: "Category", id: "LIST" },
        { type: "Service", id: "LIST" },
      ],
    }),

    checkSlug: build.query<SlugCheckResult, SlugCheckArgs>({
      query: (params) => ({ url: "admin/slugs", params }),
      keepUnusedDataFor: 5,
    }),
  }),
});

export const {
  useGetUsersQuery,
  useInviteUserMutation,
  useUpdateUserMutation,
  useResendInviteMutation,
  useGetUnreadBookingCountQuery,
  useGetMediaQuery,
  useRequestUploadMutation,
  useCompleteUploadMutation,
  useUpdateMediaMutation,
  useGetMediaUsageQuery,
  useReplaceMediaMutation,
  useDeleteMediaMutation,
  useGetServicesQuery,
  useGetServiceQuery,
  useCreateServiceMutation,
  useUpdateServiceMutation,
  useDuplicateServiceMutation,
  useBulkServicesMutation,
  useGetCategoriesQuery,
  useGetCategoryQuery,
  useCreateCategoryMutation,
  useUpdateCategoryMutation,
  useToggleCategoryMutation,
  useReorderCategoriesMutation,
  useDeleteCategoryMutation,
  useCheckSlugQuery,
} = adminApi;
