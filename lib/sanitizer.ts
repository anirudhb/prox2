export function sanitize<String>(message: String) {
  return message
    .replaceAll("@channel", "<redacted>")
    .replaceAll("@here", "<redacted>")
    .replaceAll("@everyone", "<redacted>");
}
