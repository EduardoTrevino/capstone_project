"use client";

/* --------------------------------------------------------------------------
   MonetaryGrowthWidget
   --------------------------------------------------------------------------
   Props
     • data: number[]   // sequential earnings (₹) per time‑step
     • maxPoints? number  (default 6)

   Behaviour
     • Shows the latest `maxPoints` in a filled line‑chart style (Recharts).
     • A toggle button ("ALL") reveals the full data set (compressed) – when in
       ALL mode, the decorative Rupee‑coin dots are hidden to avoid clutter.
     • Chart is rendered on top of the Business_Monetary Growth_Frame.svg asset.

   NOTE: Replace demo colours / fonts with Tailwind tokens from your design
         system as desired. The widget is fully responsive inside its frame.
--------------------------------------------------------------------------- */

import { useState, useMemo } from "react";
import Image from "next/image";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

interface Props {
  data: number[];
  maxPoints?: number;
}

export default function MonetaryGrowthWidget({ data, maxPoints = 6 }: Props) {
  const [showAll, setShowAll] = useState(false);

  /* --------------------------- prepare data --------------------------- */
  const chartData = useMemo(() => {
    const trimmed = showAll ? data : data.slice(-maxPoints);
    return trimmed.map((v, i) => ({ idx: i + 1, value: v }));
  }, [data, showAll, maxPoints]);

  const yDomain = useMemo(() => {
    const vals = chartData.map((d) => d.value);
    const max = Math.max(10, ...vals);
    return [0, Math.ceil(max / 10) * 10]; // round up to nearest 10
  }, [chartData]);

  /* ------------------------- custom dot with coin --------------------- */
  const renderDot = (props: any) => {
    const { cx, cy, payload } = props;
    if (showAll) return <circle cx={cx} cy={cy} r={0} />; // Return empty circle instead of null
    return (
      <Image
        src="/assets/Revenue&Profits/Revenue&Profits_Coin/Revenue&Profits_Coin.svg"
        alt="coin"
        width={20}
        height={20}
        style={{ position: "absolute", left: cx - 10, top: cy - 10 }}
      />
    );
  };

  /* ------------------------------------------------------------------- */
  return (
    <section className="relative w-full max-w-[600px] mx-auto">
      {/* Frame */}
      <Image
        src="/assets/Business/Monetary Growth/Business_Monetary Growth_Frame.svg"
        alt="Monetary Growth Frame"
        fill
      />

      {/* Chart inside padded box */}
      <div className="relative px-6 pt-6 pb-10 w-full h-[225px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="growthFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#F0C96D" stopOpacity={0.9} />
                <stop offset="100%" stopColor="#F0C96D" stopOpacity={0.3} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#9E826F" strokeOpacity={0.4} />
            <XAxis dataKey="idx" tick={{ fill: "#61412C", fontSize: 10 }} tickLine={false} />
            <YAxis domain={yDomain} tick={{ fill: "#61412C", fontSize: 10 }} tickLine={false} width={30} />
            <Tooltip cursor={{ stroke: "transparent" }} />
            <Line type="monotone" dataKey="value" stroke="#C58A00" strokeWidth={2} dot={renderDot} fill="url(#growthFill)" fillOpacity={1} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Toggle */}
      <button
        className="absolute bottom-2 right-4 bg-[#F8D660] text-[#1F105C] text-xs font-semibold px-3 py-1 rounded-lg shadow hover:scale-105 transition-transform"
        onClick={() => setShowAll((s) => !s)}
      >
        {showAll ? "LATEST" : "ALL"}
      </button>
    </section>
  );
}
