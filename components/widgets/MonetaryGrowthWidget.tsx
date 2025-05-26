"use client";

import { useMemo } from "react";
import Image from "next/image";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

interface Props {
  data: number[];
  total: number;
}

export default function MonetaryGrowthWidget({ data, total }: Props) {
  const chartData = useMemo(() => data.map((v, i) => ({ name: `${i + 1}`, value: v })), [data]);
  const yMax = Math.max(10, ...chartData.map(d => d.value));

  const CustomTip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    return <div className="px-2 py-1 rounded-md bg-[#A03827] text-white text-[10px] font-semibold">₹ {payload[0].value}</div>;
  };

  return (
    <section className="relative w-full bg-[#FEEED0] border-2 border-[#A03827] rounded-2xl mx-auto py-8">
      {/* heading */}
      <div className="absolute -top-9 left-1/2 -translate-x-1/2 w-max">
        <Image src="/assets/Business/Monetary Growth/Business_Monetary Growth_Title.svg" alt="title" width={320} height={48} />
      </div>

      {/* total */}
      <div className="absolute top-6 left-6 flex items-center gap-1 z-10">
        <Image src="/assets/Revenue&Profits/Revenue&Profits_Coin/Revenue&Profits_Coin.svg" alt="coin" width={24} height={24} />
        <span className="text-lg font-bold text-[#B22335]">{total.toLocaleString()}</span>
      </div>

      {/* chart */}
      <div className="relative pt-12 pb-2 w-full h-[230px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: -10 }}>
            <defs>
              <linearGradient id="growthFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FFC709" stopOpacity={0.9} />
                <stop offset="100%" stopColor="#FFC709" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#B22335" strokeDasharray="3 3" strokeOpacity={0.4} />
            <XAxis dataKey="name" stroke="#B22335" tick={{ fill: "#B22335", fontSize: 10 }} axisLine={{ stroke: "#B22335" }} tickLine={{ stroke: "#B22335" }} />
            <YAxis domain={[0, yMax]} stroke="#B22335" tick={{ fill: "#B22335", fontSize: 10 }} axisLine={{ stroke: "#B22335" }} tickLine={{ stroke: "#B22335" }} tickFormatter={v => (v === 0 ? "" : v)} />
            <Tooltip content={<CustomTip />} cursor={{ stroke: "transparent" }} />
            <Line type="monotone" dataKey="value" stroke="#FF9A00" strokeWidth={2} dot={{ r: 3, strokeWidth: 0, fill: "#FF9A00" }} activeDot={{ r: 4 }} fill="url(#growthFill)" fillOpacity={1} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}