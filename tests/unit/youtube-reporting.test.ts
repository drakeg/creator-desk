import { expect, it } from "vitest";
import { Reporting, REACH_REPORT_TYPE } from "../../src/main/youtube/reporting";
import { CoreError } from "../../src/shared/contracts";
const type = { id: REACH_REPORT_TYPE, name: "Reach Basic" };
const job = {
  id: "job-one",
  reportTypeId: REACH_REPORT_TYPE,
  name: "Reach",
  createTime: "2026-01-01T00:00:00Z",
};
it("finds a live existing job beyond the first page and never creates a duplicate", async () => {
  let posts = 0;
  const result = await new Reporting("private-token", async (raw, init) => {
    const url = new URL(raw);
    expect(url.origin).toBe("https://youtubereporting.googleapis.com");
    expect(init.headers).toEqual({ Authorization: "Bearer private-token" });
    expect(init.redirect).toBe("error");
    if (init.method === "POST") posts++;
    if (url.pathname.endsWith("reportTypes"))
      return Response.json(
        url.searchParams.has("pageToken")
          ? { reportTypes: [type] }
          : { reportTypes: [], nextPageToken: "types-next" },
      );
    return Response.json(
      url.searchParams.has("pageToken")
        ? {
            jobs: [
              { ...job, id: "expired", expireTime: "2020-01-01T00:00:00Z" },
              job,
            ],
          }
        : { nextPageToken: "jobs-next" },
    );
  }).ensureReachJob();
  expect(result).toMatchObject({
    job,
    created: false,
    state: "job-ready",
  });
  expect(posts).toBe(0);
  expect(JSON.stringify(result)).not.toContain("private-token");
});
it("creates exactly the supported job with a fixed request after discovery", async () => {
  let posts = 0;
  const result = await new Reporting("token", async (raw, init) => {
    const url = new URL(raw);
    if (url.pathname.endsWith("reportTypes"))
      return Response.json({ reportTypes: [type] });
    if (init.method !== "POST")
      return Response.json({
        jobs: [{ ...job, expireTime: "2020-01-01T00:00:00Z" }],
      });
    posts++;
    expect(url.search).toBe("");
    expect(JSON.parse(String(init.body))).toEqual({
      reportTypeId: REACH_REPORT_TYPE,
      name: "Creator Desk reach analytics",
    });
    expect(init.headers).toEqual({
      Authorization: "Bearer token",
      "Content-Type": "application/json",
    });
    return Response.json(job);
  }).ensureReachJob();
  expect(result.created).toBe(true);
  expect(posts).toBe(1);
});
it("does not substitute combined, deprecated or unknown report schemas", async () => {
  for (const types of [
    [],
    [{ ...type, id: "channel_reach_combined_a1" }],
    [{ ...type, deprecateTime: "2030-01-01T00:00:00Z" }],
    [{ ...type, systemManaged: true }],
  ]) {
    let calls = 0;
    await expect(
      new Reporting("token", async () => {
        calls++;
        return Response.json({ reportTypes: types });
      }).ensureReachJob(),
    ).rejects.toThrow("not available");
    expect(calls).toBe(1);
  }
});
it("rejects malformed responses and repeated pagination tokens without creating jobs", async () => {
  for (const response of [
    { reportTypes: "invalid" },
    { reportTypes: [type], nextPageToken: "repeat" },
    { reportTypes: [{ ...type, id: "" }] },
  ]) {
    let calls = 0;
    await expect(
      new Reporting("token", async () => {
        calls++;
        return Response.json(response);
      }).ensureReachJob(),
    ).rejects.toThrow("invalid reporting-job");
    expect(calls).toBeLessThanOrEqual(2);
  }
});
it("checks cancellation/account guard before requests and after completion", async () => {
  let valid = true,
    calls = 0;
  const client = new Reporting(
    "token",
    async () => {
      calls++;
      valid = false;
      return Response.json({ reportTypes: [type] });
    },
    () => {
      if (!valid) throw new CoreError("CANCELLED", "Channel changed");
    },
  );
  await expect(client.ensureReachJob()).rejects.toThrow("Channel changed");
  expect(calls).toBe(1);
  await expect(client.ensureReachJob()).rejects.toThrow("Channel changed");
  expect(calls).toBe(1);
});
it("explains Reporting API denial without leaking provider bodies", async () => {
  await expect(
    new Reporting("token", async () =>
      Response.json(
        { error: { message: "private provider diagnostic" } },
        { status: 403 },
      ),
    ).ensureReachJob(),
  ).rejects.toThrow("Enable YouTube Reporting API");
});
it("rejects a created job for another report type", async () => {
  await expect(
    new Reporting("token", async (raw, init) =>
      Response.json(
        raw.includes("reportTypes")
          ? { reportTypes: [type] }
          : init.method === "POST"
            ? { ...job, reportTypeId: "wrong" }
            : {},
      ),
    ).ensureReachJob(),
  ).rejects.toThrow("invalid reporting-job");
});
