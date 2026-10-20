/*
 * SixthGear Studios: "See it on your wall".
 * Parses print dimensions from variant names and draws the print to scale
 * above a 210 cm sofa on a wall of `data-wall-cm` centimetres.
 */
if (!customElements.get('sgs-wall-preview')) {
  const SOFA_CM = { width: 210, height: 85 };
  const GAP_ABOVE_SOFA_CM = 25;
  const FLOOR_SHARE = 0.1; // bottom 10% of the room is floor
  const CEILING_CM = 250;
  const A_SIZES = { a0: [84.1, 118.9], a1: [59.4, 84.1], a2: [42, 59.4], a3: [29.7, 42], a4: [21, 29.7], a5: [14.8, 21] };
  const UNIT_TO_CM = { cm: 1, mm: 0.1, in: 2.54, inch: 2.54, inches: 2.54, '"': 2.54 };

  /**
   * Dimensions as written in the variant name, converted to cm.
   * @returns {{a:number,b:number,unit:'in'|'cm'}|null} a = first number written, b = second
   */
  const parseSize = (text) => {
    if (!text) return null;
    const s = String(text)
      .toLowerCase()
      .replace(/[″”“]|''/g, '"')
      .replace(/[×✕]/g, 'x');

    const m = s.match(/(\d+(?:\.\d+)?)\s*(cm|mm|inches|inch|in|")?\s*x\s*(\d+(?:\.\d+)?)\s*(cm|mm|inches|inch|in|")?/);
    if (m) {
      const unit = m[4] || m[2] || 'in';
      const f = UNIT_TO_CM[unit] ?? 2.54;
      const a = parseFloat(m[1]) * f;
      const b = parseFloat(m[3]) * f;
      if (a > 0 && b > 0) return { a, b, unit: f === 2.54 ? 'in' : 'cm' };
    }

    const a = s.match(/\ba([0-5])\b/);
    if (a) {
      const [short, long] = A_SIZES[`a${a[1]}`];
      return { a: short, b: long, unit: 'cm', named: true };
    }
    return null;
  };

  /** 'portrait' | 'landscape' | null, from words such as (Vertical) or (Landscape) */
  const orientationOf = (text) => {
    const s = String(text || '').toLowerCase();
    if (/\b(vertical|portrait)\b/.test(s)) return 'portrait';
    if (/\b(horizontal|landscape)\b/.test(s)) return 'landscape';
    return null;
  };

  /**
   * Print size for a variant. Orientation comes from the variant name first:
   * portrait/vertical -> tall, landscape/horizontal -> wide; otherwise the first
   * dimension written is the width.
   */
  const sizeOfVariant = (variant) => {
    if (!variant) return null;
    let size = null;
    let label = '';
    for (const value of variant.options || []) {
      size = parseSize(value);
      if (size) {
        label = value;
        break;
      }
    }
    if (!size) {
      size = parseSize(variant.title);
      label = variant.title;
    }
    if (!size) return null;

    const orientation = orientationOf(label) || orientationOf(variant.title);
    const long = Math.max(size.a, size.b);
    const short = Math.min(size.a, size.b);
    let w = size.a;
    let h = size.b;
    if (orientation === 'portrait') [w, h] = [short, long];
    if (orientation === 'landscape') [w, h] = [long, short];

    // A-sizes have no written order: describe them the way they hang
    if (size.named) return { ...size, a: w, b: h, w, h, orientation, label };
    return { ...size, w, h, orientation, label };
  };

  const fmt = (n) => (Math.round(n * 10) / 10).toString();

  customElements.define(
    'sgs-wall-preview',
    class SgsWallPreview extends HTMLElement {
      #abort = new AbortController();

      connectedCallback() {
        const { signal } = this.#abort;
        try {
          this.variants = JSON.parse(this.querySelector('[data-variants]')?.textContent || '[]');
        } catch {
          this.variants = [];
        }
        this.wallCm = Number(this.dataset.wallCm) || 300;
        this.dialog = this.querySelector('[data-dialog]');
        this.room = this.querySelector('[data-room]');
        this.print = this.querySelector('[data-print]');
        this.sofa = this.querySelector('[data-sofa]');

        // Unique sizes, in variant order
        this.sizes = [];
        const seen = new Set();
        for (const v of this.variants) {
          const size = sizeOfVariant(v);
          if (!size || seen.has(size.label)) continue;
          seen.add(size.label);
          this.sizes.push(size);
        }
        if (!this.sizes.length) return; // nothing to show: button stays hidden

        this.querySelector('[data-open]').hidden = false;
        this.querySelector('[data-open]').addEventListener('click', () => this.open(), { signal });
        this.querySelector('[data-close]').addEventListener('click', () => this.dialog.close(), { signal });
        this.dialog.addEventListener(
          'click',
          (e) => {
            if (e.target === this.dialog) this.dialog.close();
          },
          { signal }
        );

        // Follow size changes on the product form
        document.addEventListener(
          'change',
          (e) => {
            if (e.target instanceof Element && e.target.closest('variant-picker, .variant-picker')) {
              requestAnimationFrame(() => this.sync());
            }
          },
          { signal }
        );
        const section = this.closest('.shopify-section') || document;
        section.addEventListener(
          'shopify:product:select',
          (e) => Promise.resolve(e.promise).catch(() => {}).then(() => this.sync()),
          { signal }
        );

        window.addEventListener('resize', () => this.dialog.open && this.render(), { signal });
        this.sync();
      }

      disconnectedCallback() {
        this.#abort.abort();
      }

      /** The currently selected variant on the product form */
      get selectedVariant() {
        const form = document.getElementById(this.dataset.formId);
        const id = Number(form?.querySelector('input[name="id"]')?.value);
        return this.variants.find((v) => v.id === id) || this.variants[0];
      }

      sync() {
        const current = sizeOfVariant(this.selectedVariant);
        this.currentLabel = current?.label;
        if (!this.previewLabel || !this.dialog.open) this.previewLabel = this.currentLabel;
        const openSize = this.querySelector('[data-open-size]');
        if (openSize) openSize.textContent = current ? `· ${current.label}` : '';
        if (this.dialog.open) {
          this.previewLabel = this.currentLabel;
          this.renderChips();
          this.render();
        }
      }

      open() {
        const img = this.print.querySelector('img');
        if (img && !img.src) img.src = img.dataset.src; // load the artwork only when needed
        this.previewLabel = this.currentLabel || this.sizes[0].label;
        this.renderChips();
        this.dialog.showModal();
        this.render();
      }

      renderChips() {
        const wrap = this.querySelector('[data-sizes]');
        wrap.replaceChildren(
          ...this.sizes.map((size) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'sgs-wall__size';
            b.setAttribute('aria-pressed', String(size.label === this.previewLabel));
            b.textContent = size.label;
            if (size.label === this.currentLabel) {
              const tag = document.createElement('span');
              tag.className = 'sgs-wall__size-current';
              tag.textContent = 'Selected';
              b.append(tag);
            }
            b.addEventListener('click', () => {
              this.previewLabel = size.label;
              this.renderChips();
              this.render();
            });
            return b;
          })
        );
      }

      render() {
        const size = this.sizes.find((s) => s.label === this.previewLabel) || this.sizes[0];
        const roomW = this.room.clientWidth;
        const roomH = this.room.clientHeight;
        if (!roomW || !roomH) return;

        const floorPx = roomH * FLOOR_SHARE;
        // Show at least the chosen wall width and a 2.5 m ceiling, at one uniform scale
        const pxPerCm = Math.min(roomW / this.wallCm, (roomH - floorPx) / CEILING_CM);

        // Orientation and dimensions come from the variant name (see sizeOfVariant)
        const wCm = size.w;
        const hCm = size.h;

        // Sofa
        this.sofa.style.width = `${SOFA_CM.width * pxPerCm}px`;
        this.sofa.style.height = `${SOFA_CM.height * pxPerCm}px`;

        // Print: centred over the sofa, 25 cm above it, kept below the ceiling
        let bottom = floorPx + (SOFA_CM.height + GAP_ABOVE_SOFA_CM) * pxPerCm;
        const maxBottom = roomH - 8 - hCm * pxPerCm;
        bottom = Math.max(floorPx + 8, Math.min(bottom, maxBottom));
        this.print.style.width = `${wCm * pxPerCm}px`;
        this.print.style.height = `${hCm * pxPerCm}px`;
        this.print.style.bottom = `${bottom}px`;

        // Caption keeps the dimensions in the order written in the variant name
        const cm = `${fmt(size.a)} × ${fmt(size.b)} cm`;
        const inches = `${fmt(size.a / 2.54)} × ${fmt(size.b / 2.54)} in`;
        this.querySelector('[data-caption]').textContent =
          `${size.label}: ${size.unit === 'in' ? `${inches} (${cm})` : `${cm} (${inches})`}. ` +
          `Shown to scale above a ${SOFA_CM.width} cm sofa.`;
        this.querySelector('[data-scale-label]').textContent = `Wall shown ${(roomW / pxPerCm / 100).toFixed(1)} m wide`;
      }
    }
  );

  // Exposed for testing
  window.SgsWallPreviewParse = parseSize;
  window.SgsWallPreviewSize = sizeOfVariant;
}
