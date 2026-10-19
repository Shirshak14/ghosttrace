'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// Same spring feel as the original motion-based version (mass 1, stiffness and damping derived from duration),
// integrated by hand so the page doesn't need the motion library.
const STEP = 1 / 1000;

export default function CountUp({
  to,
  from = 0,
  direction = 'up',
  delay = 0,
  duration = 2,
  className = '',
  startWhen = true,
  separator = '',
  onStart,
  onEnd
}) {
  const ref = useRef(null);
  const [isInView, setIsInView] = useState(false);
  const spring = useRef({ value: direction === 'down' ? to : from, velocity: 0 });

  const damping = 20 + 40 * (1 / duration);
  const stiffness = 100 * (1 / duration);

  const getDecimalPlaces = num => {
    const str = num.toString();

    if (str.includes('.')) {
      const decimals = str.split('.')[1];

      if (parseInt(decimals) !== 0) {
        return decimals.length;
      }
    }

    return 0;
  };

  const maxDecimals = Math.max(getDecimalPlaces(from), getDecimalPlaces(to));

  const formatValue = useCallback(
    latest => {
      const hasDecimals = maxDecimals > 0;

      const options = {
        useGrouping: !!separator,
        minimumFractionDigits: hasDecimals ? maxDecimals : 0,
        maximumFractionDigits: hasDecimals ? maxDecimals : 0
      };

      const formattedNumber = Intl.NumberFormat('en-US', options).format(latest);

      return separator ? formattedNumber.replace(/,/g, separator) : formattedNumber;
    },
    [maxDecimals, separator]
  );

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsInView(true);
        observer.disconnect();
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (ref.current) {
      ref.current.textContent = formatValue(direction === 'down' ? to : from);
    }
  }, [from, to, direction, formatValue]);

  useEffect(() => {
    if (!isInView || !startWhen) return;
    if (typeof onStart === 'function') onStart();

    const target = direction === 'down' ? from : to;
    const state = spring.current;
    let frame = 0;
    let last = 0;

    const tick = now => {
      const dt = Math.min((now - (last || now)) / 1000, 0.064);
      last = now;
      for (let t = 0; t < dt; t += STEP) {
        state.velocity += (-stiffness * (state.value - target) - damping * state.velocity) * STEP;
        state.value += state.velocity * STEP;
      }
      const done = Math.abs(target - state.value) < 0.5 && Math.abs(state.velocity) < 2;
      if (done) Object.assign(state, { value: target, velocity: 0 });
      if (ref.current) ref.current.textContent = formatValue(state.value);
      if (!done) frame = requestAnimationFrame(tick);
    };

    const timeoutId = setTimeout(() => {
      frame = requestAnimationFrame(tick);
    }, delay * 1000);

    const durationTimeoutId = setTimeout(
      () => {
        if (typeof onEnd === 'function') onEnd();
      },
      delay * 1000 + duration * 1000
    );

    return () => {
      clearTimeout(timeoutId);
      clearTimeout(durationTimeoutId);
      cancelAnimationFrame(frame);
    };
  }, [isInView, startWhen, direction, from, to, delay, onStart, onEnd, duration, stiffness, damping, formatValue]);

  return <span className={className} ref={ref} />;
}
