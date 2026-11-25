"use client";

import { useEffect, useRef } from "react";

export function TokenValue({ name }: { name: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.textContent = getComputedStyle(document.documentElement)
        .getPropertyValue(name)
        .trim();
    }
  }, [name]);
  return <span ref={ref} className="tabular" />;
}
