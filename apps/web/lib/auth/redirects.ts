export function safeRedirectPath(value: string | null | undefined, fallback = "/dashboard") {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\u0000-\u001f\u007f]|%(?:2f|5c)/i.test(value)
  ) {
    return fallback;
  }

  try {
    const trustedOrigin = new URL("https://metallo.invalid");
    const destination = new URL(value, trustedOrigin);
    if (destination.origin !== trustedOrigin.origin) return fallback;
    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return fallback;
  }
}
