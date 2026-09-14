export function exp5BackoffMs(attemptsMade: number) {
  const n = Number(attemptsMade);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return 5000 * Math.pow(5, n - 1);
}

