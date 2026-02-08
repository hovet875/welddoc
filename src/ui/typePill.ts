export function buildTypePillMap(values: string[], maxColors = 10) {
  const map = new Map<string, string>();
  let idx = 0;
  for (const raw of values) {
    const key = (raw ?? "").trim();
    if (!key || map.has(key)) continue;
    if (idx < maxColors) {
      map.set(key, `pill-${idx + 1}`);
      idx += 1;
    } else {
      map.set(key, "pill-other");
    }
  }
  return map;
}

export function typePillClass(value: string, map: Map<string, string>) {
  const key = (value ?? "").trim();
  const suffix = map.get(key) ?? "pill-other";
  return `type-pill ${suffix}`;
}
