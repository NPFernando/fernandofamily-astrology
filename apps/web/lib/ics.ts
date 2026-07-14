// Zero-dependency RFC 5545 (.ics) generation for exporting favourable
// windows to any calendar app. Everything is client-side — no window data
// touches the server, and the file contains only bird/activity/effect names
// and times, never birth details.

export type IcsEvent = {
  uid: string;
  start: Date;
  end: Date;
  summary: string;
  description?: string;
};

// TEXT values: backslash, semicolon, comma and newlines must be escaped
// (RFC 5545 §3.3.11).
function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

// Content lines longer than 75 octets must be folded with CRLF + a single
// space (RFC 5545 §3.1). Folding on UTF-8 byte length, splitting only at
// character boundaries.
function foldLine(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;
  const out: string[] = [];
  let current = "";
  let currentBytes = 0;
  // Continuation lines start with a space, which counts toward the 75.
  let limit = 75;
  for (const ch of line) {
    const chBytes = encoder.encode(ch).length;
    if (currentBytes + chBytes > limit) {
      out.push(current);
      current = " ";
      currentBytes = 1;
      limit = 75;
    }
    current += ch;
    currentBytes += chBytes;
  }
  if (current) out.push(current);
  return out.join("\r\n");
}

function toUtcBasic(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

export function buildIcs(events: IcsEvent[]): string {
  const now = toUtcBasic(new Date());
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Fernando Family Astrology//Pancha Pakshi//EN",
    "CALSCALE:GREGORIAN",
  ];
  for (const ev of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${escapeText(ev.uid)}@astrology.fernandofamily.com`,
      `DTSTAMP:${now}`,
      `DTSTART:${toUtcBasic(ev.start)}`,
      `DTEND:${toUtcBasic(ev.end)}`,
      `SUMMARY:${escapeText(ev.summary)}`,
    );
    if (ev.description) lines.push(`DESCRIPTION:${escapeText(ev.description)}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

export function downloadIcs(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
