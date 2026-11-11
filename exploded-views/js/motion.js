// The reduced-motion preference, read live: the operating system setting can
// change while the page is open, and every animation should follow at once.
const query = window.matchMedia('(prefers-reduced-motion: reduce)');

export const reducedMotion = () => query.matches;
export const onMotionChange = (fn) => query.addEventListener('change', fn);
