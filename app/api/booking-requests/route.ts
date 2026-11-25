import { randomUUID } from "node:crypto";

import type { NextRequest } from "next/server";

import { jsonError, validationError } from "@/lib/api/server";
import { clientIp, submitBookingRequest } from "@/lib/booking-requests/submit";
import { bookingHoneypotField, bookingSubmissionSchema } from "@/lib/validation/booking-requests";

function honeypotFilled(body: unknown): boolean {
  if (typeof body !== "object" || body === null || !(bookingHoneypotField in body)) return false;
  const value: unknown = (body as Record<string, unknown>)[bookingHoneypotField];
  if (value === null || value === undefined) return false;
  return typeof value !== "string" || value.trim() !== "";
}

export async function POST(request: NextRequest): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "invalid", "Sorğunun gövdəsi JSON deyil.");
  }
  if (honeypotFilled(body)) return Response.json({ id: randomUUID() }, { status: 201 });

  const parsed = bookingSubmissionSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error.issues);

  const result = await submitBookingRequest(parsed.data, clientIp(request.headers));
  if (result.status === "invalid") {
    return Response.json(
      { error: "invalid", message: "Məlumatlar düzgün deyil.", fields: result.fields },
      { status: 400 },
    );
  }
  if (result.status === "rate-limited") {
    return jsonError(
      429,
      "too-many-requests",
      "Son bir saatda bu ünvandan çox qeydiyyat göndərilib. Bir az sonra yenidən cəhd edin və ya bizə zəng edin.",
    );
  }
  return Response.json({ id: result.id }, { status: 201 });
}
