/*
 * SixthGear Studios: gift note. Saves the note as the cart attribute "Gift note"
 * shortly after typing stops (and when the field loses focus), so it reaches the
 * order whether the shopper checks out from the drawer or the cart page.
 */
(() => {
  if (window.SgsGiftNote) return;
  window.SgsGiftNote = true;

  let timer;
  let lastSaved = null;

  const save = async (field) => {
    const value = field.value.trim();
    if (value === lastSaved) return;
    const status = field.closest('.sgs-gift')?.querySelector('[data-gift-status]');
    if (status) status.textContent = 'Saving…';
    try {
      const response = await fetch(`${window.Theme?.routes?.cart_update_url || '/cart/update'}.js`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ attributes: { 'Gift note': value } }),
      });
      if (!response.ok) throw new Error(String(response.status));
      lastSaved = value;
      // Keep any other copy (drawer and cart page) in step
      document.querySelectorAll('[data-sgs-gift-note]').forEach((el) => {
        if (el !== field) el.value = field.value;
      });
      if (status) status.textContent = value ? 'Saved' : '';
    } catch {
      if (status) status.textContent = 'Not saved, try again';
    }
  };

  document.addEventListener('input', (event) => {
    const field = event.target;
    if (!(field instanceof HTMLTextAreaElement) || !field.matches('[data-sgs-gift-note]')) return;
    clearTimeout(timer);
    timer = setTimeout(() => save(field), 600);
  });

  document.addEventListener(
    'blur',
    (event) => {
      const field = event.target;
      if (field instanceof HTMLTextAreaElement && field.matches('[data-sgs-gift-note]')) {
        clearTimeout(timer);
        save(field);
      }
    },
    true
  );
})();
