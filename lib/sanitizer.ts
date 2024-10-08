export function sanitize(message: string) {
  return message
    .replace(/<@[^|]+\|([^>]+)>/g, "[$1]")
    .replace(/<@.*?>/g, "[user]")
    .replace(/!subteam\^.*?\b/g, "[group]")
    .replace(/<!(channel|here|everyone)>/g, "<redacted for mass ping risk>");
}
