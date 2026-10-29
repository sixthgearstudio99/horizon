/*
 * SixthGear Studios — product recommendations ("Complete the wall").
 * Prints from the viewed print's own collection render first, server-side. When the
 * section nears the viewport, Shopify's related prints replace only the shop-wide
 * placeholder slots (data-source="fill"), never the collection prints, with no duplicates.
 */
if (!customElements.get('sgs-recommendations')) {
  customElements.define(
    'sgs-recommendations',
    class SgsRecommendations extends HTMLElement {
      connectedCallback() {
        if (!this.dataset.url) return;

        this.observer = new IntersectionObserver(
          (entries) => {
            if (!entries.some((entry) => entry.isIntersecting)) return;
            this.observer.disconnect();
            this.load();
          },
          { rootMargin: '0px 0px 400px 0px' }
        );
        this.observer.observe(this);
      }

      disconnectedCallback() {
        this.observer?.disconnect();
      }

      async load() {
        try {
          const response = await fetch(this.dataset.url);
          if (!response.ok) return;

          const html = new DOMParser().parseFromString(await response.text(), 'text/html');
          const fresh = [...html.querySelectorAll('[data-sgs-recs-list] > [data-handle]')];
          const list = this.querySelector('[data-sgs-recs-list]');
          if (!list || fresh.length === 0) return; // keep the placeholders

          const placeholders = [...list.querySelectorAll(':scope > [data-source="fill"]')];
          if (placeholders.length === 0) return; // the collection already filled every slot

          const kept = new Set(
            [...list.querySelectorAll(':scope > [data-source="collection"]')].map((el) => el.dataset.handle)
          );
          const replacements = fresh.filter((el) => !kept.has(el.dataset.handle)).slice(0, placeholders.length);
          if (replacements.length === 0) return;

          replacements.forEach((el, i) => {
            el.dataset.source = 'related';
            el.classList.add('is-revealed');
            placeholders[i].replaceWith(document.importNode(el, true));
          });

          // A leftover placeholder may now repeat one of Shopify's suggestions
          const seen = new Set();
          list.querySelectorAll(':scope > [data-handle]').forEach((el) => {
            if (seen.has(el.dataset.handle)) el.remove();
            else seen.add(el.dataset.handle);
          });
        } catch (error) {
          // Network issues: the fallback list stays in place
        }
      }
    }
  );
}
