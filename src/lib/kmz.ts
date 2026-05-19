import JSZip from "jszip";

export type PolygonRing = { lat: number; lon: number }[];

export type KmlPolygon = {
  id: string;
  name: string;
  color: string; // outline CSS color
  fillColor?: string | null; // null/undefined = no fill
  outer: PolygonRing;
  holes: PolygonRing[];
};

const NS_KML = "http://www.opengis.net/kml/2.2";

// ---------- IMPORT ----------

export async function readKmzOrKml(file: File): Promise<KmlPolygon[]> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".kml")) {
    const text = await file.text();
    return parseKml(text);
  }
  // Assume KMZ
  const buf = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buf);
  const kmlEntry = Object.values(zip.files).find((f) =>
    f.name.toLowerCase().endsWith(".kml"),
  );
  if (!kmlEntry) return [];
  const text = await kmlEntry.async("string");
  return parseKml(text);
}

function parseKml(text: string): KmlPolygon[] {
  const doc = new DOMParser().parseFromString(text, "text/xml");
  const placemarks = doc.getElementsByTagName("Placemark");
  const out: KmlPolygon[] = [];
  let auto = 0;
  for (const pm of Array.from(placemarks)) {
    const name = textOf(pm, "name") ?? `Polygon ${++auto}`;
    const style = readStyleColors(doc, pm);
    const polygons = pm.getElementsByTagName("Polygon");
    for (const poly of Array.from(polygons)) {
      const outerCoords = readCoordinates(
        poly.querySelector("outerBoundaryIs LinearRing coordinates"),
      );
      if (!outerCoords || outerCoords.length < 3) continue;
      const innerRings: PolygonRing[] = [];
      for (const inner of Array.from(
        poly.querySelectorAll("innerBoundaryIs LinearRing coordinates"),
      )) {
        const ring = readCoordinates(inner);
        if (ring && ring.length >= 3) innerRings.push(ring);
      }
      out.push({
        id: `kmz-${out.length}-${Date.now().toString(36)}`,
        name,
        color: style.lineColor ?? style.fillColor ?? "#fbbf24",
        fillColor: style.fillColor,
        outer: outerCoords,
        holes: innerRings,
      });
    }
  }
  return out;
}

function textOf(el: Element, tag: string): string | null {
  const node = el.getElementsByTagName(tag)[0];
  return node?.textContent?.trim() ?? null;
}

function readCoordinates(el: Element | null): PolygonRing | null {
  if (!el || !el.textContent) return null;
  const ring: PolygonRing = [];
  for (const tuple of el.textContent.trim().split(/\s+/)) {
    const parts = tuple.split(",");
    if (parts.length < 2) continue;
    const lon = parseFloat(parts[0]);
    const lat = parseFloat(parts[1]);
    if (Number.isFinite(lat) && Number.isFinite(lon)) ring.push({ lat, lon });
  }
  return ring;
}

function readStyleColors(
  doc: Document,
  pm: Element,
): { lineColor: string | null; fillColor: string | null } {
  // Try inline Style first, then look up by styleUrl.
  const inline = pm.getElementsByTagName("Style")[0];
  const fromInline = inline ? extractKmlColors(inline) : null;
  if (fromInline) return fromInline;
  const styleUrl = textOf(pm, "styleUrl");
  if (!styleUrl) return { lineColor: null, fillColor: null };
  const id = styleUrl.replace(/^#/, "");
  const styles = doc.getElementsByTagName("Style");
  for (const s of Array.from(styles)) {
    if (s.getAttribute("id") === id) return extractKmlColors(s);
  }
  return { lineColor: null, fillColor: null };
}

function extractKmlColors(styleEl: Element): {
  lineColor: string | null;
  fillColor: string | null;
} {
  const fillEnabled =
    styleEl.querySelector("PolyStyle fill")?.textContent?.trim() !== "0";
  const polyColor = parseKmlColor(
    styleEl.querySelector("PolyStyle color")?.textContent?.trim() ?? null,
  );
  const lineColor = parseKmlColor(
    styleEl.querySelector("LineStyle color")?.textContent?.trim() ?? null,
  );
  return {
    lineColor: lineColor?.css ?? null,
    fillColor:
      fillEnabled && polyColor && polyColor.alpha > 0 ? polyColor.css : null,
  };
}

function parseKmlColor(
  kml: string | null,
): { css: string; alpha: number } | null {
  if (!kml || kml.length !== 8) return null;
  // KML color is AABBGGRR; convert to #RRGGBB (ignore alpha).
  const aa = kml.slice(0, 2);
  const bb = kml.slice(2, 4);
  const gg = kml.slice(4, 6);
  const rr = kml.slice(6, 8);
  return {
    alpha: parseInt(aa, 16),
    css: `#${rr}${gg}${bb}`.toLowerCase(),
  };
}

// ---------- EXPORT ----------

export async function buildKmz(polygons: KmlPolygon[]): Promise<Blob> {
  const kml = buildKml(polygons);
  const zip = new JSZip();
  zip.file("doc.kml", kml);
  return zip.generateAsync({ type: "blob", mimeType: "application/vnd.google-earth.kmz" });
}

export function buildKml(polygons: KmlPolygon[]): string {
  const styles = polygons
    .map((p, i) => {
      const fillKmlColor = p.fillColor
        ? cssToKmlColor(p.fillColor, 0x88)
        : cssToKmlColor(p.color, 0x00);
      return `<Style id="s${i}">
        <LineStyle><color>${cssToKmlColor(p.color, 0xff)}</color><width>2</width></LineStyle>
        <PolyStyle><color>${fillKmlColor}</color><fill>${p.fillColor ? 1 : 0}</fill></PolyStyle>
      </Style>`;
    })
    .join("\n");
  const placemarks = polygons
    .map(
      (p, i) => `<Placemark>
      <name>${escapeXml(p.name)}</name>
      <styleUrl>#s${i}</styleUrl>
      <Polygon>
        <outerBoundaryIs><LinearRing><coordinates>${ringToCoords(
          p.outer,
        )}</coordinates></LinearRing></outerBoundaryIs>
        ${p.holes
          .map(
            (h) =>
              `<innerBoundaryIs><LinearRing><coordinates>${ringToCoords(
                h,
              )}</coordinates></LinearRing></innerBoundaryIs>`,
          )
          .join("\n")}
      </Polygon>
    </Placemark>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="${NS_KML}">
  <Document>
    <name>TacBrief polygons</name>
    ${styles}
    ${placemarks}
  </Document>
</kml>`;
}

function ringToCoords(ring: PolygonRing): string {
  const closed =
    ring.length > 0 &&
    (ring[0].lat !== ring[ring.length - 1].lat ||
      ring[0].lon !== ring[ring.length - 1].lon)
      ? [...ring, ring[0]]
      : ring;
  return closed.map((p) => `${p.lon},${p.lat},0`).join(" ");
}

function cssToKmlColor(css: string, alpha: number): string {
  // Accept "#rrggbb"; default to amber if unparseable.
  const m = /^#([0-9a-f]{6})$/i.exec(css);
  if (!m) return "ff24bffb";
  const hex = m[1];
  const rr = hex.slice(0, 2);
  const gg = hex.slice(2, 4);
  const bb = hex.slice(4, 6);
  const aa = alpha.toString(16).padStart(2, "0");
  return `${aa}${bb}${gg}${rr}`.toLowerCase();
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function downloadKmz(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
