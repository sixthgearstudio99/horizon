/*
 * SixthGear Studios: full-screen product image lightbox.
 * Tap or click a gallery image to open it. Swipe (native scroll snap) or use the arrows / arrow
 * keys to move between images; pinch or double-tap to zoom on touch, click to zoom on desktop;
 * Esc or the close button to close. Built on <dialog>, so focus is trapped and returned.
 * Each image shows the page's copy straight away, then swaps to its 2048px version
 * (data-sgs-full on the gallery media) once that has loaded, for the current image and its
 * neighbours. On phones, a zoom icon sits in the main image's bottom-right corner.
 */
(() => {
  if (window.SgsLightbox) return;

  const MAX_SCALE = 4;
  const TAP_ZOOM = 2.5;

  const el = (tag, cls, attrs = {}) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    return node;
  };

  const icon = (d) => `<svg aria-hidden="true" focusable="false" width="18" height="18" viewBox="0 0 18 18"><path d="${d}" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  class Lightbox {
    constructor() {
      this.dialog = el('dialog', 'sgs-lb', { 'aria-label': 'Product images' });
      this.dialog.innerHTML = `
        <div class="sgs-lb__bar">
          <p class="sgs-lb__count" aria-live="polite"></p>
          <button type="button" class="sgs-lb__close" aria-label="Close">${icon('M4 4l10 10M14 4L4 14')}</button>
        </div>
        <div class="sgs-lb__track"></div>
        <button type="button" class="sgs-lb__nav sgs-lb__nav--prev" aria-label="Previous image">${icon('M11 3L5 9l6 6')}</button>
        <button type="button" class="sgs-lb__nav sgs-lb__nav--next" aria-label="Next image">${icon('M7 3l6 6-6 6')}</button>`;
      document.body.appendChild(this.dialog);

      this.track = this.dialog.querySelector('.sgs-lb__track');
      this.count = this.dialog.querySelector('.sgs-lb__count');
      this.index = 0;
      this.zoom = { scale: 1, x: 0, y: 0 };

      this.dialog.querySelector('.sgs-lb__close').addEventListener('click', () => this.close());
      this.dialog.querySelector('.sgs-lb__nav--prev').addEventListener('click', () => this.go(this.index - 1));
      this.dialog.querySelector('.sgs-lb__nav--next').addEventListener('click', () => this.go(this.index + 1));
      this.dialog.addEventListener('close', () => this.onClose());
      this.dialog.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight') this.go(this.index + 1);
        if (e.key === 'ArrowLeft') this.go(this.index - 1);
      });

      let scrollTimer;
      this.track.addEventListener('scroll', () => {
        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(() => this.syncIndex(), 80);
      }, { passive: true });

      this.bindTouch();
      this.bindMouse();
    }

    /** @param {{src:string, srcset:string, alt:string, w:number, h:number}[]} images */
    open(images, start, opener) {
      this.opener = opener;
      this.images = images;
      this.track.replaceChildren(
        ...images.map((img, i) => {
          const slide = el('figure', 'sgs-lb__slide');
          const image = el('img', 'sgs-lb__img', {
            alt: img.alt || '',
            sizes: '100vw',
            decoding: 'async',
            loading: Math.abs(i - start) <= 1 ? 'eager' : 'lazy',
            draggable: 'false',
          });
          if (img.w && img.h) {
            image.width = img.w;
            image.height = img.h;
          }
          if (img.srcset && !img.full) image.srcset = img.srcset;
          image.src = img.src;
          if (img.full) image.dataset.full = img.full;
          slide.appendChild(image);
          return slide;
        })
      );
      this.dialog.classList.toggle('sgs-lb--single', images.length < 2);
      document.documentElement.classList.add('sgs-lb-open');
      this.dialog.showModal();
      this.go(start, 'instant');
      this.dialog.querySelector('.sgs-lb__close').focus({ preventScroll: true });
    }

    close() {
      this.dialog.close();
    }

    onClose() {
      this.resetZoom();
      document.documentElement.classList.remove('sgs-lb-open');
      this.opener?.focus?.({ preventScroll: true });
    }

    go(i, behavior = 'smooth') {
      const n = this.images?.length || 0;
      if (!n) return;
      this.resetZoom();
      this.index = Math.max(0, Math.min(n - 1, i));
      this.track.scrollTo({ left: this.index * this.track.clientWidth, behavior });
      this.updateCount();
      this.loadFull(this.index);
    }

    /** Swap to the 2048px image once loaded, for this image and its neighbours */
    loadFull(i) {
      [i, i + 1, i - 1].forEach((k) => {
        const image = this.track.children[k]?.querySelector('img');
        const full = image?.dataset.full;
        if (!full || image.dataset.fullLoading) return;
        image.dataset.fullLoading = '1';
        const hi = new Image();
        hi.decoding = 'async';
        hi.src = full;
        const swap = () => {
          image.removeAttribute('srcset');
          image.src = full;
        };
        (hi.decode ? hi.decode() : Promise.reject()).then(swap, () => {
          hi.onload = swap;
        });
      });
    }

    syncIndex() {
      const i = Math.round(this.track.scrollLeft / Math.max(1, this.track.clientWidth));
      if (i !== this.index) {
        this.resetZoom();
        this.index = i;
        this.updateCount();
        this.loadFull(i);
      }
    }

    updateCount() {
      const n = this.images.length;
      this.count.textContent = n > 1 ? `${this.index + 1} / ${n}` : '';
      this.dialog.querySelector('.sgs-lb__nav--prev').disabled = this.index === 0;
      this.dialog.querySelector('.sgs-lb__nav--next').disabled = this.index === n - 1;
    }

    get currentImg() {
      return this.track.children[this.index]?.querySelector('img');
    }

    apply() {
      const img = this.currentImg;
      if (!img) return;
      const { scale, x, y } = this.zoom;
      img.style.transform = scale > 1 ? `translate(${x}px, ${y}px) scale(${scale})` : '';
      this.dialog.classList.toggle('sgs-lb--zoomed', scale > 1);
    }

    resetZoom() {
      this.zoom = { scale: 1, x: 0, y: 0 };
      this.track.querySelectorAll('img').forEach((img) => {
        img.style.transform = '';
        img.style.transformOrigin = '';
      });
      this.dialog.classList.remove('sgs-lb--zoomed');
    }

    /** Keep the zoomed image covering its slide */
    clamp() {
      const img = this.currentImg;
      if (!img) return;
      const { scale } = this.zoom;
      const maxX = (img.offsetWidth * (scale - 1)) / 2;
      const maxY = (img.offsetHeight * (scale - 1)) / 2;
      this.zoom.x = Math.max(-maxX, Math.min(maxX, this.zoom.x));
      this.zoom.y = Math.max(-maxY, Math.min(maxY, this.zoom.y));
    }

    /** Zoom so the point under (cx, cy) stays put */
    zoomAt(cx, cy, scale) {
      const img = this.currentImg;
      if (!img) return;
      const r = img.getBoundingClientRect();
      const ox = cx - (r.left + r.width / 2);
      const oy = cy - (r.top + r.height / 2);
      const k = scale / this.zoom.scale;
      this.zoom.x = ox - (ox - this.zoom.x) * k;
      this.zoom.y = oy - (oy - this.zoom.y) * k;
      this.zoom.scale = scale;
      if (scale <= 1) this.zoom = { scale: 1, x: 0, y: 0 };
      this.clamp();
      this.apply();
    }

    bindTouch() {
      let pinch = null;
      let pan = null;
      let lastTap = 0;

      const dist = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const mid = (a, b) => ({ x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 });

      this.track.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
          const [a, b] = e.touches;
          pinch = { d: dist(a, b), scale: this.zoom.scale, m: mid(a, b) };
          pan = null;
        } else if (e.touches.length === 1) {
          const t = e.touches[0];
          const now = Date.now();
          if (now - lastTap < 280) {
            // Double tap: zoom in at that point, or back out
            this.zoomAt(t.clientX, t.clientY, this.zoom.scale > 1 ? 1 : TAP_ZOOM);
            lastTap = 0;
            e.preventDefault();
            return;
          }
          lastTap = now;
          if (this.zoom.scale > 1) pan = { x: t.clientX, y: t.clientY };
        }
      }, { passive: false });

      this.track.addEventListener('touchmove', (e) => {
        if (pinch && e.touches.length === 2) {
          e.preventDefault();
          const [a, b] = e.touches;
          const scale = Math.max(1, Math.min(MAX_SCALE, pinch.scale * (dist(a, b) / pinch.d)));
          this.zoomAt(pinch.m.x, pinch.m.y, scale);
        } else if (pan && e.touches.length === 1 && this.zoom.scale > 1) {
          e.preventDefault();
          const t = e.touches[0];
          this.zoom.x += t.clientX - pan.x;
          this.zoom.y += t.clientY - pan.y;
          pan = { x: t.clientX, y: t.clientY };
          this.clamp();
          this.apply();
        }
      }, { passive: false });

      this.track.addEventListener('touchend', (e) => {
        if (e.touches.length < 2) pinch = null;
        if (e.touches.length === 0) pan = null;
        if (this.zoom.scale < 1.05) this.resetZoom();
      });
    }

    bindMouse() {
      // Desktop: click an image to zoom in where you clicked, click again to zoom out;
      // while zoomed, the image follows the pointer.
      this.track.addEventListener('click', (e) => {
        if (e.pointerType === 'touch' || !(e.target instanceof HTMLImageElement)) return;
        if (this.zoom.scale > 1) {
          this.resetZoom();
          return;
        }
        const img = e.target;
        const r = img.getBoundingClientRect();
        img.style.transformOrigin = `${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`;
        this.zoom = { scale: TAP_ZOOM, x: 0, y: 0 };
        this.apply();
      });
      this.track.addEventListener('mousemove', (e) => {
        if (this.zoom.scale <= 1 || !(e.target instanceof HTMLImageElement)) return;
        const img = e.target;
        const r = img.getBoundingClientRect();
        const ox = (e.clientX - r.left) / r.width;
        const oy = (e.clientY - r.top) / r.height;
        img.style.transformOrigin = `${Math.max(0, Math.min(1, ox)) * 100}% ${Math.max(0, Math.min(1, oy)) * 100}%`;
      });
    }
  }

  let instance;
  const lightbox = () => (instance ||= new Lightbox());

  /** Unique image media of a gallery, in order */
  const galleryImages = (gallery) => {
    const seen = new Set();
    const out = [];
    gallery.querySelectorAll('.product-media-container--image .product-media').forEach((media) => {
      const id = media.getAttribute('data-media-id') || String(out.length);
      const img = media.querySelector('img');
      if (!img || seen.has(id)) return;
      seen.add(id);
      out.push({ id, src: img.currentSrc || img.src, srcset: img.getAttribute('srcset') || '', full: media.getAttribute('data-sgs-full') || '', alt: img.alt, w: img.naturalWidth || img.width, h: img.naturalHeight || img.height });
    });
    return out;
  };

  document.addEventListener('click', (e) => {
    const target = e.target instanceof Element ? e.target : null;
    const container = target?.closest('[data-sgs-lightbox] .product-media-container--image');
    if (!container || target.closest('button, a, deferred-media, product-model')) return;
    const gallery = container.closest('[data-sgs-lightbox]');
    const images = galleryImages(gallery);
    const id = container.querySelector('.product-media')?.getAttribute('data-media-id');
    const start = Math.max(0, images.findIndex((img) => img.id === id));
    if (!images.length) return;
    e.preventDefault();
    lightbox().open(images, start, container);
  });

  // Keyboard: the image slides are focusable, Enter or Space opens them
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const container = e.target instanceof Element ? e.target.closest('[data-sgs-lightbox] .product-media-container--image') : null;
    if (!container || e.target !== container) return;
    e.preventDefault();
    container.click();
  });

  // Phones: a zoom icon in the main image's bottom-right corner (decorative; tapping the image
  // opens the full-screen view). Hidden while a video or 3D model slide is showing.
  const hintFor = (gallery) => {
    const frame = gallery.querySelector('slideshow-container');
    if (!frame || !gallery.querySelector('.product-media-container--image')) return;
    let hint = frame.querySelector(':scope > .sgs-zoom-hint');
    if (!hint) {
      hint = el('span', 'sgs-zoom-hint', { 'aria-hidden': 'true' });
      hint.innerHTML = '<svg width="16" height="16" viewBox="0 0 18 18" focusable="false"><circle cx="7.5" cy="7.5" r="5.25" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M11.5 11.5L16 16M7.5 5v5M5 7.5h5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
      frame.appendChild(hint);
    }
    return hint;
  };
  const syncHint = (gallery, slide) => {
    const hint = hintFor(gallery);
    if (!hint) return;
    const current = slide || gallery.querySelector('slideshow-slide[aria-hidden="false"]') || gallery.querySelector('slideshow-slide');
    hint.hidden = !!current && !current.classList.contains('product-media-container--image');
  };
  document.addEventListener('slideshow:select', (e) => {
    const gallery = e.target instanceof Element ? e.target.closest('[data-sgs-lightbox]') : null;
    if (gallery) syncHint(gallery, e.detail?.slide);
  });

  // Make each image slide focusable and labelled; repeated when Horizon re-renders the gallery
  const prepare = () => {
    document.querySelectorAll('[data-sgs-lightbox]').forEach((gallery) => {
      syncHint(gallery);
      const containers = [...gallery.querySelectorAll('.product-media-container--image')];
      containers.forEach((c) => {
        if (c.hasAttribute('data-sgs-lb-ready')) return;
        c.setAttribute('data-sgs-lb-ready', '');
        c.setAttribute('role', 'button');
        c.setAttribute('tabindex', '0');
        c.setAttribute('aria-haspopup', 'dialog');
        c.setAttribute('aria-label', 'Open image full screen');
      });
    });
  };
  prepare();
  let pending;
  new MutationObserver(() => {
    clearTimeout(pending);
    pending = setTimeout(prepare, 150);
  }).observe(document.body, { childList: true, subtree: true });

  window.SgsLightbox = { open: (images, start, opener) => lightbox().open(images, start, opener) };
})();
