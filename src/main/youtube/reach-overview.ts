import {
  reachQuery,
  reachSetup,
  type ReachOverview,
  type ReachRow,
} from "../../shared/reach";
import type { Store } from "../storage/store";
import { ReachCache } from "./reach-cache";
import { History } from "./history";
export const reachSetupKey = (id: string) => `reach-setup:${id}`;
export function reachTotals(rows: ReachRow[]) {
  if (!rows.length) return { impressions: null, ctr: null };
  const impressions = rows.reduce((sum, row) => sum + row[1], 0);
  if (!Number.isSafeInteger(impressions))
    return { impressions: null, ctr: null };
  const complete = rows.every((row) => row[1] === 0 || row[2] !== null);
  // Keep the documented provider percentage units. Never infer a unit from its magnitude.
  const ctr =
    impressions > 0 && complete
      ? rows.reduce(
          (sum, row) => sum + (row[1] / impressions) * (row[2] ?? 0),
          0,
        )
      : null;
  return { impressions, ctr };
}
export function readReachOverview(
  store: Store,
  channelId: string | null,
  input: unknown,
  busy = false,
): ReachOverview {
  const query = reachQuery.parse(input),
    workspaceId = store.state().selectedWorkspaceId;
  const setup = reachSetup
    .nullable()
    .parse(
      workspaceId ? store.setting(reachSetupKey(workspaceId), null) : null,
    );
  const actual = channelId ?? setup?.channelId ?? null;
  const batches =
    workspaceId && actual ? new ReachCache(store, actual).read() : [];
  const days = batches.map((batch) => batch.metadata.day).sort();
  const selected = batches.filter(
    (batch) =>
      (!query.startDate || batch.metadata.day >= query.startDate) &&
      (!query.endDate || batch.metadata.day <= query.endDate),
  );
  const filter = (rows: ReachRow[]) =>
    query.videoId
      ? rows.filter((row) =>
          query.videoId === "unassigned"
            ? row[0] === null
            : row[0] === query.videoId,
        )
      : rows;
  const titles = new Map<string, string>();
  if (workspaceId) {
    const history = new History(store).load(workspaceId);
    if (history?.channelId === actual)
      for (const row of history.uploads?.rows ?? [])
        titles.set(row.id, row.title);
  }
  const videoTitle = (id: string) =>
    id === "unassigned"
      ? "Unassigned or deleted videos"
      : (titles.get(id) ?? id);
  const videoIds = new Set(
    batches.flatMap((batch) => batch.rows.map((row) => row[0] ?? "unassigned")),
  );
  const videos = [...videoIds]
    .sort()
    .map((id) => ({ id, title: videoTitle(id) }));
  const grouped = new Map<string, ReachRow[]>();
  for (const batch of selected)
    for (const row of filter(batch.rows)) {
      const id = row[0] ?? "unassigned";
      const rows = grouped.get(id) ?? [];
      rows.push(row);
      grouped.set(id, rows);
    }
  const rows = [...grouped]
    .map(([id, items]) => ({
      id,
      title: videoTitle(id),
      ...reachTotals(items),
    }))
    .sort(
      (a, b) =>
        (b.impressions ?? -1) - (a.impressions ?? -1) ||
        a.id.localeCompare(b.id),
    );
  const pageCount = Math.max(1, Math.ceil(rows.length / 25)),
    page = Math.min(query.page, pageCount);
  return {
    channelId: actual,
    enabled: !!setup && setup.channelId === actual,
    busy,
    checkedAt: setup?.channelId === actual ? setup.checkedAt : null,
    coveredDays: days,
    selectedDays: selected.length,
    firstDay: days[0] ?? null,
    lastDay: days.at(-1) ?? null,
    ...reachTotals(selected.flatMap((batch) => filter(batch.rows))),
    series: selected
      .sort((a, b) => a.metadata.day.localeCompare(b.metadata.day))
      .map((batch) => ({
        date: batch.metadata.day,
        ...reachTotals(filter(batch.rows)),
      })),
    videos,
    rows: rows.slice((page - 1) * 25, page * 25),
    page,
    pageCount,
  };
}
