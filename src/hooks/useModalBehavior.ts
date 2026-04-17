import { useEffect } from 'react';

/**
 * Standard modal behaviour:
 * - Press Escape to close
 * - Lock body scroll while open (prevents iOS rubber-band behind the modal)
 *
 * Use alongside a fixed overlay + backdrop-click handler.
 */
export function useModalBehavior(isOpen: boolean, onClose: () => void) {
  useEffect(() => {
    if (!isOpen) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);

    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [isOpen, onClose]);
}
