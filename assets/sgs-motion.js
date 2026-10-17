/*
 * SixthGear Studios — scroll reveal.
 * Adds .is-revealed to [data-sgs-reveal] elements as they enter the viewport.
 * Children of a [data-sgs-reveal-group] are staggered automatically.
 */
(() => {
  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  if (reduceMotion.matches || !('IntersectionObserver' in window)) return;

  root.classList.add('sgs-motion');

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-revealed');
        observer.unobserve(entry.target);
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.12 }
  );

  const init = (scope = document) => {
    scope.querySelectorAll('[data-sgs-reveal-group]').forEach((group) => {
      group.querySelectorAll(':scope [data-sgs-reveal]').forEach((el, index) => {
        el.style.setProperty('--sgs-reveal-index', String(index % 8));
      });
    });

    scope.querySelectorAll('[data-sgs-reveal]:not(.is-revealed)').forEach((el) => observer.observe(el));
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => init());
  } else {
    init();
  }

  // Theme editor: re-run when a section is added or re-rendered
  document.addEventListener('shopify:section:load', (event) => init(event.target));

  // Never leave content hidden if the visitor switches motion preference mid-session
  reduceMotion.addEventListener?.('change', (event) => {
    if (!event.matches) return;
    root.classList.remove('sgs-motion');
  });
})();
