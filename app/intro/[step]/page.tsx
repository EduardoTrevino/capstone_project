"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import React from "react"
import { supabase } from "@/lib/supabase"

export default function IntroPage() {
  const [username, setUsername] = useState("")
  const [currentIndex, setCurrentIndex] = useState(0)
  const router = useRouter()

  useEffect(() => {
    const storedUsername = localStorage.getItem("username")
    if (!storedUsername) {
      router.push("/")
    } else {
      setUsername(storedUsername)
    }
  }, [router])

  // Replace these with whichever steps (messages) you prefer:
  const steps = [
    `Hello ${username}! I'm Rani Singh, and I'm thrilled to welcome you to our village. Word around town is that you're here to start something special—an entrepreneurial venture that will transform agriculture with drone technology!`,
    `We have many crop fields! Many farmers here struggle to maintain efficiency and keep up with modern methods. With drones, they'll save time, reduce costs, and protect precious resources.`,
    `Your business will revolve around leasing drones to farmers so they can book a slot, use the drones, and pay a fee. It's as simple as that! But remember—managing revenue, reputation, and customer satisfaction will be just as important as the drones themselves.`
  ]

  async function handleTapAnywhere() {
    // Play click sound
    const audio = new Audio("/intro/speech_click.mp3")
    await audio.play()

    // Move to the next text or finish
    if (currentIndex < steps.length - 1) {
      setCurrentIndex((prev) => prev + 1)
    } else {
      // If we just finished the last step, mark intro as done and go to dashboard
      if (username) {
        const { error } = await supabase
          .from("users")
          .update({ intro_done: true })
          .eq("name", username)

        if (error) {
          console.error("Error updating intro_done:", error.message)
        }
      }
      router.push("/dashboard")
    }
  }

  return (
    <main
      // Entire screen is clickable
      onClick={handleTapAnywhere}
      className="relative w-full min-h-screen bg-cover bg-center"
      style={{
        backgroundImage: 'url("/intro/intro_bg.png")'
      }}
    >
      {/* Rani's full-body image */}
      <div className="absolute bottom-0 left-0 w-[250px] md:w-[300px]">
        <Image
          src="/intro/rani_singh_full_body.png"
          alt="Rani Singh"
          width={300}
          height={600}
          style={{ objectFit: "contain" }}
          priority
        />
      </div>

      {/* “Speech bubble” or “gamified” text box */}
      <div
        className="
          absolute 
          left-[150px] bottom-[110px] 
          bg-white rounded-xl shadow-lg 
          p-4 max-w-xs 
          border-4
          font-semibold
        "
      >
        {steps[currentIndex]}
      </div>
    </main>
  )
}
