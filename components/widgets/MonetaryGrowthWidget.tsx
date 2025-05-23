"use client";

/*  MonetaryGrowthWidget  –  Figma-accurate
    • filled line (#FF9A00) with ₹ coin dots (hidden in “ALL” mode)
    • fill gradient: #FFC709 → transparent
    • in-frame padding so nothing bleeds outside
    • Recharts tooltip → tiny rounded tag (#A03827)   */

import { useState, useMemo } from "react";
import Image                 from "next/image";
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
    return arr.map((v,i) => ({ idx:i+1, value:v }));
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
  const CoinDot = (p:any) => {
    const { cx, cy } = p;
    return (
      <Image src="/assets/Revenue&Profits/Revenue&Profits_Coin/Revenue&Profits_Coin.svg"
             alt="coin" width={20} height={20}
             style={{ position:"absolute", left:cx-10, top:cy-10, opacity: showAll ? 0 : 1 }}/>
    );
  };

  /* ===================================== */
  return (
    <section className="relative w-full max-w-[600px] mx-auto">
      {/* frame img */}
      <Image src="/assets/Business/Monetary Growth/Business_Monetary Growth_Frame.svg"
             alt="frame" fill priority/>
      {/* heading asset */}
      <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-max">
        <Image src="/assets/Business/Monetary Growth/Business_Monetary Growth_Title.svg"
               alt="title" width={240} height={32}/>
      </div>

      {/* chart box */}
      <div className="relative px-6 pt-8 pb-10 w-full h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}
                     margin={{ top:10, right:10, left:10, bottom:0 }}>
            <defs>
              <linearGradient id="growthFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#FFC709" stopOpacity={0.9}/>
                <stop offset="100%" stopColor="#FFC709" stopOpacity={0.0}/>
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#9E826F" strokeDasharray="3 3" strokeOpacity={0.4}/>
            <XAxis  dataKey="idx" tick={{ fill:"#61412C", fontSize:10 }} tickLine={false}/>
            <YAxis  domain={[0, yMax]} interval="preserveStartEnd"
                    tick={{ fill:"#61412C", fontSize:10 }} tickLine={false}
                    tickFormatter={(v)=>v===0?"":v}/>
            <Tooltip content={<CustomTip/>} cursor={{ stroke:"transparent" }}/>
            <Line type="monotone" dataKey="value"
                  stroke="#FF9A00" strokeWidth={2}
                  dot={CoinDot} activeDot={{r:4}}
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
