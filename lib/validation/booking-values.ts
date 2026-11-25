export const bookingStatuses = ["new", "confirmed", "done", "cancelled"] as const;

export type BookingStatus = (typeof bookingStatuses)[number];

export const bookingTimeWindows = ["any", "morning", "afternoon", "evening"] as const;

export type BookingTimeWindow = (typeof bookingTimeWindows)[number];
