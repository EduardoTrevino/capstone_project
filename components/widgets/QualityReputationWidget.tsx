"use client";

/* --------------------------------------------------------------------------
   QualityReputationWidget – placeholder message inside decorative frame
--------------------------------------------------------------------------- */

import Image from "next/image";

export default function QualityReputationWidget() {
  return (
    <section className="relative w-full max-w-[600px] mx-auto text-center">
      <Image src="/assets/Business/Quality&Reputation/Business_Q&R_Frame.svg" alt="QR frame" fill />
      <div className="relative py-16 px-10 text-sm font-medium text-[#1F105C]">
        No quality or reputation from your community yet. Check again soon!
      </div>
    </section>
  );
}
