import { useEffect, useRef } from 'react';

interface UseTouchpadProps {
  elementRef: React.RefObject<HTMLDivElement | null>;
  sendEvent: (payload: any) => void;
  enabled: boolean;
}

export function useTouchpad({ elementRef, sendEvent, enabled }: UseTouchpadProps) {
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const lastTouchRef = useRef<{ x: number; y: number } | null>(null);
  const lastTapTimeRef = useRef<number>(0);
  const isScrollingRef = useRef(false);

  useEffect(() => {
    const el = elementRef.current;
    if (!el || !enabled) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.cancelable) e.preventDefault();

      const touches = e.touches;
      if (touches.length === 1) {
        const touch = touches[0];
        touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
        lastTouchRef.current = { x: touch.clientX, y: touch.clientY };
        isScrollingRef.current = false;
      } else if (touches.length === 2) {
        isScrollingRef.current = true;
        const t1 = touches[0];
        const t2 = touches[1];
        lastTouchRef.current = {
          x: (t1.clientX + t2.clientX) / 2,
          y: (t1.clientY + t2.clientY) / 2,
        };
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.cancelable) e.preventDefault();

      const touches = e.touches;
      if (touches.length === 1 && !isScrollingRef.current) {
        const touch = touches[0];
        if (lastTouchRef.current) {
          const dx = touch.clientX - lastTouchRef.current.x;
          const dy = touch.clientY - lastTouchRef.current.y;

          // Dispatch relative mouse delta
          sendEvent({
            event: 'mouse_move',
            dx,
            dy,
            accel: true
          });
        }
        lastTouchRef.current = { x: touch.clientX, y: touch.clientY };
      } else if (touches.length === 2 && isScrollingRef.current) {
        const t1 = touches[0];
        const t2 = touches[1];
        const currentMidY = (t1.clientY + t2.clientY) / 2;
        const currentMidX = (t1.clientX + t2.clientX) / 2;

        if (lastTouchRef.current) {
          // Adjust scroll speed multiplier
          const dy = (currentMidY - lastTouchRef.current.y) / 4.0;
          const dx = (currentMidX - lastTouchRef.current.x) / 4.0;

          sendEvent({
            event: 'mouse_scroll',
            dx,
            dy
          });
        }
        lastTouchRef.current = { x: currentMidX, y: currentMidY };
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.cancelable) e.preventDefault();

      const touches = e.changedTouches;
      const start = touchStartRef.current;

      if (start && touches.length === 1 && !isScrollingRef.current) {
        const touch = touches[0];
        const duration = Date.now() - start.time;
        const dist = Math.sqrt(
          Math.pow(touch.clientX - start.x, 2) + Math.pow(touch.clientY - start.y, 2)
        );

        // Define Tap gesture limits
        if (duration < 250 && dist < 10) {
          const now = Date.now();
          const timeSinceLastTap = now - lastTapTimeRef.current;

          if (timeSinceLastTap < 300) {
            // Double Tap -> Double Left Click
            sendEvent({ event: 'mouse_click', button: 'left', type: 'double' });
            lastTapTimeRef.current = 0;
          } else {
            // Single Tap -> Left Click
            sendEvent({ event: 'mouse_click', button: 'left', type: 'click' });
            lastTapTimeRef.current = now;
          }
        }
      } else if (isScrollingRef.current && e.touches.length === 0) {
        isScrollingRef.current = false;
      }

      // Check for Two-Finger Tap (Right Click)
      if (e.touches.length === 0 && e.changedTouches.length === 2) {
        sendEvent({ event: 'mouse_click', button: 'right', type: 'click' });
      }

      touchStartRef.current = null;
      lastTouchRef.current = null;
    };

    el.addEventListener('touchstart', handleTouchStart, { passive: false });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd, { passive: false });

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [elementRef, sendEvent, enabled]);
}
