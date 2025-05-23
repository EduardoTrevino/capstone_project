"use client";

/*  CustomerSatisfactionWidget  – fills gradient bar,
    emojis at quartiles, % label.  */

import Image from "next/image";
import { useMemo } from "react";

interface Props { score:number }   // 0-100

export default function CustomerSatisfactionWidget({ score }:Props) {
  const pct = Math.max(0, Math.min(100, score));

  const faces = [
    { pct:0.25, icon:"Business_CS_Angry.svg"      },
    { pct:0.50, icon:"Business_CS_Neutral.svg"    },
    { pct:0.75, icon:"Business_CS_Hp.svg"         },
    { pct:1.00, icon:"Business_CS_Verygood.svg"   },
  ];

  // Dynamic fill color based on score percentage ranges
  const fillColor = useMemo(() => {
      if (pct >= 75) return "#FFC709"; // Very Happy (75-100%)
      if (pct >= 50) return "#66943C"; // Happy (50-75%)
      if (pct >= 25) return "#1D2557"; // Neutral (25-50%)
      return "#B22335"; // Angry (0-25%)
  }, [pct]);

  return (
    <section className="relative w-full bg-[#F9E0B7] border border-[#A03827] rounded-2xl mx-auto py-8 h-[120px] flex flex-col justify-center">
      {/* heading - Adjusted top positioning */}
      <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-max"> {/* Changed -top-10 to -top-12 */}
        <Image src="/assets/Business/Customer Satisfaction/Business_CS_Title.svg"
               alt="title" width={320} height={48}/>
      </div>

      {/* gradient rail container */}
      <div className="relative h-[40px] px-6 flex items-center">
        <div className="relative w-full h-3 rounded-full overflow-hidden
                        ring-1 ring-black/10">
          {/* New background gradient with 38% opacity */}
          <div className="absolute inset-0"
               style={{
                 background:"linear-gradient(90deg, #FFB8C1 0%, #F3AFB7 17%, #667BFF 43%, #B5FF71 69%, #FFD25B 100%)",
                 opacity: 0.38, // Overall opacity for the gradient background
               }}/>
          {/* fill mask - background color is now dynamic */}
          <div className="h-full"
               style={{ width:`${pct}%`, mixBlendMode:"multiply",
                        transition:"width 0.6s ease", backgroundColor: fillColor }}/> {/* Dynamic fill color */}
        </div>
      </div>

      {/* emojis */}
      <div className="absolute inset-0 px-6 flex items-center pointer-events-none">
        {faces.map(({pct:pos,icon},i)=>(
          <div key={i} // Key is correctly provided for list children
               className="absolute -translate-x-1/2"
               style={{ left:`calc(${pos*100}% )` }}>
            <Image src={`/assets/Business/Customer Satisfaction/${icon}`}
                   alt="face" width={32} height={32}/>
          </div>
        ))}
      </div>

      {/* percentage label - text color is now dynamic */}
      <div className="absolute left-6 bottom-[6px] text-xs font-semibold"
           style={{ color: fillColor }}>{pct}%</div> {/* Dynamic text color */}
    </section>
  );
}