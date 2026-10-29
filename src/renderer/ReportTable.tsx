import { ChevronLeft, ChevronRight, ArrowDownUp } from "lucide-react";
import type { Dashboard, DashboardInput } from "../shared/analytics";
const number = (value: number | null, digits = 0) =>
  value === null
    ? "—"
    : value.toLocaleString(undefined, { maximumFractionDigits: digits });
export function ReportTable({
  data,
  query,
  update,
}: {
  data: Dashboard;
  query: DashboardInput;
  update: (patch: Partial<DashboardInput>) => void;
}) {
  const daily = data.selected?.kind === "daily";
  function sort(key: NonNullable<DashboardInput["sort"]>) {
    update({
      sort: key,
      direction:
        query.sort === key && query.direction === "desc" ? "asc" : "desc",
      page: 1,
    });
  }
  return (
    <section className="report-library">
      <div className="library-header">
        <div>
          <h2>{daily ? "Daily performance" : "Video library"}</h2>
          <p>
            {data.rowCount.toLocaleString()} matching{" "}
            {daily ? "days" : "videos"} ·{" "}
            {data.pageCount > 1 ? "25 per page" : "All rows shown"}
          </p>
        </div>
        <label className="sr-only" htmlFor="report-search">
          Search report
        </label>
        <input
          id="report-search"
          type="search"
          placeholder={daily ? "Search dates…" : "Search titles or video IDs…"}
          value={query.search ?? ""}
          onChange={(e) => update({ search: e.target.value, page: 1 })}
        />
      </div>
      <div className="table-scroll">
        <table className="analytics-table">
          <thead>
            <tr>
              {(
                [
                  {
                    key: daily ? "date" : "title",
                    label: daily ? "Date" : "Video",
                  },
                  { key: "views", label: "Views" },
                  { key: "watchHours", label: "Watch time (h)" },
                  { key: "subscribers", label: "Subscribers" },
                  ...(daily ? [] : [{ key: "published", label: "Published" }]),
                ] as {
                  key: NonNullable<DashboardInput["sort"]>;
                  label: string;
                }[]
              ).map(({ key, label }) => (
                <th
                  key={key}
                  scope="col"
                  aria-sort={
                    query.sort === key
                      ? query.direction === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                >
                  <button onClick={() => sort(key)}>
                    {label}
                    <ArrowDownUp size={12} />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <strong>{daily ? r.date : r.title}</strong>
                  {!daily && <span className="video-id">{r.id}</span>}
                </td>
                <td>{number(r.views)}</td>
                <td>{number(r.watchHours, 2)}</td>
                <td>{number(r.subscribers)}</td>
                {!daily && <td>{r.published ?? "—"}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!data.rows.length && (
        <div className="table-empty">No records match these filters.</div>
      )}
      <div className="table-footer">
        <span>
          — means the metric was not supplied. Publication dates are shown as
          exported.
        </span>
        <div>
          <button
            className="icon-button"
            aria-label="Previous page"
            disabled={data.page <= 1}
            onClick={() => update({ page: data.page - 1 })}
          >
            <ChevronLeft size={16} />
          </button>
          <span>
            Page {data.page} of {data.pageCount}
          </span>
          <button
            className="icon-button"
            aria-label="Next page"
            disabled={data.page >= data.pageCount}
            onClick={() => update({ page: data.page + 1 })}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </section>
  );
}
