"use client";

import Image from "next/image";

interface Props { positivePct: number }

export default function EthicalDecisionMakingWidget({ positivePct }: Props) {
  const pos = Math.max(0, Math.min(100, positivePct));
  const neg = 100 - pos;
  return (
    <section className="relative w-full bg-[#FEEED0] border-2 border-[#A03827] rounded-2xl mx-auto py-6 flex flex-col items-center justify-center">
      {/* title */}
      <div className="absolute -top-9 left-1/2 -translate-x-1/2 w-max"><Image src="/assets/Growth/edm_title.svg" alt="title" width={320} height={48} /></div>

      {/* bar */}
      <div className="w-[85%] h-6 rounded-full overflow-hidden flex relative">
        <div className="bg-[#4F9F58] flex items-center justify-center text-white text-xs font-semibold" style={{ width: `${pos}%` }}>{pos}%</div>
        <div className="bg-[#E84D3C] flex items-center justify-center text-white text-xs font-semibold" style={{ width: `${neg}%` }}>{neg}%</div>
      </div>

      <div className="w-[85%] mt-1 flex justify-between text-[11px] font-medium text-[#1F105C]">
        <span className="pl-1">Positive</span>
        <span className="pr-1">Negative</span>
      </div>
    </section>
  );
}
