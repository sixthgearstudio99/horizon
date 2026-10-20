/*
 * SixthGear Studios: timeline arrows (desktop) and drag-to-scroll.
 * Touch devices use native swipe with scroll-snap.
 */
if (!customElements.get('sgs-timeline')) {
  customElements.define(
    'sgs-timeline',
    class SgsTimeline extends HTMLElement {
      #abort = new AbortController();

      connectedCallback() {
        const { signal } = this.#abort;
        const section = this.closest('.sgs-tl');
        this.track = this.querySelector('[data-tl-track]');
        this.nav = section?.querySelector('[data-tl-nav]');
        this.prev = section?.querySelector('[data-tl-prev]');
        this.next = section?.querySelector('[data-tl-next]');
        if (!this.track) return;

        const stepWidth = () => {
          const first = this.track.children[0];
          const gap = parseFloat(getComputedStyle(this.track).columnGap) || 0;
          return first ? first.getBoundingClientRect().width + gap : this.track.clientWidth;
        };

        this.prev?.addEventListener('click', () => this.track.scrollBy({ left: -stepWidth() }), { signal });
        this.next?.addEventListener('click', () => this.track.scrollBy({ left: stepWidth() }), { signal });
        this.track.addEventListener('scroll', () => this.update(), { passive: true, signal });
        window.addEventListener('resize', () => this.update(), { signal });

        // Mouse drag to scroll (desktop)
        let startX = 0;
        let startLeft = 0;
        let dragging = false;
        this.track.addEventListener(
          'pointerdown',
          (e) => {
            if (e.pointerType !== 'mouse') return;
            dragging = true;
            startX = e.clientX;
            startLeft = this.track.scrollLeft;
            this.track.style.scrollSnapType = 'none';
            this.track.style.cursor = 'grabbing';
          },
          { signal }
        );
        window.addEventListener(
          'pointermove',
          (e) => {
            if (!dragging) return;
            this.track.scrollLeft = startLeft - (e.clientX - startX);
          },
          { signal }
        );
        window.addEventListener(
          'pointerup',
          () => {
            if (!dragging) return;
            dragging = false;
            this.track.style.scrollSnapType = '';
            this.track.style.cursor = '';
          },
          { signal }
        );

        this.update();
      }

      disconnectedCallback() {
        this.#abort.abort();
      }

      update() {
        const t = this.track;
        const overflow = t.scrollWidth - t.clientWidth > 4;
        if (this.nav) this.nav.hidden = !overflow;
        if (this.prev) this.prev.disabled = t.scrollLeft <= 2;
        if (this.next) this.next.disabled = t.scrollLeft >= t.scrollWidth - t.clientWidth - 2;
      }
    }
  );
}
