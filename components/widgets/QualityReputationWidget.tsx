"use client";

import Image from "next/image";

export default function QualityReputationWidget() {
  return (
    // Replaced Image frame with custom div styling
    // Added explicit height and flex for vertical centering of content
    <section className="relative w-full bg-[#F9E0B7] border border-[#A03827] rounded-2xl mx-auto py-4 h-[180px] flex flex-col items-center justify-center text-center">
      {/* heading */}
      <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-max">
        <Image src="/assets/Business/Quality&Reputation/Business_Q&R_Title.svg"
               alt="title" width={300} height={32}/>
      </div>

      {/* Adjusted padding for text content */}
      <div className="relative py-8 px-6 text-sm font-medium text-[#1F105C]">
        No quality or reputation from your community yet. Check again soon!
      </div>
    </section>
  );
}