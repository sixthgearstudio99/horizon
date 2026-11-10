/*
 * SixthGear Studios: marks a Judge.me review widget that has no reviews yet with
 * .sgs-reviews-empty, so its empty rating graphics (0.0 stars, distribution bars) can be hidden
 * while "Write a review" stays. Judge.me's classic widget carries data-number-of-reviews, which
 * the CSS reads directly; this covers newer markup that doesn't. Judge.me renders after the
 * page loads, so the page is watched for a while.
 */
(() => {
  const WIDGETS = '.jdgm-widget, .jdgm-rev-widg, .jdgm-review-widget, [class*="jdgm-review-widget"]';
  const REVIEW_ITEMS = '.jdgm-rev, [class*="jdgm-rev__"][class*="item"], [itemprop="review"]';

  const isEmpty = (widget) => {
    const holder = widget.matches('[data-number-of-reviews]') ? widget : widget.querySelector('[data-number-of-reviews]');
    if (holder) return Number(holder.getAttribute('data-number-of-reviews')) === 0;
    if (widget.querySelector(REVIEW_ITEMS)) return false;
    const text = (widget.textContent || '').toLowerCase();
    return /be the first to (write|leave)|no reviews yet|0 reviews/.test(text);
  };

  const check = () => {
    document.querySelectorAll(WIDGETS).forEach((widget) => {
      widget.classList.toggle('sgs-reviews-empty', isEmpty(widget));
    });
  };

  check();
  let timer;
  const observer = new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(check, 120);
  });
  observer.observe(document.body, { childList: true, subtree: true });
  // Long enough for Judge.me to render; a review posted later reloads the page anyway
  setTimeout(() => observer.disconnect(), 20000);
})();
