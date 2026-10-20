/*
 * SixthGear Studios: hero background video.
 *
 * The poster image paints first (it is the LCP element). The video file is only
 * requested after the page has loaded, never for reduced-motion or data-saver
 * visitors, uses the smaller mobile file on phones (or none), and pauses when
 * the hero scrolls out of view.
 */
(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = window.matchMedia('(max-width: 749px)');
  const saveData = navigator.connection?.saveData === true;

  const pickSource = (video) => (mobile.matches ? video.dataset.srcMobile : video.dataset.src) || '';

  const start = (video) => {
    const src = pickSource(video);

    if (!src || reduceMotion.matches || saveData) {
      video.pause();
      video.removeAttribute('src');
      video.classList.remove('is-playing');
      video.load();
      return;
    }

    if (video.getAttribute('src') !== src) {
      video.classList.remove('is-playing');
      video.src = src;
    }

    video.muted = true; // required for autoplay
    const attempt = video.play();
    attempt?.catch(() => {
      // Autoplay refused (e.g. low-power mode): the poster image stays
    });
  };

  const init = (video) => {
    if (video.dataset.sgsInit) return;
    video.dataset.sgsInit = 'true';

    video.addEventListener('playing', () => video.classList.add('is-playing'));

    // Only play while the hero is on screen
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) start(video);
        else video.pause();
      },
      { threshold: 0.1 }
    );
    observer.observe(video);

    mobile.addEventListener?.('change', () => start(video));
    reduceMotion.addEventListener?.('change', () => start(video));
  };

  const run = () => {
    const boot = () => document.querySelectorAll('[data-sgs-hero-video]').forEach(init);
    if ('requestIdleCallback' in window) requestIdleCallback(boot, { timeout: 2000 });
    else setTimeout(boot, 200);
  };

  if (document.readyState === 'complete') run();
  else window.addEventListener('load', run, { once: true });

  // Theme editor: re-init when the section re-renders
  document.addEventListener('shopify:section:load', run);
})();
