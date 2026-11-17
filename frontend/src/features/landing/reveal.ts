import { useLayoutEffect, type RefObject } from 'react';

/**
 * Fades sections in as they scroll into view. Content stays visible until this runs,
 * so the page still works without JavaScript or with reduced motion.
 */
export function useReveal(root: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const page = root.current;
    if (!page || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    page.querySelectorAll<HTMLElement>('[data-stagger]').forEach(group => {
      Array.from(group.children).forEach((child, index) => {
        child.setAttribute('data-reveal', '');
        (child as HTMLElement).style.setProperty('--d', index * 0.09 + 's');
      });
    });
    const targets = Array.from(page.querySelectorAll<HTMLElement>('[data-reveal]'));
    if (!('IntersectionObserver' in window)) return;
    page.classList.add('lp-js');
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('in');
        observer.unobserve(entry.target);
      }
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    targets.forEach(target => observer.observe(target));
    return () => { observer.disconnect(); page.classList.remove('lp-js'); };
  }, [root]);
}
