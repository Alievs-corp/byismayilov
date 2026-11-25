import type { MasterDto, MasterInput, MasterServiceOptionDto } from "@/lib/validation/masters";
import type { ReorderInput, ToggleActiveInput } from "@/lib/validation/ordering";

import { baseApi } from "./base-api";

const list = { type: "Master", id: "LIST" } as const;
const mediaList = { type: "Media", id: "LIST" } as const;

export const mastersApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getMasters: build.query<MasterDto[], void>({
      query: () => "admin/masters",
      providesTags: [list],
    }),
    getMasterServiceOptions: build.query<MasterServiceOptionDto[], void>({
      query: () => "admin/masters/service-options",
      providesTags: [{ type: "Service", id: "LIST" }],
    }),
    createMaster: build.mutation<{ id: string }, MasterInput>({
      query: (body) => ({ url: "admin/masters", method: "POST", body }),
      invalidatesTags: [list, mediaList],
    }),
    updateMaster: build.mutation<{ id: string }, MasterInput & { id: string }>({
      query: ({ id, ...body }) => ({ url: `admin/masters/${id}`, method: "PUT", body }),
      invalidatesTags: [list, mediaList],
    }),
    toggleMaster: build.mutation<void, ToggleActiveInput & { id: string }>({
      query: ({ id, ...body }) => ({ url: `admin/masters/${id}`, method: "PATCH", body }),
      async onQueryStarted({ id, isActive }, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          mastersApi.util.updateQueryData("getMasters", undefined, (draft) => {
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
    reorderMasters: build.mutation<void, ReorderInput>({
      query: (body) => ({ url: "admin/masters/reorder", method: "POST", body }),
      async onQueryStarted({ orderedIds }, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          mastersApi.util.updateQueryData("getMasters", undefined, (draft) => {
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
    deleteMaster: build.mutation<void, string>({
      query: (id) => ({ url: `admin/masters/${id}`, method: "DELETE" }),
      invalidatesTags: [list, mediaList],
    }),
  }),
});

export const {
  useGetMastersQuery,
  useGetMasterServiceOptionsQuery,
  useCreateMasterMutation,
  useUpdateMasterMutation,
  useToggleMasterMutation,
  useReorderMastersMutation,
  useDeleteMasterMutation,
} = mastersApi;
