"use client";

import Image from "next/image";

interface Props { level: "safe" | "calculative" | "high" | "high-risk" | "calc" | "safe" }

const COLORS = ["#FED7AA", "#FB923C", "#EA580C"];
const LABELS = ["Safe", "Calculative", "High-Risk"];

export default function RiskTakingAbilityWidget({ level }: Props) {
  const idx = level.startsWith("high") ? 2 : level.startsWith("calc") ? 1 : 0;
  const pointerAngle = -90 + idx * 60 + 30; // midpoint of sector

  return (
    <section className="relative w-full bg-[#FEEED0] border-2 border-[#A03827] rounded-2xl mx-auto py-8 flex flex-col items-center justify-center">
      <div className="absolute -top-9 left-1/2 -translate-x-1/2 w-max"><Image src="/assets/Growth/rta_title.svg" alt="title" width={320} height={48} /></div>

      <svg viewBox="0 0 200 120" className="w-[220px] h-[140px]">
        {/* sectors */}
        {COLORS.map((c, i) => (
          <path key={i} d="M100 100 A80 80 0 0 1 20 100" fill="none" stroke={c} strokeWidth="40" strokeDasharray="75 75" strokeDashoffset={-i * 75} transform="rotate(60,100,100)" />
        ))}
        {/* pointer */}
        <line x1="100" y1="100" x2="100" y2="35" stroke="#1F105C" strokeWidth="4" transform={`rotate(${pointerAngle},100,100)`} />
      </svg>

      <span className="text-sm font-semibold text-[#FB923C]">{LABELS[idx]}</span>
    </section>
  );
}