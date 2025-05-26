"use client";

import Image from "next/image";

interface Props { score: number }                // 0 – 100

const LABELS = ["Safe", "Calculative", "High-Risk"];

/* clamp + derive label + angle */
function pointerInfo(score: number) {
  const s = Math.max(0, Math.min(100, score));
  const idx = s < 33 ? 0 : s < 66 ? 1 : 2;

  // map 0-100 → –60° … +60°  (three 40°-wide slice centres)
  const angle = -94 + (s / 63) * 120;
  return { idx, angle };
}

export default function RiskTakingAbilityWidget({ score }: Props) {
  const { idx, angle } = pointerInfo(score);

  return (
    <section className="relative w-full bg-[#FEEED0] border-2 border-[#A03827] rounded-2xl mx-auto py-8 flex flex-col items-center justify-center">
      {/* title */}
      <div className="absolute -top-9 left-1/2 -translate-x-1/2 w-max">
        <Image src="/assets/Growth/rta_title.svg" alt="title" width={320} height={48} />
      </div>

      {/* gauge + pointer */}
      <svg viewBox="0 0 200 120" className="w-[220px] h-[140px] mb-2">
        <image href="/assets/Growth/risk_meter.svg" x="0" y="0" width="200" height="120" />
        <line
          x1="100"
          y1="100"
          x2="100"
          y2="38"
          stroke="#1F105C"
          strokeWidth="4"
          strokeLinecap="round"
          transform={`rotate(${angle},100,100)`}
        />
      </svg>

      <span className="text-sm font-semibold text-[#FB923C]">
        {LABELS[idx]}
      </span>
    </section>
  );
}
