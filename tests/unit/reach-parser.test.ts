import { expect, it } from "vitest";
import { parseReachCSV } from "../../src/main/youtube/reach-parser";
const channel = "UC1234567890123456789012",
  day = "2026-11-01";
const header =
  "date,channel_id,video_id,video_thumbnail_impressions,video_thumbnail_impressions_ctr";
const csv = (line: string) => `${header}\n${line}`;
it("parses reordered columns, dates, unassigned videos and raw CTR without scaling", () => {
  expect(
    parseReachCSV(
      csv(
        `20261101,${channel},abcdefghijk,1000,0.05\n2026-11-01,${channel},,50,`,
      ),
      channel,
      day,
    ),
  ).toEqual([
    ["abcdefghijk", 1000, 0.05],
    [null, 50, null],
  ]);
  expect(
    parseReachCSV(
      `video_id,date,channel_id,video_thumbnail_impressions_ctr,video_thumbnail_impressions,extra_metric\nabcdefghijk,20261101,${channel},5,1000,42`,
      channel,
      day,
    ),
  ).toEqual([["abcdefghijk", 1000, 5]]);
});
it("accepts header-only coverage without inventing rows", () => {
  expect(parseReachCSV(header, channel, day)).toEqual([]);
});
it("rejects identity/date/duplicate/count/CTR errors and combined dimensions", () => {
  for (const line of [
    `20261102,${channel},abcdefghijk,100,5`,
    `20261101,UC9999999999999999999999,abcdefghijk,100,5`,
    `20261101,${channel},abcdefghijk,-1,5`,
    `20261101,${channel},abcdefghijk,9007199254740992,5`,
    `20261101,${channel},abcdefghijk,100,Infinity`,
    `20261101,${channel},abcdefghijk,100,101`,
    `20261101,${channel},abcdefghijk,100,5\n20261101,${channel},abcdefghijk,100,5`,
  ])
    expect(() => parseReachCSV(csv(line), channel, day)).toThrow(
      "invalid basic reach",
    );
  expect(() => parseReachCSV(header + ",device_type", channel, day)).toThrow();
  expect(() => parseReachCSV(header + ",date", channel, day)).toThrow();
  expect(() => parseReachCSV(csv('"unfinished'), channel, day)).toThrow();
});
