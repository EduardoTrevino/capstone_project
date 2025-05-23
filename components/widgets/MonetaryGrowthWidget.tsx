"use client";

/*  MonetaryGrowthWidget  
    • filled line (#FF9A00) with ₹ coin dots (hidden in “ALL” mode)
    • fill gradient: #FFC709 → transparent
    • in-frame padding so nothing bleeds outside
    • Recharts tooltip → tiny rounded tag (#A03827)   */

import { useState, useMemo } from "react";
// Removed Image import as we'll use native SVG <image>
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
    // Modified to include "Week X" labels for XAxis, as seen in reference
    return arr.map((v,i) => ({ 
      week: `Week ${i + 1}`, // Assuming data maps to sequential weeks
      value: v 
    }));
  }, [data, showAll, latestCount]);

  const yMax = Math.max(10, ...chartData.map(d=>d.value));
  const yStep= Math.ceil(yMax/4/5)*5;               // nice ticks

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
  // Changed to return an SVG <image> element directly, as required by Recharts
  const CoinDot = (p:any) => {
    const { cx, cy } = p;
    // Define width and height for positioning
    const width = 20;
    const height = 20;

    // Recharts `cx` and `cy` are center points. For SVG <image>, `x` and `y` are top-left.
    return (
      <image
        href="/assets/Revenue&Profits/Revenue&Profits_Coin/Revenue&Profits_Coin.svg"
        x={cx - width / 2} // Calculate top-left x
        y={cy - height / 2} // Calculate top-left y
        width={width}
        height={height}
        // No need for `opacity: showAll ? 0 : 1` here anymore, as `dot={showAll ? false : CoinDot}` handles visibility.
      />
    );
  };

  /* ===================================== */
  return (
    // Replaced Image frame with custom div styling
    <section className="relative w-full bg-[#F9E0B7] border border-[#A03827] rounded-2xl mx-auto py-4">
      {/* heading asset */}
      <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-max">
        {/* Still use next/image for static assets outside Recharts SVG */}
        <img src="/assets/Business/Monetary Growth/Business_Monetary Growth_Title.svg"
               alt="title" width={240} height={32}/>
      </div>

      {/* chart box */}
      {/* Removed px-6 from this div to remove outer indentation, allowing chart to stretch */}
      <div className="relative pt-8 pb-10 w-full h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}
                     // Adjusted margins to reduce internal indentation
                     margin={{ top:10, right:20, left:20, bottom:0 }}>
            <defs>
              <linearGradient id="growthFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#FFC709" stopOpacity={0.9}/>
                <stop offset="100%" stopColor="#FFC709" stopOpacity={0.0}/>
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#9E826F" strokeDasharray="3 3" strokeOpacity={0.4}/>
            {/* Changed dataKey to 'week' for week labels on XAxis */}
            <XAxis  dataKey="week" tick={{ fill:"#61412C", fontSize:10 }} tickLine={false} axisLine={false}/>
            <YAxis  domain={[0, yMax]} interval="preserveStartEnd"
                    tick={{ fill:"#61412C", fontSize:10 }} tickLine={false} axisLine={false}
                    tickFormatter={(v)=>v===0?"":v}/>
            <Tooltip content={<CustomTip/>} cursor={{ stroke:"transparent" }}/>
            <Line type="monotone" dataKey="value"
                  stroke="#FF9A00" strokeWidth={2}
                  // Conditionally pass CoinDot or false to the dot prop
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