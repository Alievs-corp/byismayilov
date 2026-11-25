import { describe, expect, it } from "vitest";

import { formatPhoneInput, normalizeAzerbaijaniPhone } from "@/lib/phone";
import { bookingSubmissionSchema } from "@/lib/validation/booking-requests";

describe("booking form helpers", () => {
  it("masks phone numbers while typing", () => {
    expect(formatPhoneInput("0552555423")).toBe("055 255 54 23");
    expect(formatPhoneInput("055")).toBe("055");
    expect(formatPhoneInput("+994552555423")).toBe("+994 55 255 54 23");
    expect(formatPhoneInput("994125265423")).toBe("+994 12 526 54 23");
    expect(formatPhoneInput("552555423")).toBe("55 255 54 23");
    expect(formatPhoneInput("+99")).toBe("+99");
    expect(formatPhoneInput("05525554239999")).toBe("055 255 54 23");
  });

  it("produces masked values the server accepts", () => {
    for (const raw of ["0552555423", "+994552555423", "552555423"]) {
      expect(normalizeAzerbaijaniPhone(formatPhoneInput(raw))).toBe("+994552555423");
    }
  });

  it("normalises an empty form into a minimal booking", () => {
    const parsed = bookingSubmissionSchema.parse({
      name: "  Leyla   Əliyeva ",
      phone: "055 255 54 23",
      masterId: "",
      preferredDate: "",
      message: "   ",
    });
    expect(parsed).toEqual({
      name: "Leyla Əliyeva",
      phone: "+994552555423",
      serviceIds: [],
      masterId: null,
      preferredDate: null,
      timeWindow: "any",
      message: null,
      locale: "az",
    });
  });

  it("keeps each chosen service once and caps the list", () => {
    const id = "4b3c8927-766f-4bb4-b8fa-1ab30d83a1fd";
    const base = { name: "Leyla", phone: "0552555423" };
    expect(bookingSubmissionSchema.parse({ ...base, serviceIds: [id, id] }).serviceIds).toEqual([
      id,
    ]);
    const many = Array.from(
      { length: 11 },
      (_, index) => `4b3c8927-766f-4bb4-b8fa-${String(index).padStart(12, "0")}`,
    );
    expect(bookingSubmissionSchema.safeParse({ ...base, serviceIds: many }).success).toBe(false);
  });
});
