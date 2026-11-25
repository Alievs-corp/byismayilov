"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";

import { DangerIcon, TickCircleIcon } from "@/components/icons/iconsax";
import { button } from "@/components/site/button";
import {
  choiceChip,
  choiceInput,
  fieldControl,
  fieldLabel,
  selectControl,
  textareaControl,
} from "@/components/site/form-styles";
import type { Locale } from "@/lib/i18n/config";
import { formatPhoneInput } from "@/lib/phone";
import { bookingHoneypotField } from "@/lib/validation/booking-honeypot";

export type BookingFormLabels = {
  name: string;
  phone: string;
  phoneHint: string;
  services: string;
  servicesHint: string;
  noServices: string;
  master: string;
  anyMaster: string;
  date: string;
  time: string;
  timeAny: string;
  timeMorning: string;
  timeAfternoon: string;
  timeEvening: string;
  message: string;
  messagePlaceholder: string;
  submit: string;
  sending: string;
  required: string;
  requiredNote: string;
  errorName: string;
  errorPhone: string;
  errorDate: string;
  errorServices: string;
  errorTooLong: string;
  errorGeneric: string;
  errorRateLimit: string;
  successTitle: string;
  successBody: string;
  again: string;
  honeypot: string;
  formLabel: string;
  stepService: string;
  stepTime: string;
  stepContact: string;
  selected: string;
  consent: string;
  errorConsent: string;
  successServices: string;
  successDate: string;
};

export type BookingServiceGroup = {
  id: string;
  name: string;
  services: { id: string; name: string }[];
};

type Field = "name" | "phone" | "serviceIds" | "masterId" | "preferredDate" | "message" | "consent";

type TimeWindow = "any" | "morning" | "afternoon" | "evening";

type Values = {
  name: string;
  phone: string;
  serviceIds: string[];
  masterId: string;
  preferredDate: string;
  timeWindow: TimeWindow;
  message: string;
  consent: boolean;
};

const loadSchema = () => import("@/lib/validation/booking-requests");

const fieldNames: readonly Field[] = [
  "serviceIds",
  "masterId",
  "preferredDate",
  "name",
  "phone",
  "message",
  "consent",
];

function fieldOf(path: string): Field | null {
  const [head] = path.split(".");
  return fieldNames.find((field) => field === head) ?? null;
}

function fieldMessage(field: Field, labels: BookingFormLabels): string {
  switch (field) {
    case "name":
      return labels.errorName;
    case "phone":
      return labels.errorPhone;
    case "preferredDate":
      return labels.errorDate;
    case "serviceIds":
      return labels.errorServices;
    case "message":
      return labels.errorTooLong;
    case "consent":
      return labels.errorConsent;
    case "masterId":
      return labels.errorGeneric;
  }
}

function FormField({
  id,
  label,
  required,
  requiredLabel,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  requiredLabel: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col">
      <label htmlFor={id} className={fieldLabel}>
        {label}
        {required ? (
          <>
            <span aria-hidden="true"> *</span>
            <span className="sr-only"> ({requiredLabel})</span>
          </>
        ) : null}
      </label>
      {children}
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-ink-muted mt-2 text-small">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-danger mt-2 flex items-center gap-2 text-small">
          <DangerIcon size={16} className="shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function BookingForm({
  locale,
  labels,
  groups,
  masters,
  initialServiceIds,
  initialMasterId,
  minDate,
}: {
  locale: Locale;
  labels: BookingFormLabels;
  groups: BookingServiceGroup[];
  masters: { id: string; name: string }[];
  initialServiceIds: string[];
  initialMasterId: string;
  minDate: string;
}) {
  const uid = useId();
  const initial: Values = {
    name: "",
    phone: "",
    serviceIds: initialServiceIds,
    masterId: initialMasterId,
    preferredDate: "",
    timeWindow: "any",
    message: "",
    consent: false,
  };
  const [values, setValues] = useState<Values>(initial);
  const [honeypot, setHoneypot] = useState("");
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const successRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const sending = status === "sending";
  const id = (field: string) => `${uid}-${field}`;

  useEffect(() => {
    if (status === "sent") successRef.current?.focus();
  }, [status]);

  const update = <K extends keyof Values>(field: K, value: Values[K]) => {
    setValues((current) => ({ ...current, [field]: value }));
    const known = fieldOf(field);
    if (known && errors[known]) setErrors((current) => ({ ...current, [known]: undefined }));
  };

  const toggleService = (serviceId: string, checked: boolean) => {
    update(
      "serviceIds",
      checked
        ? [...values.serviceIds, serviceId]
        : values.serviceIds.filter((value) => value !== serviceId),
    );
  };

  const showErrors = (next: Partial<Record<Field, string>>) => {
    setErrors(next);
    const first = fieldNames.find((field) => next[field]);
    if (first) {
      const element = formRef.current?.querySelector<HTMLElement>(`[data-field="${first}"]`);
      element?.focus();
    }
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (sending) return;
    setFormError(null);
    const { consent, ...submitted } = values;
    const payload = {
      ...submitted,
      masterId: values.masterId || null,
      preferredDate: values.preferredDate || null,
      locale,
      [bookingHoneypotField]: honeypot,
    };
    const { bookingSubmissionSchema } = await loadSchema();
    const parsed = bookingSubmissionSchema.safeParse(payload);
    const next: Partial<Record<Field, string>> = {};
    if (!consent) next.consent = labels.errorConsent;
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = fieldOf(issue.path.join("."));
        if (field) next[field] ??= fieldMessage(field, labels);
      }
    }
    if (Object.keys(next).length) {
      showErrors(next);
      return;
    }
    setStatus("sending");
    try {
      const response = await fetch("/api/booking-requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        setStatus("sent");
        return;
      }
      setStatus("idle");
      if (response.status === 429) {
        setFormError(labels.errorRateLimit);
        return;
      }
      const body = (await response.json().catch(() => null)) as {
        fields?: Record<string, string>;
      } | null;
      const serverErrors: Partial<Record<Field, string>> = {};
      for (const key of Object.keys(body?.fields ?? {})) {
        const field = fieldOf(key);
        if (field) serverErrors[field] ??= fieldMessage(field, labels);
      }
      if (Object.keys(serverErrors).length) showErrors(serverErrors);
      else setFormError(labels.errorGeneric);
    } catch {
      setStatus("idle");
      setFormError(labels.errorGeneric);
    }
  };

  const reset = () => {
    setValues({ ...initial, serviceIds: [], masterId: "" });
    setErrors({});
    setFormError(null);
    setStatus("idle");
  };

  const serviceNames = new Map(
    groups.flatMap((group) => group.services.map((service) => [service.id, service.name] as const)),
  );

  if (status === "sent") {
    const chosen = values.serviceIds.flatMap((serviceId) => serviceNames.get(serviceId) ?? []);
    return (
      <div
        ref={successRef}
        tabIndex={-1}
        role="status"
        data-booking-success=""
        className="flex flex-col items-start gap-5 outline-none"
      >
        <span className="text-caramel-ink inline-flex size-14 items-center justify-center rounded-full bg-white">
          <TickCircleIcon size={32} />
        </span>
        <h2 className="text-h2">{labels.successTitle}</h2>
        <p className="text-ink-muted max-w-xl text-lead">{labels.successBody}</p>
        {chosen.length || values.preferredDate ? (
          <dl className="grid w-full max-w-xl gap-4 border-t border-line pt-5 text-small sm:grid-cols-2">
            {chosen.length ? (
              <div>
                <dt className="text-label text-ink-muted uppercase">{labels.successServices}</dt>
                <dd className="mt-1">{chosen.join(", ")}</dd>
              </div>
            ) : null}
            {values.preferredDate ? (
              <div>
                <dt className="text-label text-ink-muted uppercase">{labels.successDate}</dt>
                <dd className="tabular mt-1">{values.preferredDate}</dd>
              </div>
            ) : null}
          </dl>
        ) : null}
        <button type="button" onClick={reset} className={`${button({ variant: "outline" })} mt-2`}>
          {labels.again}
        </button>
      </div>
    );
  }

  const describedBy = (field: Field, hint?: boolean) =>
    errors[field] ? `${id(field)}-error` : hint ? `${id(field)}-hint` : undefined;

  const timeOptions: { value: TimeWindow; label: string }[] = [
    { value: "any", label: labels.timeAny },
    { value: "morning", label: labels.timeMorning },
    { value: "afternoon", label: labels.timeAfternoon },
    { value: "evening", label: labels.timeEvening },
  ];

  const stepHeading = (index: number, title: string) => (
    <h2 className="text-label text-caramel-ink flex items-center gap-4 border-b border-line pb-3 font-sans uppercase">
      <span className="tabular">{`0${index}`}</span>
      {title}
    </h2>
  );

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={onSubmit}
      aria-label={labels.formLabel}
      data-booking-form=""
      className="flex flex-col gap-10"
    >
      <p className="text-ink-muted text-small">{labels.requiredNote}</p>
      <fieldset
        data-field="serviceIds"
        tabIndex={-1}
        aria-describedby={describedBy("serviceIds", true)}
        className="flex flex-col gap-5 outline-none"
      >
        <legend className="contents">{stepHeading(1, labels.stepService)}</legend>
        {groups.length ? (
          <div className="flex flex-col gap-6">
            {groups.map((group) => (
              <div key={group.id}>
                {group.name ? (
                  <p className="text-ink-muted text-small font-semibold">{group.name}</p>
                ) : null}
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {group.services.map((service) => (
                    <li key={service.id}>
                      <label className={choiceChip}>
                        <input
                          type="checkbox"
                          name="serviceIds"
                          value={service.id}
                          checked={values.serviceIds.includes(service.id)}
                          onChange={(event) => toggleService(service.id, event.target.checked)}
                          className={choiceInput}
                        />
                        {service.name}
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-ink-muted text-small">{labels.noServices}</p>
        )}
        <div aria-live="polite" className="min-h-6">
          {errors.serviceIds ? (
            <p
              id={`${id("serviceIds")}-error`}
              className="text-danger flex items-center gap-2 text-small"
            >
              <DangerIcon size={16} className="shrink-0" />
              {errors.serviceIds}
            </p>
          ) : groups.length ? (
            <p id={`${id("serviceIds")}-hint`} className="text-ink-muted text-small">
              {values.serviceIds.length
                ? labels.selected.replace("{count}", String(values.serviceIds.length))
                : labels.servicesHint}
            </p>
          ) : null}
        </div>
      </fieldset>
      <div className="flex flex-col gap-6">
        {stepHeading(2, labels.stepTime)}
        <div className="grid gap-6 sm:grid-cols-2">
          {masters.length ? (
            <FormField
              id={id("masterId")}
              label={labels.master}
              requiredLabel={labels.required}
              error={errors.masterId}
            >
              <select
                id={id("masterId")}
                name="masterId"
                data-field="masterId"
                value={values.masterId}
                onChange={(event) => update("masterId", event.target.value)}
                aria-invalid={errors.masterId ? true : undefined}
                aria-describedby={describedBy("masterId")}
                className={selectControl}
              >
                <option value="">{labels.anyMaster}</option>
                {masters.map((master) => (
                  <option key={master.id} value={master.id}>
                    {master.name}
                  </option>
                ))}
              </select>
            </FormField>
          ) : null}
          <FormField
            id={id("preferredDate")}
            label={labels.date}
            requiredLabel={labels.required}
            error={errors.preferredDate}
          >
            <input
              id={id("preferredDate")}
              name="preferredDate"
              data-field="preferredDate"
              type="date"
              min={minDate}
              value={values.preferredDate}
              onChange={(event) => update("preferredDate", event.target.value)}
              aria-invalid={errors.preferredDate ? true : undefined}
              aria-describedby={describedBy("preferredDate")}
              className={fieldControl}
            />
          </FormField>
        </div>
        <fieldset>
          <legend className={fieldLabel}>{labels.time}</legend>
          <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {timeOptions.map((option) => (
              <li key={option.value}>
                <label className={choiceChip}>
                  <input
                    type="radio"
                    name="timeWindow"
                    value={option.value}
                    checked={values.timeWindow === option.value}
                    onChange={() => update("timeWindow", option.value)}
                    className={choiceInput}
                  />
                  {option.label}
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      </div>
      <div className="flex flex-col gap-6">
        {stepHeading(3, labels.stepContact)}
        <div className="grid gap-6 sm:grid-cols-2">
          <FormField
            id={id("name")}
            label={labels.name}
            required
            requiredLabel={labels.required}
            error={errors.name}
          >
            <input
              id={id("name")}
              name="name"
              data-field="name"
              autoComplete="name"
              value={values.name}
              onChange={(event) => update("name", event.target.value)}
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={describedBy("name")}
              className={fieldControl}
            />
          </FormField>
          <FormField
            id={id("phone")}
            label={labels.phone}
            required
            requiredLabel={labels.required}
            error={errors.phone}
            hint={labels.phoneHint}
          >
            <input
              id={id("phone")}
              name="phone"
              data-field="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={values.phone}
              onChange={(event) => update("phone", formatPhoneInput(event.target.value))}
              aria-invalid={errors.phone ? true : undefined}
              aria-describedby={describedBy("phone", true)}
              className={fieldControl}
            />
          </FormField>
        </div>
        <FormField
          id={id("message")}
          label={labels.message}
          requiredLabel={labels.required}
          error={errors.message}
        >
          <textarea
            id={id("message")}
            name="message"
            data-field="message"
            rows={4}
            placeholder={labels.messagePlaceholder}
            value={values.message}
            onChange={(event) => update("message", event.target.value)}
            aria-invalid={errors.message ? true : undefined}
            aria-describedby={describedBy("message")}
            className={textareaControl}
          />
        </FormField>
        <div>
          <label className="flex min-h-11 cursor-pointer items-start gap-3 text-small">
            <input
              type="checkbox"
              name="consent"
              data-field="consent"
              checked={values.consent}
              onChange={(event) => update("consent", event.target.checked)}
              aria-invalid={errors.consent ? true : undefined}
              aria-describedby={describedBy("consent")}
              className="accent-ink mt-0.5 size-5 shrink-0"
            />
            <span>
              {labels.consent}
              <span aria-hidden="true"> *</span>
              <span className="sr-only"> ({labels.required})</span>
            </span>
          </label>
          {errors.consent ? (
            <p
              id={`${id("consent")}-error`}
              className="text-danger mt-2 flex items-center gap-2 text-small"
            >
              <DangerIcon size={16} className="shrink-0" />
              {errors.consent}
            </p>
          ) : null}
        </div>
      </div>
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor={id("website")}>{labels.honeypot}</label>
        <input
          id={id("website")}
          name={bookingHoneypotField}
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(event) => setHoneypot(event.target.value)}
        />
      </div>
      {formError ? (
        <p role="alert" className="text-danger flex items-center gap-2">
          <DangerIcon size={16} className="shrink-0" />
          {formError}
        </p>
      ) : null}
      <div>
        <button
          type="submit"
          disabled={sending}
          aria-busy={sending}
          className={button({ size: "lg" })}
        >
          {sending ? labels.sending : labels.submit}
        </button>
      </div>
    </form>
  );
}
