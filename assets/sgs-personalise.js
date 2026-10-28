/*
 * SixthGear Studios: personalisation form for custom prints.
 *
 * The fields live outside Horizon's product <form> and join it through the
 * `form` attribute, so Horizon's own add-to-cart (new FormData(form) posted as
 * multipart to /cart/add) sends them as line item properties, files included.
 *
 * This script:
 *  - validates required fields and photos, and keeps Add to cart locked until valid
 *  - intercepts submit (capture phase, before Horizon) to block incomplete adds
 *  - drops empty optional fields from the request
 *  - waits for an in-flight size change, so Horizon never uses its JSON queue
 *    path (which can't carry properties or files)
 */
if (!customElements.get('sgs-personalise')) {
  customElements.define(
    'sgs-personalise',
    class SgsPersonalise extends HTMLElement {
      #abort = new AbortController();
      #pendingVariant = null;
      #attempted = false;

      connectedCallback() {
        this.formId = this.dataset.formId;
        this.maxBytes = (Number(this.dataset.maxMb) || 20) * 1024 * 1024;
        this.textInputs = [...this.querySelectorAll('.sgs-pers__input')];
        this.photoInputs = [...this.querySelectorAll('[data-photo]')];
        const { signal } = this.#abort;

        for (const input of this.textInputs) {
          input.addEventListener('input', () => this.#onTextInput(input), { signal });
          input.addEventListener('blur', () => this.#attempted && this.#validateText(input), { signal });
          this.#updateCounter(input);
        }

        for (const input of this.photoInputs) {
          input.addEventListener('change', () => this.#onPhotoChange(input), { signal });
          const tile = input.closest('[data-tile]');
          tile
            ?.querySelector('[data-remove]')
            ?.addEventListener('click', () => this.#clearPhoto(input, true), { signal });
        }

        // Use our inline errors instead of the browser's bubbles. Set on load and again
        // just before any click, in case Horizon re-rendered the form in between.
        this.#disableNativeValidation();
        document.addEventListener(
          'click',
          (event) => {
            const button = event.target instanceof Element && event.target.closest('button, [type="submit"]');
            if (button && (button.form?.getAttribute('id') === this.formId || button.closest(`#${CSS.escape(this.formId)}`))) {
              this.#disableNativeValidation();
            }
          },
          { capture: true, signal }
        );

        // Intercept the product form's submit before Horizon's handler sees it
        document.addEventListener('submit', this.#onSubmit, { capture: true, signal });

        // Track size changes so we never submit mid-update
        const section = this.closest('.shopify-section') || document;
        section.addEventListener(
          'shopify:product:select',
          (event) => {
            const promise = Promise.resolve(event.promise).catch(() => {});
            this.#pendingVariant = promise;
            promise.finally(() => {
              if (this.#pendingVariant === promise) this.#pendingVariant = null;
            });
          },
          { signal }
        );

        // Live name plate preview of the Headline
        this.plate = this.querySelector('[data-plate]');
        this.headline = this.querySelector('input[name="properties[Headline]"]');
        if (this.plate && this.headline) {
          this.headline.addEventListener('input', () => this.#syncPlate(), { signal });
          window.addEventListener('resize', () => this.#fitPlate(), { signal });
          this.#syncPlate();
        }

        this.#syncLock();
      }

      disconnectedCallback() {
        this.#abort.abort();
        document.body.classList.remove('sgs-pers-locked');
      }

      #disableNativeValidation() {
        const form = this.form;
        if (form) form.noValidate = true;
      }

      get form() {
        return document.getElementById(this.formId);
      }

      /* ---------- Headline preview ---------- */

      #syncPlate() {
        const text = this.headline.value.trim();
        this.plate.textContent = text || this.plate.dataset.platePlaceholder || '';
        this.plate.classList.toggle('is-placeholder', !text);
        this.#fitPlate();
      }

      /** Shrinks the preview text (26px down to 14px) to keep it on one line; wraps only if it still won't fit */
      #fitPlate() {
        const plate = this.plate;
        let size = 26;
        plate.classList.remove('is-wrapped');
        plate.style.setProperty('--sgs-plate-size', `${size}px`);
        while (size > 14 && plate.scrollWidth > plate.clientWidth) {
          size -= 1;
          plate.style.setProperty('--sgs-plate-size', `${size}px`);
        }
        plate.classList.toggle('is-wrapped', plate.scrollWidth > plate.clientWidth);
      }

      /* ---------- Text fields ---------- */

      #onTextInput(input) {
        this.#updateCounter(input);
        if (this.#attempted || input.getAttribute('aria-invalid') === 'true') this.#validateText(input);
        this.#syncLock();
      }

      #updateCounter(input) {
        if (!input.hasAttribute('data-count')) return;
        const counter = input.closest('[data-field]')?.querySelector('[data-counter]');
        if (counter) counter.textContent = `${input.value.length}/${input.maxLength}`;
      }

      #textError(input) {
        const value = input.value.trim();
        if (input.required && !value) return 'Please fill this in.';
        if (input.maxLength > 0 && input.value.length > input.maxLength) return `Keep it to ${input.maxLength} characters.`;
        return '';
      }

      #validateText(input) {
        const message = this.#textError(input);
        const error = input.closest('[data-field]')?.querySelector('[data-error]');
        if (error) error.textContent = message;
        input.setAttribute('aria-invalid', message ? 'true' : 'false');
        return !message;
      }

      /* ---------- Photos ---------- */

      #onPhotoChange(input) {
        const file = input.files?.[0];
        const errorEl = this.querySelector('[data-photo-error]');

        if (!file) {
          this.#clearPhoto(input, false);
          return;
        }

        if (!file.type.startsWith('image/') && !/\.(heic|heif)$/i.test(file.name)) {
          this.#clearPhoto(input, false);
          if (errorEl) errorEl.textContent = 'Please choose an image file (JPG, PNG or HEIC).';
          return;
        }

        if (file.size > this.maxBytes) {
          this.#clearPhoto(input, false);
          if (errorEl) errorEl.textContent = `That photo is over ${Math.round(this.maxBytes / 1048576)} MB. Please choose a smaller one.`;
          return;
        }

        if (errorEl) errorEl.textContent = '';
        this.#showPreview(input, file);
        this.#syncLock();
      }

      #showPreview(input, file) {
        const tile = input.closest('[data-tile]');
        if (!tile) return;
        const preview = tile.querySelector('[data-preview]');
        const filename = tile.querySelector('[data-filename]');
        const remove = tile.querySelector('[data-remove]');

        tile.setAttribute('data-filled', '');
        tile.removeAttribute('data-invalid');
        remove.hidden = false;

        if (preview.src) URL.revokeObjectURL(preview.src);
        preview.hidden = false;
        filename.hidden = true;
        preview.onerror = () => {
          // e.g. HEIC in browsers that can't preview it: show the file name instead
          preview.hidden = true;
          filename.textContent = file.name;
          filename.hidden = false;
        };
        preview.src = URL.createObjectURL(file);
      }

      #clearPhoto(input, focus) {
        input.value = '';
        const tile = input.closest('[data-tile]');
        if (tile) {
          const preview = tile.querySelector('[data-preview]');
          if (preview.src) URL.revokeObjectURL(preview.src);
          preview.removeAttribute('src');
          preview.hidden = true;
          tile.querySelector('[data-filename]').hidden = true;
          tile.querySelector('[data-remove]').hidden = true;
          tile.removeAttribute('data-filled');
        }
        if (focus) input.focus();
        this.#syncLock();
      }

      #photosValid() {
        return this.photoInputs.some((input) => input.files && input.files.length > 0);
      }

      /* ---------- Lock + submit ---------- */

      #isComplete() {
        return this.textInputs.every((input) => !this.#textError(input)) && this.#photosValid();
      }

      #syncLock() {
        // Photo 1 is required only until a photo is added in any tile; keeping the
        // attribute accurate lets Horizon's checkValidity() gate its add animation
        const [firstPhoto] = this.photoInputs;
        if (firstPhoto) firstPhoto.required = !this.#photosValid();

        document.body.classList.toggle('sgs-pers-locked', !this.#isComplete());
        const status = this.querySelector('[data-status]');
        if (status && this.#isComplete()) status.textContent = '';
      }

      #showAllErrors() {
        this.#attempted = true;
        let firstInvalid = null;

        for (const input of this.textInputs) {
          if (!this.#validateText(input) && !firstInvalid) firstInvalid = input;
        }

        if (!this.#photosValid()) {
          const first = this.photoInputs[0];
          first.closest('[data-tile]')?.setAttribute('data-invalid', '');
          const errorEl = this.querySelector('[data-photo-error]');
          if (errorEl) errorEl.textContent = 'Please add at least one photo of your car.';
          if (!firstInvalid) firstInvalid = first;
        }

        const status = this.querySelector('[data-status]');
        if (status) status.textContent = 'Please complete the personalisation details above.';

        if (firstInvalid) {
          firstInvalid.closest('[data-field], [data-photos]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          firstInvalid.focus({ preventScroll: true });
        }
      }

      #onSubmit = (event) => {
        const form = event.target;
        // Note: form.id is shadowed by the product form's <input name="id">, so read the attribute
        if (!(form instanceof HTMLFormElement) || form.getAttribute('id') !== this.formId) return;

        // Our own validation replaces the browser's bubbles
        form.noValidate = true;

        if (!this.#isComplete()) {
          event.preventDefault();
          event.stopImmediatePropagation();
          this.#showAllErrors();
          return;
        }

        // A size change is still loading: wait, then submit through Horizon's normal path
        if (this.#pendingVariant) {
          event.preventDefault();
          event.stopImmediatePropagation();
          const submitter = event.submitter;
          this.#pendingVariant.then(() => form.requestSubmit(submitter || undefined));
          return;
        }

        // Leave empty optional fields out of the request
        const skipped = [];
        for (const el of [...this.textInputs, ...this.photoInputs]) {
          const empty = el.type === 'file' ? !el.files?.length : !el.value.trim();
          if (empty && !el.required) {
            el.disabled = true;
            skipped.push(el);
          }
        }
        // Horizon builds its FormData synchronously in its submit handler; re-enable after
        setTimeout(() => skipped.forEach((el) => (el.disabled = false)), 0);
      };
    }
  );
}
