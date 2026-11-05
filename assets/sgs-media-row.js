/*
 * SixthGear Studios: media rows (sections/sgs-proof.liquid).
 * Videos play muted and looped only while on screen (not with reduced motion), and pause when
 * scrolled away. Tiles set to expand open full screen; videos then play with sound and controls.
 */
if (!customElements.get('sgs-media-row')) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let dialog;

  const openFull = (tile) => {
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.className = 'sgs-mr-dialog';
      dialog.setAttribute('aria-label', 'Full screen');
      dialog.innerHTML =
        '<button type="button" class="sgs-mr-dialog__close" aria-label="Close"><svg aria-hidden="true" focusable="false" width="18" height="18" viewBox="0 0 18 18"><path d="M4 4l10 10M14 4L4 14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg></button><div class="sgs-mr-dialog__stage"></div>';
      document.body.appendChild(dialog);
      dialog.querySelector('button').addEventListener('click', () => dialog.close());
      dialog.addEventListener('click', (e) => {
        if (e.target === dialog || e.target.classList.contains('sgs-mr-dialog__stage')) dialog.close();
      });
      dialog.addEventListener('close', () => {
        dialog.querySelector('.sgs-mr-dialog__stage').replaceChildren();
        document.documentElement.classList.remove('sgs-lb-open');
        dialog.opener?.focus?.({ preventScroll: true });
      });
    }
    const stage = dialog.querySelector('.sgs-mr-dialog__stage');
    const source = tile.querySelector('video');
    if (source) {
      const video = source.cloneNode(true);
      video.removeAttribute('class');
      video.muted = false;
      video.controls = true;
      video.autoplay = true;
      video.loop = false;
      video.preload = 'auto';
      stage.replaceChildren(video);
    } else {
      const img = document.createElement('img');
      img.src = tile.dataset.full || tile.querySelector('img')?.currentSrc || '';
      img.alt = tile.dataset.alt || '';
      stage.replaceChildren(img);
    }
    dialog.opener = tile;
    document.documentElement.classList.add('sgs-lb-open');
    dialog.showModal();
    stage.querySelector('video')?.play().catch(() => {});
  };

  customElements.define(
    'sgs-media-row',
    class extends HTMLElement {
      connectedCallback() {
        this.addEventListener('click', (e) => {
          const tile = e.target instanceof Element ? e.target.closest('[data-expand]') : null;
          if (!tile) return;
          e.preventDefault();
          openFull(tile);
        });

        const videos = [...this.querySelectorAll('video')];
        if (!videos.length) return;
        videos.forEach((v) => {
          v.muted = true;
          v.setAttribute('muted', '');
          v.playsInline = true;
        });
        this.observer = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              const v = entry.target;
              if (entry.isIntersecting && !reduced.matches) {
                v.play().catch(() => {});
              } else {
                v.pause();
              }
            });
          },
          { threshold: 0.6 }
        );
        videos.forEach((v) => this.observer.observe(v));
      }

      disconnectedCallback() {
        this.observer?.disconnect();
      }
    }
  );
}
