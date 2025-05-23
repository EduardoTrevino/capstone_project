"use client";

import Image from "next/image";

export default function QualityReputationWidget() {
  return (
    <section className="relative w-full max-w-[600px] mx-auto text-center">
      {/* heading */}
      <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-max">
        <Image src="/assets/Business/Quality&Reputation/Business_Q&R_Title.svg"
               alt="title" width={300} height={32}/>
      </div>

      <Image src="/assets/Business/Quality&Reputation/Business_Q&R_Frame.svg"
             alt="frame" fill priority/>
      <div className="relative py-20 px-10 text-sm font-medium text-[#1F105C]">
        No quality or reputation from your community yet. Check again soon!
      </div>
    </section>
  );
}
