import { cva, type VariantProps } from "class-variance-authority";

export const button = cva(
  "group/button rounded-pill text-button inline-flex min-h-12 shrink-0 items-center justify-center gap-3 px-6 text-center uppercase transition-[background-color,color,border-color,box-shadow] duration-200 ease-standard active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40",
  {
    variants: {
      variant: {
        filled: "bg-ink hover:bg-espresso text-white",
        light: "text-ink shadow-island hover:bg-cream bg-white",
        accent: "text-ink hover:bg-cream bg-white",
        outline: "text-ink border-ink/25 hover:border-ink border",
        ghost: "border border-white/45 text-white hover:border-white",
      },
      size: {
        md: "",
        sm: "min-h-11 px-5",
        lg: "min-h-14 px-8",
      },
    },
    defaultVariants: { variant: "filled", size: "md" },
  },
);

export const buttonArrow =
  "shrink-0 transition-transform duration-200 ease-standard group-hover/button:translate-x-1 group-focus-visible/button:translate-x-1";

export type ButtonVariant = VariantProps<typeof button>["variant"];

export const textLink = cva(
  "group/link text-button inline-flex min-h-11 items-center gap-2 uppercase underline decoration-1 underline-offset-6 transition-[text-decoration-color,color] duration-200 ease-standard",
  {
    variants: {
      tone: {
        ink: "text-ink decoration-ink/40 hover:decoration-ink",
        light: "text-white decoration-white/55 hover:decoration-white",
      },
    },
    defaultVariants: { tone: "ink" },
  },
);

export const arrowControl = cva(
  "rounded-pill inline-flex h-12 w-16 items-center justify-center transition-[background-color,color,opacity] duration-200 ease-standard disabled:cursor-default disabled:opacity-35 sm:h-14 sm:w-20",
  {
    variants: {
      tone: {
        soft: "bg-soft text-ink hover:bg-champagne",
        ink: "bg-ink hover:bg-espresso text-white",
      },
    },
    defaultVariants: { tone: "soft" },
  },
);

export const roundButton = cva(
  "inline-flex size-12 shrink-0 items-center justify-center rounded-full transition-[background-color,color,border-color] duration-200 ease-standard",
  {
    variants: {
      tone: {
        ink: "bg-ink hover:bg-espresso text-white",
        light: "text-ink hover:bg-cream bg-white",
        outline: "text-ink border-ink/20 hover:border-ink border",
      },
    },
    defaultVariants: { tone: "ink" },
  },
);

export const chip = cva(
  "rounded-pill text-micro inline-flex min-h-8 items-center gap-2 px-3.5 whitespace-nowrap",
  {
    variants: {
      tone: {
        white: "text-ink bg-white",
        soft: "text-ink bg-soft",
        ink: "bg-ink text-white",
        outline: "text-ink border-ink/15 border",
      },
    },
    defaultVariants: { tone: "white" },
  },
);

export const card = cva("rounded-card relative overflow-clip", {
  variants: {
    tone: {
      soft: "bg-soft",
      blush: "bg-blush",
      cream: "bg-cream",
      white: "border border-line bg-white",
    },
  },
  defaultVariants: { tone: "soft" },
});
