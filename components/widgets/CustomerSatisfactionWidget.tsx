"use client";

/*  CustomerSatisfactionWidget  – fills gradient bar,
    emojis at quartiles, % label.  */

import Image from "next/image";

interface Props { score:number }   // 0-100

export default function CustomerSatisfactionWidget({ score }:Props) {
  const pct = Math.max(0, Math.min(100, score));

  const faces = [
    { pct:0.25, icon:"Business_CS_Angry.svg"      },
    { pct:0.50, icon:"Business_CS_Neutral.svg"    },
    { pct:0.75, icon:"Business_CS_Hp.svg"         },
    { pct:1.00, icon:"Business_CS_Verygood.svg"   },
  ];

  return (
    <section className="relative w-full max-w-[600px] mx-auto">
      {/* frame */}
      <Image src="/assets/Business/Customer Satisfaction/Business_CS_Frame.svg"
             alt="frame" fill priority/>

      {/* heading */}
      <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-max">
        <Image src="/assets/Business/Customer Satisfaction/Business_CS_Title.svg"
               alt="title" width={300} height={32}/>
      </div>

      {/* gradient rail */}
      <div className="relative h-[72px] px-8 flex items-center">
        <div className="relative w-full h-3 rounded-full overflow-hidden
                        ring-1 ring-black/10">
          <div className="absolute inset-0"
               style={{
                 background:"linear-gradient(90deg,#B22335 0%,#1D2557 25%,#66943C 50%,#FFC709 75%,#FFC709 100%)",
               }}/>
          {/* fill mask */}
          <div className="h-full bg-[#B22335]"
               style={{ width:`${pct}%`, mixBlendMode:"multiply",
                        transition:"width 0.6s ease" }}/>
        </div>
      </div>

      {/* emojis */}
      <div className="absolute inset-0 px-8 flex items-center pointer-events-none">
        {faces.map(({pct:pos,icon},i)=>(
          <div key={i}
               className="absolute -translate-x-1/2"
               style={{ left:`calc(${pos*100}% )` }}>
            <Image src={`/assets/Business/Customer Satisfaction/${icon}`}
                   alt="face" width={32} height={32}/>
          </div>
        ))}
      </div>

      {/* percentage label */}
      <div className="absolute left-8 bottom-[6px] text-xs font-semibold
                      text-[#B22335]">{pct}%</div>
    </section>
  );
}
