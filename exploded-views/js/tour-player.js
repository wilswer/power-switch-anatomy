import { TOUR, CHAPTERS } from './tour.js';

// Plays the guided tour: shows the step card, steps back and forth, and runs
// voltage sweeps. Setting up each scene is delegated to `applyStep`, and a
// sweep drives the page through `setVoltage(V, deviceId)`, so this module owns
// no page state. `onChange` fires whenever the tour starts, stops or moves.

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const REDUCED_STAGES = 4; // with reduced motion, sweeps jump in this many steps
const REDUCED_STAGE_MS = 1100;

export function createTourPlayer({ els, applyStep, setVoltage, onChange }) {
  let index = -1; // -1 = not touring
  let resumeAt = 0;
  let sweepFrame = 0;
  let sweepTimer = 0;
  let opener = null; // the button that started the tour gets focus back

  for (const el of document.querySelectorAll('[data-tour-length]')) el.textContent = String(TOUR.length);

  // Pointer shortcut only: keyboard users step with Back/Next or the arrow keys,
  // and the step position is announced in the card's kicker.
  els.progress.setAttribute('aria-hidden', 'true');
  els.progress.innerHTML = TOUR.map((st, i) => {
    const chapterStart = i > 0 && st.chapter !== TOUR[i - 1].chapter;
    return `<button type="button" tabindex="-1" data-step="${i}" class="${chapterStart ? 'chapter-start' : ''}"
      title="Step ${i + 1}: ${st.title}"></button>`;
  }).join('');

  function stopSweep() {
    if (sweepFrame) cancelAnimationFrame(sweepFrame);
    if (sweepTimer) clearTimeout(sweepTimer);
    sweepFrame = 0;
    sweepTimer = 0;
  }

  // The sweep always targets the step's own device; the page ignores it for
  // the display if the user has since switched to another device or mode.
  function startSweep({ from, to, seconds }, device) {
    stopSweep();
    const at = (k) => Math.round((from + (to - from) * k) / 10) * 10;
    if (reduceMotion) {
      let stage = 0;
      setVoltage(from, device);
      const nextStage = () => {
        stage += 1;
        setVoltage(at(stage / REDUCED_STAGES), device);
        sweepTimer = stage < REDUCED_STAGES ? setTimeout(nextStage, REDUCED_STAGE_MS) : 0;
      };
      sweepTimer = setTimeout(nextStage, REDUCED_STAGE_MS);
      return;
    }
    const t0 = performance.now();
    const tick = (now) => {
      const k = Math.min(1, (now - t0) / (seconds * 1000));
      setVoltage(at(k), device);
      sweepFrame = k < 1 ? requestAnimationFrame(tick) : 0;
    };
    sweepFrame = requestAnimationFrame(tick);
  }

  function render() {
    const st = TOUR[index];
    els.kicker.textContent = `Tour · ${CHAPTERS[st.chapter]} · step ${index + 1} of ${TOUR.length}`;
    els.title.textContent = st.title;
    els.text.innerHTML = st.body;
    const backHadFocus = document.activeElement === els.back;
    els.back.disabled = index === 0;
    if (backHadFocus && els.back.disabled) els.next.focus({ preventScroll: true });
    els.next.textContent = index === TOUR.length - 1 ? 'Finish' : 'Next';
    els.replay.hidden = !st.sweep;
    for (const b of els.progress.querySelectorAll('[data-step]')) {
      const i = Number(b.dataset.step);
      b.classList.toggle('is-done', i < index);
      b.classList.toggle('is-current', i === index);
    }
  }

  function go(i) {
    stopSweep();
    index = Math.max(0, Math.min(TOUR.length - 1, i));
    resumeAt = index;
    const st = TOUR[index];
    applyStep(st);
    render();
    if (st.sweep) startSweep(st.sweep, st.device);
    onChange?.();
  }

  // Scroll the page just enough to show the whole card.
  function reveal() {
    els.card.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
  }

  function start({ from = null } = {}) {
    if (index >= 0) {
      reveal();
      return;
    }
    opener = from;
    els.card.hidden = false;
    document.body.classList.add('is-touring');
    go(resumeAt);
    els.next.focus({ preventScroll: true });
    reveal();
  }

  function stop({ finished = false } = {}) {
    if (index < 0) return;
    stopSweep();
    if (finished || index === TOUR.length - 1) resumeAt = 0;
    index = -1;
    els.card.hidden = true;
    document.body.classList.remove('is-touring');
    if (opener?.isConnected) opener.focus({ preventScroll: true });
    opener = null;
    onChange?.();
  }

  const next = () => (index === TOUR.length - 1 ? stop({ finished: true }) : go(index + 1));
  const back = () => go(index - 1);

  els.next.addEventListener('click', next);
  els.back.addEventListener('click', back);
  els.exit.addEventListener('click', () => stop());
  els.replay.addEventListener('click', () => go(index)); // rebuild the whole scene, then sweep again
  els.progress.addEventListener('click', (e) => {
    const b = e.target.closest('[data-step]');
    if (b) go(Number(b.dataset.step));
  });

  return {
    start,
    stop,
    next,
    back,
    reveal,
    stopSweep,
    isActive: () => index >= 0,
    currentStep: () => index,
    resumeStep: () => resumeAt,
  };
}
