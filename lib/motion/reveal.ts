import { onScroll, readScroll, reducedMotion } from "./loop";

const revealSelector = "[data-reveal],[data-line-reveal],[data-wordmark],[data-ornament]";

function indexLines(heading: HTMLElement) {
  let line = -1;
  let top = Number.NEGATIVE_INFINITY;
  for (const word of heading.querySelectorAll<HTMLElement>(".lr-w")) {
    if (word.offsetTop > top + 2) {
      line += 1;
      top = word.offsetTop;
    }
    word.style.setProperty("--line", String(line));
  }
}

function groupDelay(element: HTMLElement) {
  const group = element.parentElement;
  if (!group?.hasAttribute("data-reveal-group")) return;
  const siblings = [...group.children].filter((child) => child.hasAttribute("data-reveal"));
  const index = siblings.indexOf(element);
  element.style.setProperty("--reveal-delay", `${Math.min(Math.max(index, 0), 4) * 120}ms`);
}

function hydrated(element: HTMLElement) {
  return Object.keys(element).some((key) => key.startsWith("__reactFiber$"));
}

function reveal(element: HTMLElement) {
  if (element.hasAttribute("data-line-reveal")) indexLines(element);
  groupDelay(element);
  element.setAttribute("data-revealed", "");
}

export function startReveal(root: ParentNode = document) {
  if (reducedMotion()) return () => undefined;

  const tracked = new WeakSet<Element>();
  const waiting = new Set<HTMLElement>();
  const low = new Set<HTMLElement>();
  let frame = 0;
  const flush = () => {
    frame = 0;
    for (const element of waiting) {
      if (!hydrated(element)) continue;
      waiting.delete(element);
      reveal(element);
    }
    if (waiting.size) frame = requestAnimationFrame(flush);
  };
  const queue = (element: HTMLElement) => {
    observer.unobserve(element);
    edge.unobserve(element);
    low.delete(element);
    waiting.add(element);
    if (!frame) flush();
  };
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) queue(entry.target as HTMLElement);
      }
    },
    { rootMargin: "100000px 0px -10% 0px", threshold: 0 },
  );
  const edge = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const element = entry.target as HTMLElement;
      if (entry.isIntersecting) low.add(element);
      else low.delete(element);
    }
  });
  const track = (elements: HTMLElement[]) => {
    const fresh = elements.filter(
      (element) => !tracked.has(element) && !element.hasAttribute("data-revealed"),
    );
    const viewport = window.innerHeight;
    for (const element of fresh) {
      tracked.add(element);
      if (element.getBoundingClientRect().top < viewport && hydrated(element)) {
        element.setAttribute("data-revealed", "");
        continue;
      }
      observer.observe(element);
      edge.observe(element);
    }
  };
  const mutations = new MutationObserver((records) => {
    const added: HTMLElement[] = [];
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        if (node.matches(revealSelector)) added.push(node);
        added.push(...node.querySelectorAll<HTMLElement>(revealSelector));
      }
    }
    if (added.length) track(added);
  });
  const stopScroll = onScroll((y) => {
    if (!low.size) return;
    const end = document.documentElement.scrollHeight - readScroll().viewportHeight - 2;
    if (y >= end) for (const element of [...low]) queue(element);
  });

  const initial = [...root.querySelectorAll<HTMLElement>(revealSelector)];
  let armFrame = 0;
  let attempts = 0;
  const arm = () => {
    armFrame = 0;
    const viewport = window.innerHeight;
    const shown = initial.filter(
      (element) =>
        !element.hasAttribute("data-revealed") && element.getBoundingClientRect().top < viewport,
    );
    if (shown.some((element) => !hydrated(element))) {
      attempts += 1;
      if (attempts < 180) armFrame = requestAnimationFrame(arm);
      return;
    }
    for (const element of shown) {
      tracked.add(element);
      element.setAttribute("data-revealed", "");
    }
    track(initial);
    document.documentElement.setAttribute("data-motion", "");
    mutations.observe(document.body, { childList: true, subtree: true });
  };
  arm();

  return () => {
    observer.disconnect();
    edge.disconnect();
    mutations.disconnect();
    stopScroll();
    cancelAnimationFrame(frame);
    cancelAnimationFrame(armFrame);
  };
}
