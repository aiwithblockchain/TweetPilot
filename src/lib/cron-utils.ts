export function convertCronToLocalTime(cronExpr: string): string {
  // Backend stores cron in UTC, convert to local time for display
  const parts = cronExpr.split(' ')
  if (parts.length !== 6) return cronExpr

  const utcHour = parseInt(parts[2])
  if (isNaN(utcHour)) return cronExpr

  // Convert UTC to CST (UTC+8)
  const localHour = (utcHour + 8) % 24
  parts[2] = localHour.toString()

  return parts.join(' ')
}
