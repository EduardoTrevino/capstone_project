"use client";

import Image from "next/image";

interface Props {
  score: number;
}

export default function QualityReputationWidget({ score }: Props) {
  // Calculate filled stars based on score (0-5)
  const filledStars = Math.min(5, Math.max(0, score));
  const hasHalfStar = filledStars % 1 >= 0.5;

  return (
    <section className="relative w-full bg-[#FEEED0] border-2 border-[#A03827] rounded-2xl mx-auto py-8 flex flex-col items-center justify-center">
      {/* heading */}
      <div className="absolute -top-9 left-1/2 -translate-x-1/2 w-max">
        <Image src="/assets/Business/Quality&Reputation/Business_Q&R_Title.svg" alt="title" width={320} height={48} />
      </div>

      {/* stars */}
      <div className="flex gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="relative w-12 h-12">
            {/* base grey star */}
            <Image src="/assets/Business/Quality&Reputation/star.svg" alt="star" fill />
            {/* overlay filled part */}
            {(i < Math.floor(filledStars) || (i === Math.floor(filledStars) && hasHalfStar)) && (
              <div
                className="absolute inset-0"
                style={{
                  background: "#FFC709",
                  WebkitMask: "url('/assets/Business/Quality&Reputation/star.svg') center / contain no-repeat",
                  mask: "url('/assets/Business/Quality&Reputation/star.svg') center / contain no-repeat",
                  clipPath: (i === Math.floor(filledStars) && hasHalfStar) ? "inset(0 50% 0 0)" : undefined,
                }}
              />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

