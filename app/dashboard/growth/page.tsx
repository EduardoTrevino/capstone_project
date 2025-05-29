"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Header, BottomNav } from "@/app/dashboard/page";
import EthicalDecisionMakingWidget from "@/components/widgets/EthicalDecisionMakingWidget";
import RiskTakingAbilityWidget from "@/components/widgets/RiskTakingAbilityWidget";
import LockedWidget from "@/components/widgets/LockedWidget";

export default function GrowthPage() {
  const router = useRouter();

  const [username] = useState("Eduardo_Test");
  const [avatar, setAvatar] = useState("");
  const [goalPct] = useState(0);

  return (
    <main
      className="min-h-screen w-full overflow-x-hidden overflow-y-auto pb-[120px] flex flex-col"
      style={{ background: "url('/assets/Background/PNG/Fixed Background.png') center/cover" }}
    >
      <Header
        username={username}
        avatar={avatar}
        goalPct={goalPct}
        onAvatarClick={() => {}}
        onLogClick={() => router.push("/dashboard/log")}
        onGoalEdit={() => {}}
      />

      <div className="flex-1 px-4 mt-10 space-y-10 mx-auto w-full max-w-[600px]">
        <EthicalDecisionMakingWidget positivePct={25} />
        <RiskTakingAbilityWidget score={100} />
        <LockedWidget titleSrc="/assets/Growth/ct_title.svg" />
        <LockedWidget titleSrc="/assets/Growth/aspi_title.svg" />
      </div>

      <BottomNav router={router} />
    </main>
  );
}
