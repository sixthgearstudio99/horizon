/*
 * SixthGear Studios: Christmas cut-off banner.
 * The cut-off is entered as a UK date and time (the same date the message shows);
 * the banner hides once it has passed.
 */
if (!customElements.get('sgs-countdown')) {
  /** Minutes Europe/London is ahead of UTC at a given instant (0 in GMT, 60 in BST) */
  const londonOffset = (date) => {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/London',
        hourCycle: 'h23',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
        .formatToParts(date)
        .map((p) => [p.type, p.value])
    );
    const asUTC = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
    return Math.round((asUTC - date.getTime()) / 60000);
  };

  /** UK wall-clock date + time -> exact instant */
  const ukInstant = (dateStr, timeStr) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const [hh, mm] = (timeStr || '23:59').split(':').map(Number);
    if (!y || !m || !d) return null;
    const guess = Date.UTC(y, m - 1, d, hh || 0, mm || 0);
    return new Date(guess - londonOffset(new Date(guess)) * 60000);
  };

  const pad = (n) => String(n).padStart(2, '0');

  customElements.define(
    'sgs-countdown',
    class SgsCountdown extends HTMLElement {
      connectedCallback() {
        this.cutoff = ukInstant(this.dataset.date, this.dataset.time);
        this.timer = this.querySelector('[data-timer]');
        if (!this.cutoff) return;
        this.tick();
        this.interval = setInterval(() => this.tick(), 1000);
      }

      disconnectedCallback() {
        clearInterval(this.interval);
      }

      tick() {
        const ms = this.cutoff.getTime() - Date.now();
        if (ms <= 0) {
          this.hidden = true;
          clearInterval(this.interval);
          return;
        }
        if (!this.timer) return;
        const s = Math.floor(ms / 1000);
        const days = Math.floor(s / 86400);
        const hours = Math.floor((s % 86400) / 3600);
        const mins = Math.floor((s % 3600) / 60);
        const secs = s % 60;
        this.timer.textContent =
          days > 0 ? `${days}d ${pad(hours)}h ${pad(mins)}m ${pad(secs)}s` : `${pad(hours)}h ${pad(mins)}m ${pad(secs)}s`;
        this.timer.classList.add('is-live');
      }
    }
  );

  window.SgsUkInstant = ukInstant; // for testing
}
