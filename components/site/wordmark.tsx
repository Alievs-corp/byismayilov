import { cx } from "@/lib/cx";

export const brandMarkPath =
  "M12.95 12L12 .5 11.05 12ZM12.67 12.67 17.23 6.77 11.33 11.33ZM12 12.95 23.5 12 12 11.05ZM11.33 12.67 17.23 17.23 12.67 11.33ZM11.05 12 12 23.5 12.95 12ZM11.33 11.33 6.77 17.23 12.67 12.67ZM12 11.05.5 12 12 12.95ZM12.67 11.33 6.77 6.77 11.33 12.67Z";

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      fill="currentColor"
      className={cx("brand-mark", className)}
    >
      <path d={brandMarkPath} />
    </svg>
  );
}

export function Wordmark({ name, className }: { name: string; className?: string }) {
  return (
    <span className={cx("wordmark", className)}>
      <BrandMark />
      <span>{name}</span>
    </span>
  );
}
