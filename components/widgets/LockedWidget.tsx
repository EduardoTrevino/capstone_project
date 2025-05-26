"use client";

import Image from "next/image";

export default function LockedWidget({ titleSrc }: { titleSrc: string }) {
  return (
    <section className="relative w-full bg-[#FEEED0]/50 border-2 border-[#A03827]/40 rounded-2xl mx-auto py-8 flex items-center justify-center backdrop-blur-sm">
      <div className="absolute -top-9 left-1/2 -translate-x-1/2 w-max opacity-60"><Image src={titleSrc} alt="title" width={320} height={48} /></div>
      <Image src="/assets/lock_white.svg" alt="locked" width={48} height={48} className="opacity-80" />
    </section>
  );
}