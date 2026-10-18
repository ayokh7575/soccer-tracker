// Seconds -> "MM:SS" (minutes are not capped at 59, so 90 minutes is "90:00").
export const formatTime = (seconds: number) => {
  const rounded = Math.round(seconds);
  const mins = Math.floor(rounded / 60);
  const secs = rounded % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

// "MM:SS" -> seconds; anything else is 0.
export const parseTime = (timeStr: string): number => {
  const parts = timeStr.trim().split(':');
  if (parts.length === 2) return (parseInt(parts[0]) || 0) * 60 + (parseInt(parts[1]) || 0);
  return 0;
};
