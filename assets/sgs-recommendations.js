/*
 * SixthGear Studios — product recommendations.
 * Shows collection-based prints immediately, then swaps in Shopify's
 * recommendations when the section scrolls near the viewport.
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
          const fresh = html.querySelector('[data-sgs-recs-list]');
          const current = this.querySelector('[data-sgs-recs-list]');

          // Keep the fallback if Shopify has no recommendations yet
          if (!fresh || !current || fresh.children.length === 0) return;

          fresh.querySelectorAll('[data-sgs-reveal]').forEach((el) => el.classList.add('is-revealed'));
          current.replaceWith(fresh);
        } catch (error) {
          // Network issues: the fallback list stays in place
        }
      }
    }
  );
}
