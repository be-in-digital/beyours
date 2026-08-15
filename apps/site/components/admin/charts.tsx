"use client";

import * as React from "react";

/* Charts SVG légers (aucune dépendance) — area + bar, largeur mesurée. */

type Point = { label: string; value: number };

function useWidth(): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [w, setW] = React.useState(640);
  React.useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const ro = new ResizeObserver((entries) => {
      const cw = entries[0]?.contentRect.width;
      if (cw && cw > 0) setW(cw);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

function niceLabels(data: Point[]): number[] {
  if (data.length <= 2) return data.map((_, i) => i);
  const out = new Set<number>([0, data.length - 1, Math.floor((data.length - 1) / 2)]);
  return [...out].sort((a, b) => a - b);
}

export function AreaChart({
  data,
  height = 240,
  color = "var(--primary)",
  valueFormatter = (v) => String(v),
}: {
  data: Point[];
  height?: number;
  color?: string;
  valueFormatter?: (v: number) => string;
}) {
  const [ref, width] = useWidth();
  const gradId = React.useId();
  const [hover, setHover] = React.useState<number | null>(null);

  const padL = 46;
  const padB = 22;
  const padT = 10;
  const padR = 8;
  const w = Math.max(width, 200);
  const innerW = w - padL - padR;
  const innerH = height - padT - padB;

  const max = Math.max(1, ...data.map((d) => d.value));
  const stepX = data.length > 1 ? innerW / (data.length - 1) : 0;
  const x = (i: number) => padL + i * stepX;
  const y = (v: number) => padT + innerH - (v / max) * innerH;

  const line = data
    .map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`)
    .join(" ");
  const area = data.length
    ? `${line} L${x(data.length - 1).toFixed(1)},${padT + innerH} L${padL},${padT + innerH} Z`
    : "";

  const gridVals = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    if (data.length < 2) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const rel = e.clientX - rect.left - padL;
    const idx = Math.round(rel / stepX);
    setHover(Math.max(0, Math.min(data.length - 1, idx)));
  }

  return (
    <div ref={ref} className="w-full">
      <svg
        width={w}
        height={height}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        className="overflow-visible"
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        {gridVals.map((gv, i) => (
          <g key={i}>
            <line
              x1={padL}
              x2={w - padR}
              y1={y(gv)}
              y2={y(gv)}
              stroke="var(--chart-grid)"
              strokeWidth={1}
            />
            <text
              x={padL - 8}
              y={y(gv) + 3}
              textAnchor="end"
              className="fill-muted-foreground"
              style={{ fontSize: 10 }}
            >
              {valueFormatter(gv)}
            </text>
          </g>
        ))}
        {area && <path d={area} fill={`url(#${gradId})`} />}
        {line && <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />}
        {niceLabels(data).map((i) => (
          <text
            key={i}
            x={x(i)}
            y={height - 6}
            textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"}
            className="fill-muted-foreground"
            style={{ fontSize: 10 }}
          >
            {data[i]?.label}
          </text>
        ))}
        {hover !== null && data[hover] && (
          <g>
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={padT}
              y2={padT + innerH}
              stroke="var(--border-contrast)"
              strokeWidth={1}
            />
            <circle cx={x(hover)} cy={y(data[hover].value)} r={3.5} fill={color} />
            <g transform={`translate(${Math.min(x(hover) + 8, w - 96)}, ${padT + 6})`}>
              <rect width={90} height={34} rx={6} fill="var(--popover)" stroke="var(--border)" />
              <text x={8} y={14} className="fill-muted-foreground" style={{ fontSize: 9 }}>
                {data[hover].label}
              </text>
              <text x={8} y={27} className="fill-foreground" style={{ fontSize: 11, fontWeight: 600 }}>
                {valueFormatter(data[hover].value)}
              </text>
            </g>
          </g>
        )}
      </svg>
    </div>
  );
}

export function BarChart({
  data,
  height = 240,
  color = "var(--chart-2)",
  valueFormatter = (v) => String(v),
}: {
  data: Point[];
  height?: number;
  color?: string;
  valueFormatter?: (v: number) => string;
}) {
  const [ref, width] = useWidth();
  const padL = 46;
  const padB = 22;
  const padT = 10;
  const padR = 8;
  const w = Math.max(width, 200);
  const innerW = w - padL - padR;
  const innerH = height - padT - padB;
  const max = Math.max(1, ...data.map((d) => d.value));
  const slot = data.length ? innerW / data.length : innerW;
  const barW = Math.min(28, slot * 0.62);
  const y = (v: number) => padT + innerH - (v / max) * innerH;
  const gridVals = [0, 0.5, 1].map((f) => f * max);

  return (
    <div ref={ref} className="w-full">
      <svg width={w} height={height} className="overflow-visible">
        {gridVals.map((gv, i) => (
          <g key={i}>
            <line x1={padL} x2={w - padR} y1={y(gv)} y2={y(gv)} stroke="var(--chart-grid)" strokeWidth={1} />
            <text x={padL - 8} y={y(gv) + 3} textAnchor="end" className="fill-muted-foreground" style={{ fontSize: 10 }}>
              {valueFormatter(gv)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = padL + i * slot + slot / 2;
          const bh = (d.value / max) * innerH;
          return (
            <g key={i}>
              <rect
                x={cx - barW / 2}
                y={padT + innerH - bh}
                width={barW}
                height={bh}
                rx={3}
                fill={color}
              >
                <title>{`${d.label} · ${valueFormatter(d.value)}`}</title>
              </rect>
              <text x={cx} y={height - 6} textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 10 }}>
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
