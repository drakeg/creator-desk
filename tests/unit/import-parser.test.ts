import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parseImport } from "../../src/main/imports/parser";
const fixture = (name: string) =>
  readFileSync("tests/fixtures/" + name, "utf8");
describe("report parser", () => {
  it("reads Studio video totals without counting the Total row twice", () => {
    const r = parseImport(fixture("videos.csv"), "videos.csv");
    expect(r.kind).toBe("videos");
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0]).toMatchObject({
      title: "Waterfalls, trails & RV life",
      published: "2026-10-10",
      views: 1000,
      watchHours: 100.5,
    });
    expect(r.rows[1].subscribers).toBe(-2);
    expect(r.rows[1].title).toBe('An "honest" campsite review');
  });
  it("handles BOM, CRLF, multiline quoted titles and tab separators", () => {
    const r = parseImport(
      '\ufeffContent\tVideo title\tViews\r\nabc\t"Café\nMontréal"\t10\r\n',
      "file.csv",
    );
    expect(r.rows[0].title).toBe("Café\nMontréal");
  });
  it("does not turn missing optional columns or blanks into zeros", () => {
    const r = parseImport(
      "Content,Video title,Views,Watch time (hours)\na,Test,0,\n",
      "a.csv",
    );
    expect(r.rows[0].watchHours).toBeNull();
    expect(r.rows[0].subscribers).toBeNull();
  });
  it("parses daily reports and equivalent JSON", () => {
    const r = parseImport(fixture("daily.csv"), "daily.csv");
    expect(r.kind).toBe("daily");
    expect(r.rows[0].date).toBe("2026-10-01");
    expect(r.rows[1].views).toBe(0);
    const j = parseImport(
      JSON.stringify([{ Date: "2026-10-01", Views: 10, Subscribers: -2 }]),
      "daily.json",
    );
    expect(j.rows[0].subscribers).toBe(-2);
  });
  it("discloses when the reported total is larger than the imported rows", () => {
    const r = parseImport(
      "Content,Video title,Views\nTotal,,999\na,A,1\n",
      "a.csv",
    );
    expect(r.warnings.join(" ")).toMatch(/subset|different/i);
  });
  it.each([
    "Content,Video title,Views\na,A,NaN",
    "Content,Video title,Views\na,A,-1",
    "Date,Views\n2026-02-30,1",
    "Content,Video title,Views\na,A,1\na,B,2",
    'Content,Video title,Views\na,"unclosed,1',
    "Content,Video title,Views\na,A,1,extra",
    "Unknown,Views\na,1",
  ])("rejects malformed input without guessing: %s", (text) =>
    expect(() => parseImport(text, "a.csv")).toThrow(),
  );
});
