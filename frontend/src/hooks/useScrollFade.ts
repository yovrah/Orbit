import { useEffect, useRef, useState } from 'react';

const EPSILON = 4;

/** Tracks whether a scroll container has more content below the fold. Used to
 * show a bottom fade/gradient cue instead of letting the last row end in an
 * abrupt hard cut at the viewport edge, which reads as a clipping bug even
 * though the content is fully reachable by scrolling.
 *
 * Recomputes on scroll and on any DOM mutation inside the container (tab
 * switches, drives/apps streaming in, widgets loading) — a plain
 * ResizeObserver on the scroll container itself wouldn't fire here, since its
 * own box height is fixed and only its *content* (scrollHeight) grows. */
export function useScrollFade<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let raf = 0;
    const update = () => {
      raf = 0;
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < EPSILON;
      setHasMore(el.scrollHeight > el.clientHeight + EPSILON && !atBottom);
    };
    const scheduleUpdate = () => {
      if (raf) return;
      raf = requestAnimationFrame(update);
    };

    update();
    el.addEventListener('scroll', scheduleUpdate, { passive: true });

    const mutationObserver = new MutationObserver(scheduleUpdate);
    mutationObserver.observe(el, { childList: true, subtree: true, characterData: true });

    window.addEventListener('resize', scheduleUpdate);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      el.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
      mutationObserver.disconnect();
    };
  }, []);

  return { ref, hasMore };
}
