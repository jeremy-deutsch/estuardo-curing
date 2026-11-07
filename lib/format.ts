// Explicit locale/timezone keep server HTML and browser hydration identical.
const dateOptions = {
  timeZone: "America/Los_Angeles",
  dateStyle: "medium",
} as const;
export function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", dateOptions).format(new Date(value));
}
export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    ...dateOptions,
    timeStyle: "short",
  }).format(new Date(value));
}
