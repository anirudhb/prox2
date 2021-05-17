export function sanitize(message: string) {
  return message
    .replaceAll("@channel", "<redacted>")
    .replaceAll("@here", "<redacted>")
    .replaceAll("@everyone", "<redacted>");
}
