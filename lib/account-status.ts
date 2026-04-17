export function isBlockActive(isBlocked: boolean | null | undefined, blockedUntil: string | null | undefined, now = new Date()) {
  if (!isBlocked) return false;
  if (!blockedUntil) return true;

  const until = new Date(blockedUntil).getTime();
  if (Number.isNaN(until)) return true;

  return until > now.getTime();
}
