/*
 * SixthGear Studios: size the product gallery slider to the current image on mobile.
 *
 * The gallery uses natural aspect ratios ("adapt"), so slides differ in height.
 * Slides are top-aligned in CSS; here the slider's height follows the visible
 * slide, so portrait and landscape images both show whole with no empty band.
 *
 * The height is set on the outer slideshow-container, which clips, never on the
 * scrolling slideshow-slides: Horizon's swipe tracking only counts a slide as
 * visible when most of it fits inside the scroller, so shrinking the scroller to
 * a short landscape image made a taller portrait slide "invisible" and the swipe
 * back to it was ignored (stuck counter, cropped image until tapped).
 */
(() => {
  const mobile = window.matchMedia('(max-width: 749px)');

  const visibleSlides = (slides) =>
    [...slides.children].filter((el) => el.matches('slideshow-slide') && !el.hidden);

  const fit = (gallery, slide) => {
    const slides = gallery.querySelector('slideshow-slides');
    if (!slides) return;

    const frame = slides.closest('slideshow-container') || slides;

    if (!mobile.matches) {
      frame.style.height = '';
      return;
    }

    // The slide actually on screen, measured from the scroll position, so the height
    // is right even if Horizon's slide index lags behind a fast swipe
    const left = slides.getBoundingClientRect().left;
    const onScreen = visibleSlides(slides).reduce(
      (best, el) =>
        !best || Math.abs(el.getBoundingClientRect().left - left) < Math.abs(best.getBoundingClientRect().left - left)
          ? el
          : best,
      null
    );
    const target = onScreen || slide;
    if (!target) return;

    const height = target.getBoundingClientRect().height;
    if (height > 0) frame.style.height = `${Math.round(height)}px`;
  };

  const fitAll = () => document.querySelectorAll('media-gallery').forEach((gallery) => fit(gallery));

  // Re-fit once a swipe settles, independently of Horizon's slide index
  let scrollTimer;
  document.addEventListener(
    'scroll',
    (event) => {
      const slides = event.target;
      if (!(slides instanceof Element) || !slides.matches('media-gallery slideshow-slides')) return;
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => fit(slides.closest('media-gallery')), 120);
    },
    { capture: true, passive: true }
  );

  document.addEventListener('slideshow:select', (event) => {
    const gallery = event.target instanceof Element && event.target.closest('media-gallery');
    if (gallery) fit(gallery, event.detail?.slide);
  });

  // Variant changes can swap the gallery's images
  document.addEventListener('shopify:product:select', (event) => {
    Promise.resolve(event.promise)
      .catch(() => {})
      .then(() => requestAnimationFrame(fitAll));
  });

  let resizeFrame;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(fitAll);
  });
  mobile.addEventListener?.('change', fitAll);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fitAll);
  } else {
    fitAll();
  }
  window.addEventListener('load', fitAll);
})();
