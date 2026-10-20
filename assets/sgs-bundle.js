/*
 * SixthGear Studios: "Complete the set". Adds 2–3 prints to the cart in one request and
 * tells Horizon's cart (drawer, bubble, cart page) through its own CartLinesUpdateEvent,
 * mirroring Horizon's multi-item add in product-form.js.
 */
import { CartLinesUpdateEvent } from '@shopify/events';

if (!customElements.get('sgs-bundle')) {
  customElements.define(
    'sgs-bundle',
    class SgsBundle extends HTMLElement {
      connectedCallback() {
        this.button = this.querySelector('[data-add]');
        this.status = this.querySelector('[data-status]');
        this.querySelectorAll('select[data-variant]').forEach((el) => el.addEventListener('change', () => this.total()));
        this.button?.addEventListener('click', () => this.add());
        this.total();
      }

      get selections() {
        return [...this.querySelectorAll('[data-variant]')].map((el) => {
          const option = el instanceof HTMLSelectElement ? el.selectedOptions[0] : el;
          return { id: Number(el.value), price: Number(option?.dataset.price || 0) };
        });
      }

      formatMoney(cents) {
        const format = this.dataset.moneyFormat || '£{{amount}}';
        const amount = (cents / 100).toFixed(2);
        return format
          .replace(/\{\{\s*amount_no_decimals\s*\}\}/, Math.round(cents / 100).toString())
          .replace(/\{\{\s*amount_with_comma_separator\s*\}\}/, amount.replace('.', ','))
          .replace(/\{\{\s*amount\s*\}\}/, Number(amount).toLocaleString('en-GB', { minimumFractionDigits: 2 }));
      }

      total() {
        const sum = this.selections.reduce((acc, s) => acc + s.price, 0);
        const el = this.querySelector('[data-total]');
        if (el) el.textContent = this.formatMoney(sum);
      }

      async add() {
        if (this.button.getAttribute('aria-busy') === 'true') return;
        const items = this.selections.filter((s) => s.id).map((s) => ({ id: s.id, quantity: 1 }));
        if (!items.length) return;

        this.button.setAttribute('aria-busy', 'true');
        this.status.textContent = '';

        const sectionIds = [...document.querySelectorAll('cart-items-component')]
          .map((el) => el instanceof HTMLElement && el.dataset.sectionId)
          .filter(Boolean);

        const deferred = CartLinesUpdateEvent.createPromise();
        this.dispatchEvent(
          new CartLinesUpdateEvent({
            action: 'add',
            context: 'product',
            lines: items.map((i) => ({ merchandiseId: String(i.id), quantity: i.quantity })),
            promise: deferred.promise,
          })
        );

        try {
          const response = await fetch(window.Theme?.routes?.cart_add_url || '/cart/add.js', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ items, sections: sectionIds.join(',') }),
          });
          const result = await response.json();
          const cart = await (await fetch(`${window.Theme?.routes?.cart_url || '/cart'}.json`)).json();
          const didError = Boolean(result.status);

          deferred.resolve({
            cart: CartLinesUpdateEvent.createCartFromAjaxResponse(cart),
            detail: {
              items: cart.items,
              source: 'sgs-bundle',
              itemCount: items.length,
              sections: didError ? undefined : result.sections,
              didError,
            },
          });

          this.status.textContent = didError
            ? result.description || result.message || 'One of the prints could not be added.'
            : 'The set has been added to your cart.';
        } catch (error) {
          deferred.reject(error);
          this.status.textContent = 'Something went wrong. Please try again.';
        } finally {
          this.button.removeAttribute('aria-busy');
        }
      }
    }
  );
}
