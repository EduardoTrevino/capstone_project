"use client";

/* --------------------------------------------------------------------------
   CustomerSatisfactionWidget – gradient bar + emoji markers
--------------------------------------------------------------------------- */

import Image from "next/image";

interface Props {
  score: number; // 0‑100
}

export default function CustomerSatisfactionWidget({ score }: Props) {
  const clamped = Math.min(100, Math.max(0, score));
  const fillWidth = `${clamped}%`;

  const faceMap = [
    { pct: 0.25, asset: "/assets/Business/Customer Satisfaction/Business_CS_Angry.svg" },
    { pct: 0.5, asset: "/assets/Business/Customer Satisfaction/Business_CS_Neutral.svg" },
    { pct: 0.75, asset: "/assets/Business/Customer Satisfaction/Business_CS_Hp.svg" },
    { pct: 1, asset: "/assets/Business/Customer Satisfaction/Business_CS_Verygood.svg" },
  ];

  return (
    <section className="relative w-full max-w-[600px] mx-auto">
      {/* Frame */}
      <Image src="/assets/Business/Customer Satisfaction/Business_CS_Frame.svg" alt="CS frame" fill />

      {/* Gradient bar */}
      <div className="relative h-[68px] px-6 flex items-center">
        <div className="relative w-full h-3 rounded-full overflow-hidden" style={{ background: "linear-gradient(90deg,#B22335 0%,#1D2557 25%,#66943C 50%,#FFC709 75%,#FFC709 100%)" }}>
          <div className="h-full bg-[#B22335]" style={{ width: fillWidth, transition: "width 0.6s ease" }} />
        </div>
      </div>

      {/* Emoji markers */}
      <div className="absolute inset-0 px-6 flex items-center justify-between pointer-events-none">
        {faceMap.map(({ pct, asset }, idx) => (
          <div key={idx} className="relative" style={{ left: `calc(${pct * 100}% - 14px)` }}>
            <Image src={asset} alt="face" width={28} height={28} />
          </div>
        ))}
      </div>

      {/* Percentage label */}
      <div className="absolute left-8 bottom-1 text-xs font-semibold text-[#B22335]">{clamped}%</div>
    </section>
  );
}
