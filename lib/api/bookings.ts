import type {
  BookingRequestDetailDto,
  BookingRequestFilters,
  BookingRequestListArgs,
  BookingRequestListItemDto,
  UpdateBookingRequestInput,
} from "@/lib/validation/booking-requests";

import { baseApi } from "./base-api";
import type { Page } from "./types";

const listAndUnread = [
  { type: "BookingRequest" as const, id: "LIST" },
  { type: "BookingRequest" as const, id: "UNREAD" },
];

export const bookingsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getBookings: build.query<Page<BookingRequestListItemDto>, BookingRequestListArgs>({
      query: (params) => ({ url: "admin/booking-requests", params }),
      providesTags: (result) => [
        { type: "BookingRequest", id: "LIST" },
        ...(result?.rows ?? []).map((row) => ({ type: "BookingRequest" as const, id: row.id })),
      ],
    }),
    getBooking: build.query<BookingRequestDetailDto, string>({
      query: (id) => `admin/booking-requests/${id}`,
      providesTags: (_result, _error, id) => [{ type: "BookingRequest", id }],
      async onQueryStarted(_id, { dispatch, queryFulfilled }) {
        const result = await queryFulfilled.catch(() => null);
        if (result?.data.markedSeen) dispatch(baseApi.util.invalidateTags(listAndUnread));
      },
    }),
    updateBooking: build.mutation<
      BookingRequestDetailDto,
      UpdateBookingRequestInput & { id: string }
    >({
      query: ({ id, ...body }) => ({
        url: `admin/booking-requests/${id}`,
        method: "PATCH",
        body,
      }),
      async onQueryStarted({ id }, { dispatch, queryFulfilled }) {
        const result = await queryFulfilled.catch(() => null);
        if (result) dispatch(bookingsApi.util.upsertQueryData("getBooking", id, result.data));
      },
      invalidatesTags: (result) => (result ? listAndUnread : []),
    }),
    deleteBooking: build.mutation<void, string>({
      query: (id) => ({ url: `admin/booking-requests/${id}`, method: "DELETE" }),
      invalidatesTags: (_result, error) => (error ? [] : listAndUnread),
    }),
  }),
});

export const {
  useGetBookingsQuery,
  useGetBookingQuery,
  useUpdateBookingMutation,
  useDeleteBookingMutation,
} = bookingsApi;

export function bookingsExportHref(filters: BookingRequestFilters): string {
  const params = new URLSearchParams();
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.search) params.set("search", filters.search);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  const query = params.toString();
  return `/api/admin/booking-requests/export${query ? `?${query}` : ""}`;
}
