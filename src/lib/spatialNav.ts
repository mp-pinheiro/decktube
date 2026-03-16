export function initSpatialNav() {
  const handleKeydown = (e: KeyboardEvent) => {
    const activeEl = document.activeElement as HTMLElement | null;
    const isInputFocused = activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA';
    const isPlayerFocused = activeEl?.id === 'video-player-container';

    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;

    if (!activeEl || activeEl === document.body) {
      const bootstrapTarget = document.querySelector<HTMLElement>(
        '[data-video-id], #video-player-container, main button:not([disabled]), main a[href]:not([tabindex="-1"])'
      );
      if (bootstrapTarget) {
        e.preventDefault();
        bootstrapTarget.focus();
        bootstrapTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        return;
      }
    }

    let currentRect = activeEl && activeEl !== document.body
      ? activeEl.getBoundingClientRect()
      : { left: 0, top: 0, right: window.innerWidth, bottom: 0, width: window.innerWidth, height: 0 };

    if (isInputFocused) {
      if (e.key === 'ArrowDown') {
        activeEl?.blur();
      } else {
        return;
      }
    } else if (isPlayerFocused) {
      return;
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
       e.preventDefault();
    }

    const focusables = Array.from(document.querySelectorAll<HTMLElement>(
      'a[href]:not([tabindex="-1"]), button:not([disabled]):not([tabindex="-1"]), input:not([disabled]):not([tabindex="-1"]), [tabindex="0"]'
    )).filter(el => {
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    });

    let bestMatch: HTMLElement | null = null;
    let minDistance = Infinity;

    for (const el of focusables) {
      if (el === activeEl) continue;
      const rect = el.getBoundingClientRect();
      let dx = 0, dy = 0;
      let valid = false;
      const overlapX = Math.max(0, Math.min(rect.right, currentRect.right) - Math.max(rect.left, currentRect.left));
      const overlapY = Math.max(0, Math.min(rect.bottom, currentRect.bottom) - Math.max(rect.top, currentRect.top));

      if (e.key === 'ArrowRight' && (rect.left >= currentRect.right - 10 || (rect.left > currentRect.left && overlapY > 0))) {
        dx = rect.left - currentRect.right;
        dy = (rect.top + rect.bottom) / 2 - (currentRect.top + currentRect.bottom) / 2;
        valid = true;
      } else if (e.key === 'ArrowLeft' && (rect.right <= currentRect.left + 10 || (rect.right < currentRect.right && overlapY > 0))) {
        dx = currentRect.left - rect.right;
        dy = (rect.top + rect.bottom) / 2 - (currentRect.top + currentRect.bottom) / 2;
        valid = true;
      } else if (e.key === 'ArrowDown' && (rect.top >= currentRect.bottom - 10 || (rect.top > currentRect.top && overlapX > 0))) {
        dy = rect.top - currentRect.bottom;
        dx = (rect.left + rect.right) / 2 - (currentRect.left + currentRect.right) / 2;
        valid = true;
      } else if (e.key === 'ArrowUp' && (rect.bottom <= currentRect.top + 10 || (rect.bottom < currentRect.bottom && overlapX > 0))) {
        dy = currentRect.top - rect.bottom;
        dx = (rect.left + rect.right) / 2 - (currentRect.left + currentRect.right) / 2;
        valid = true;
      }

      if (valid) {
        let distance = 0;
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          distance = dy * dy + dx * dx * 5;
        } else {
          distance = dx * dx + dy * dy * 5;
        }

        if (distance < minDistance) {
          minDistance = distance;
          bestMatch = el;
        }
      }
    }

    if (bestMatch) {
      e.preventDefault();
      bestMatch.focus();
      bestMatch.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  window.addEventListener('keydown', handleKeydown);

  return () => {
    window.removeEventListener('keydown', handleKeydown);
  };
}
