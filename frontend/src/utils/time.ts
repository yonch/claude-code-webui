import dayjs from "dayjs";

/**
 * Format a timestamp as a readable time string
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Formatted time string (e.g., "14:30", "Dec 15, 14:30")
 */
export function formatRelativeTime(timestamp: number): string {
  const messageTime = dayjs(timestamp);
  const now = dayjs();

  // If it's today, show only time (HH:mm)
  if (messageTime.isSame(now, "day")) {
    return messageTime.format("HH:mm");
  }

  // If it's this year, show date and time without year
  if (messageTime.isSame(now, "year")) {
    return messageTime.format("MMM D, HH:mm");
  }

  // If it's from a different year, show full date and time
  return messageTime.format("MMM D, YYYY HH:mm");
}
