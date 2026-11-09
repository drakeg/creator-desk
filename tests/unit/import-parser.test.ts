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

it("imports Studio thumbnail impressions and explains exact total differences", () => {
  const r = parseImport(
    "Content,Video title,Views,Thumbnail impressions\nTotal,,100,1000\na,A,80,900\n",
    "table.csv",
  );
  expect(r.rows[0].impressions).toBe(900);
  expect(r.metrics).toContain("impressions");
  expect(r.warnings.join(" ")).not.toContain("unsupported");
  expect(r.warnings.join(" ")).toContain("20 fewer");
  expect(r.warnings.join(" ")).toContain("100 total views");
});

it("imports durations and CTR without inventing missing values", () => {
  const r = parseImport(
    "Content,Video title,Views,Duration,Thumbnail click-through rate (%)\na,A,1,65,7.5\nb,B,2,01:02:03,8%\nc,C,0,,\n",
    "table.csv",
  );
  expect(r.rows[0]).toMatchObject({ durationSeconds: 65, ctr: 7.5 });
  expect(r.rows[1]).toMatchObject({ durationSeconds: 3723, ctr: 8 });
  expect(r.rows[2]).toMatchObject({ durationSeconds: null, ctr: null });
  expect(r.warnings.join(" ")).not.toContain("unsupported");
  expect(() =>
    parseImport("Content,Video title,Views,Duration\na,A,1,01:99\n", "a.csv"),
  ).toThrow();
  expect(() =>
    parseImport(
      "Content,Video title,Views,Thumbnail click-through rate (%)\na,A,1,101\n",
      "a.csv",
    ),
  ).toThrow();
});
