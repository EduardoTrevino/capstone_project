"use client";

/*  MonetaryGrowthWidget
    • filled line (#FF9A00) with ₹ coin dots (hidden in “ALL” mode)
    • fill gradient: #FFC709 → transparent
    • in-frame padding so nothing bleeds outside
    • Recharts tooltip → tiny rounded tag (#A03827)   */

import { useState, useMemo } from "react";
import Image                 from "next/image"; // Re-imported Image for the title asset
import {
  ResponsiveContainer, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";

interface Props {
  data: number[];
  latestCount?: number;   // default 6
}

export default function MonetaryGrowthWidget({ data, latestCount = 6 }: Props) {
  const [showAll, setShowAll] = useState(false);

  /* -------- dataset for Recharts -------- */
  const chartData = useMemo(() => {
    const arr = showAll ? data : data.slice(-latestCount);
    // Modified to just numbers for X-axis labels
    return arr.map((v,i) => ({
      name: `${i + 1}`, // Label for X-axis (1, 2, 3...)
      value: v
    }));
  }, [data, showAll, latestCount]);

  const yMax = Math.max(10, ...chartData.map(d=>d.value));
  // Not used: const yStep= Math.ceil(yMax/4/5)*5;

  /* ----------- custom tooltip ----------- */
  const CustomTip = ({ active, payload } : any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="px-2 py-1 rounded-md bg-[#A03827] text-white text-[10px] font-semibold">
        ₹ {payload[0].value}
      </div>
    );
  };

  /* ----------- ₹ coin dot --------------- */
  const CoinDot = (p:any) => {
    const { cx, cy, key } = p; // Destructure `key` provided by Recharts

    const width = 20;
    const height = 20;

    return (
      <image
        key={key} // Crucial fix for "Each child in a list should have a unique 'key' prop" error
        href="/assets/Revenue&Profits/Revenue&Profits_Coin/Revenue&Profits_Coin.svg"
        x={cx - width / 2}
        y={cy - height / 2}
        width={width}
        height={height}
      />
    );
  };

  /* ===================================== */
  return (
    <section className="relative w-full bg-[#F9E0B7] border border-[#A03827] rounded-2xl mx-auto py-8">
      {/* heading asset - retaining -top-9 as per your visual reference */}
      <div className="absolute -top-9 left-1/2 -translate-x-1/2 w-max">
        <Image src="/assets/Business/Monetary Growth/Business_Monetary Growth_Title.svg"
               alt="title" width={320} height={48}/>
      </div>

      {/* chart box - Adjusted padding for top and bottom space */}
      {/* Reduced pt-8 pb-10 to pt-4 pb-4 to decrease overall vertical empty space */}
      <div className="relative pt-4 pb-4 w-full h-[220px]"> {/* Changed pt/pb */}
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}
                     // Adjusted margins for LineChart to optimize space within its container
                     // Small top/bottom margin for data points/labels, zero left/right for full width
                     margin={{ top:5, right:0, left:0, bottom:5 }}> {/* Adjusted margins */}
            <defs>
              <linearGradient id="growthFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#FFC709" stopOpacity={0.9}/>
                <stop offset="100%" stopColor="#FFC709" stopOpacity={0.0}/>
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#9E826F" strokeDasharray="3 3" strokeOpacity={0.4}/>
            <XAxis  dataKey="name" tick={{ fill:"#61412C", fontSize:10 }} tickLine={false} axisLine={false}
                    padding={{ left: 20, right: 20 }} />
            <YAxis  domain={[0, yMax]} interval="preserveStartEnd"
                    tick={{ fill:"#61412C", fontSize:10 }} tickLine={false} axisLine={false}
                    tickFormatter={(v)=>v===0?"":v}/>
            <Tooltip content={<CustomTip/>} cursor={{ stroke:"transparent" }}/>
            <Line type="monotone" dataKey="value"
                  stroke="#FF9A00" strokeWidth={2}
                  dot={showAll ? false : CoinDot}
                  activeDot={{r:4}}
                  fill="url(#growthFill)" fillOpacity={1}/>
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* toggle button */}
      <button
        onClick={()=>setShowAll(s=>!s)}
        className="absolute bottom-3 right-5 bg-[#F8D660] text-[#1F105C]
                   text-[11px] font-semibold px-4 py-1 rounded-lg shadow
                   hover:scale-105 transition">
        {showAll ? "LATEST" : "ALL"}
      </button>
    </section>
  );
}