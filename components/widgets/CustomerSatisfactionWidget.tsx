"use client";

import Image from "next/image";
import { useMemo } from "react";

interface Props {
  score: number;
}

export default function CustomerSatisfactionWidget({ score }: Props) {
  const pct = Math.max(0, Math.min(100, score));

  const displayPct = Math.round(pct * 100) / 100;

  const faces = [
    { pct: 0.25, icon: "Business_CS_Angry.svg" },
    { pct: 0.5, icon: "Business_CS_Neutral.svg" },
    { pct: 0.75, icon: "Business_CS_Hp.svg" },
    { pct: 0.91, icon: "Business_CS_kindahappy.svg" },
  ];

  const fillColor = useMemo(() => {
    if (pct > 75) return "#FFC709";
    if (pct > 50) return "#66943C";
    if (pct > 25) return "#1D2557";
    return "#B22335";
  }, [pct]);

  return (
    <section className="relative w-full bg-[#FEEED0] border-2 border-[#A03827] rounded-2xl mx-auto py-6 flex flex-col justify-center">
      {/* heading */}
      <div className="absolute -top-9 left-1/2 -translate-x-1/2 w-max">
        <Image
          src="/assets/Business/Customer Satisfaction/Business_CS_Title.svg"
          alt="title"
          width={320}
          height={48}
        />
      </div>

      {/* rail */}
      <div className="relative h-[48px] px-6 flex items-center">
        <div className="relative w-full h-4 rounded-full overflow-hidden ring-1 ring-black/10">
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(90deg, #FFB8C1 0%, #F3AFB7 17%, #667BFF 43%, #B5FF71 69%, #FFD25B 100%)",
              opacity: 0.38,
            }}
          />
          <div
            className="h-full"
            style={{
              width: `${pct}%`,
              mixBlendMode: "multiply",
              transition: "width 0.6s ease",
              backgroundColor: fillColor,
            }}
          />
        </div>

        {faces.map(({ pct: pos, icon }, i) => (
          <div
            key={i}
            className="absolute -translate-x-1/2"
            style={{ left: `calc(${pos * 100}% )` }}
          >
            <Image
              src={`/assets/Business/Customer Satisfaction/${icon}`}
              alt="face"
              width={32}
              height={32}
            />
          </div>
        ))}
      </div>

      {/* percentage */}
      <div
        className="absolute text-xs font-bold -translate-x-1/2 px-1"
        style={{ 
          left: `calc(${pct}% )`, 
          bottom: "8px", 
          color: fillColor,
          transform: `translateX(${pct < 10 ? '0%' : pct > 90 ? '-100%' : '-50%'})`
        }}
      >
        {displayPct}%
      </div>
    </section>
  );
}