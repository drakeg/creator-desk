import { BarChart3 } from "lucide-react";
export function ReportChart({
  points,
  daily,
}: {
  points: { date: string; views: number }[];
  daily: boolean;
}) {
  if (!points.length)
    return (
      <div className="chart-empty">
        <BarChart3 size={24} />
        <p>
          {daily
            ? "No daily records match this range."
            : "Import a daily report to see views over time."}
        </p>
        <span>
          {daily
            ? "Try another date range or clear the search."
            : "A video table contains totals for its whole reporting period."}
        </span>
      </div>
    );
  const peak = Math.max(0, ...points.map((p) => p.views));
  const max = Math.max(1, peak);
  const start = Date.parse(points[0].date),
    end = Date.parse(points.at(-1)!.date);
  const x = (date: string) =>
    end === start
      ? 500
      : 40 + ((Date.parse(date) - start) / (end - start)) * 920;
  const y = (views: number) => 140 - (views / max) * 116;
  const path = points
    .map(
      (p, i) =>
        `${i === 0 ? "M" : "L"}${x(p.date).toFixed(2)},${y(p.views).toFixed(2)}`,
    )
    .join(" ");
  return (
    <div className="report-chart">
      <div className="chart-caption">
        <span>Daily views</span>
        <span>{peak.toLocaleString()} peak</span>
      </div>
      <svg
        viewBox="0 0 1000 165"
        role="img"
        aria-label={`Daily views from ${points[0].date} to ${points.at(-1)!.date}. Peak ${peak.toLocaleString()} views.`}
      >
        <line x1="40" x2="960" y1="140" y2="140" className="chart-axis" />
        <line x1="40" x2="960" y1="82" y2="82" className="chart-grid" />
        <path
          d={`${path} L${x(points.at(-1)!.date)},140 L${x(points[0].date)},140 Z`}
          className="chart-area"
        />
        <path d={path} className="chart-line" />
        {points.length === 1 && (
          <circle
            cx="500"
            cy={y(points[0].views)}
            r="4"
            className="chart-point"
          />
        )}
      </svg>
      <div className="chart-caption">
        <span>{points[0].date}</span>
        <span>{points.at(-1)!.date}</span>
      </div>
    </div>
  );
}
