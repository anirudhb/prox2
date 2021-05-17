export function sanitize(message: string) {
  return message
    .replace(/@(channel|here|everyone)/g, "<redacted>");
}
