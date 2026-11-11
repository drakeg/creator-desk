import { expect, it } from "vitest";
import { gzipSync } from "node:zlib";
import {
  downloadReachCSV,
  reportingDay,
} from "../../src/main/youtube/reach-download";
import { Reporting } from "../../src/main/youtube/reporting";
const url = "https://youtubereporting.googleapis.com/v1/media/reach-report";
it("rejects untrusted URLs before sending authorization", async () => {
  let calls = 0;
  for (const raw of [
    "https://evil.test/v1/media/report",
    "https://youtubereporting.googleapis.com.evil.test/v1/media/report",
    "http://youtubereporting.googleapis.com/v1/media/report",
    "https://user@ youtubereporting.googleapis.com/v1/media/report",
    "https://youtubereporting.googleapis.com:444/v1/media/report",
    "https://youtubereporting.googleapis.com/v1/jobs",
    url + "#secret",
  ])
    await expect(
      downloadReachCSV(raw, "secret", async () => {
        calls++;
        return new Response("");
      }),
    ).rejects.toThrow();
  expect(calls).toBe(0);
});
it("decodes plain, transport-decoded and remaining gzip without double decompression", async () => {
  for (const [body, encoding] of [
    [Buffer.from("a,b\n1,2"), ""],
    [Buffer.from("a,b\n1,2"), "gzip"],
    [gzipSync("a,b\n1,2"), "gzip"],
  ] as const)
    expect(
      await downloadReachCSV(url, "private", async (raw, init) => {
        expect(raw).toBe(url);
        expect(init.redirect).toBe("error");
        expect(init.headers).toMatchObject({ Authorization: "Bearer private" });
        return new Response(body, {
          headers: { "content-encoding": encoding },
        });
      }),
    ).toBe("a,b\n1,2");
});
it("rejects redirects, inflated gzip bombs, malformed UTF-8 and oversized declarations", async () => {
  for (const response of [
    new Response("", {
      status: 302,
      headers: { location: "https://evil.test" },
    }),
    new Response(gzipSync("x".repeat(9 * 1024 * 1024))),
    new Response(new Uint8Array([0xff])),
    new Response("", { headers: { "content-length": "999999999" } }),
  ])
    await expect(
      downloadReachCSV(url, "private", async () => response),
    ).rejects.toThrow("could not be downloaded");
});
it("lists report pages scoped to the requested job and respects Pacific/DST days", async () => {
  const item = {
    id: "report",
    jobId: "job",
    startTime: "2026-11-01T07:00:00Z",
    endTime: "2026-11-02T08:00:00Z",
    createTime: "2026-11-03T00:00:00Z",
    downloadUrl: url,
  };
  const client = new Reporting("token", async (raw) => {
    const u = new URL(raw);
    expect(u.pathname).toBe("/v1/jobs/job/reports");
    expect(u.searchParams.has("includeSystemManaged")).toBe(false);
    return Response.json(
      u.searchParams.has("pageToken")
        ? { reports: [item] }
        : { nextPageToken: "next" },
    );
  });
  expect(await client.listReachReports("job")).toEqual([item]);
  expect(reportingDay("2026-11-02T07:30:00Z")).toBe("2026-11-01");
  await expect(
    new Reporting("token", async () =>
      Response.json({ reports: [{ ...item, jobId: "other" }] }),
    ).listReachReports("job"),
  ).rejects.toThrow();
});
