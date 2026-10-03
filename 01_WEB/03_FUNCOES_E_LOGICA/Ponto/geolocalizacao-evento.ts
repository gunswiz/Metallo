export type LocationInput = { status: "AVAILABLE" | "DENIED" | "UNAVAILABLE" | "TIMEOUT" | "UNKNOWN"; latitude?: number; longitude?: number; accuracy_meters?: number; captured_at?: string };
// Uma aquisição somente após clique. Sem watchPosition, permissões prévias ou background.
export function acquireEventLocation(geo: Geolocation | undefined, signal: AbortSignal): Promise<LocationInput> {
  return new Promise(resolve => {
    let finished = false;
    const finish = (result: LocationInput) => { if (finished) return; finished = true; clearTimeout(timer); signal.removeEventListener("abort", abort); resolve(result); };
    const abort = () => finish({ status: "UNKNOWN" });
    const timer = setTimeout(() => finish({ status: "TIMEOUT" }), 8500);
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) return abort();
    if (!geo) return finish({ status: "UNAVAILABLE" });
    try {
      geo.getCurrentPosition(position => {
        const { latitude, longitude, accuracy } = position.coords;
        const capturedAt = new Date(position.timestamp);
        if (![latitude, longitude, accuracy, position.timestamp, capturedAt.getTime()].every(Number.isFinite) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || accuracy < 0) return finish({ status: "UNKNOWN" });
        finish({ status: "AVAILABLE", latitude, longitude, accuracy_meters: accuracy, captured_at: capturedAt.toISOString() });
      }, error => finish({ status: error.code === 1 ? "DENIED" : error.code === 3 ? "TIMEOUT" : "UNAVAILABLE" }),
      { enableHighAccuracy: false, maximumAge: 0, timeout: 8000 });
    } catch { finish({ status: "UNAVAILABLE" }); }
  });
}
