"use client";

import Image from "next/image";

export default function QualityReputationWidget() {
  return (
    <section className="relative w-full bg-[#FEEED0] border-2 border-[#A03827] rounded-2xl mx-auto py-8 flex flex-col items-center justify-center">
      {/* heading */}
      <div className="absolute -top-9 left-1/2 -translate-x-1/2 w-max">
        <Image
          src="/assets/Business/Quality&Reputation/Business_Q&R_Title.svg"
          alt="title"
          width={320}
          height={48}
        />
      </div>

      {/* stars */}
      <div className="flex gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Image key={i} src="/assets/Business/Quality&Reputation/star.svg" alt="star" width={48} height={48} />
        ))}
      </div>
    </section>
  );
}
