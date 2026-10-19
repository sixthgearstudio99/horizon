/*
 * SixthGear Studios: size the product gallery slider to the current image on mobile.
 *
 * The gallery uses natural aspect ratios ("adapt"), so slides differ in height.
 * Slides are top-aligned in CSS; here the slider's height follows the visible
 * slide, so portrait and landscape images both show whole with no empty band.
 */
(() => {
  const mobile = window.matchMedia('(max-width: 749px)');

  const visibleSlides = (slides) =>
    [...slides.children].filter((el) => el.matches('slideshow-slide') && !el.hidden);

  const fit = (gallery, slide) => {
    const slides = gallery.querySelector('slideshow-slides');
    if (!slides) return;

    if (!mobile.matches) {
      slides.style.height = '';
      return;
    }

    const component = slides.closest('slideshow-component');
    const target =
      slide ||
      visibleSlides(slides)[Number(component?.current) || 0] ||
      visibleSlides(slides)[0];
    if (!target) return;

    const height = target.getBoundingClientRect().height;
    if (height > 0) slides.style.height = `${Math.round(height)}px`;
  };

  const fitAll = () => document.querySelectorAll('media-gallery').forEach((gallery) => fit(gallery));

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
