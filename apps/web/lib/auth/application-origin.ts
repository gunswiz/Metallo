type RequestOriginHeaders = {
  origin: string | null;
  forwardedHost: string | null;
  forwardedProto: string | null;
  host: string | null;
};

function firstHeaderValue(value: string | null) {
  return value?.split(",", 1)[0]?.trim() || null;
}

function safeHttpOrigin(value: string | null) {
  if (!value) return null;

  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function resolveApplicationOrigin({
  origin,
  forwardedHost,
  forwardedProto,
  host,
}: RequestOriginHeaders) {
  const requestOrigin = safeHttpOrigin(origin);
  if (requestOrigin) return requestOrigin;

  const requestHost = firstHeaderValue(forwardedHost) ?? firstHeaderValue(host);
  if (!requestHost) return "http://localhost:3000";

  const forwardedScheme = firstHeaderValue(forwardedProto);
  const scheme = forwardedScheme === "http" || forwardedScheme === "https"
    ? forwardedScheme
    : requestHost.startsWith("localhost") || requestHost.startsWith("127.0.0.1")
      ? "http"
      : "https";

  return safeHttpOrigin(`${scheme}://${requestHost}`) ?? "http://localhost:3000";
}
