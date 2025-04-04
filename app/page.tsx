"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { supabase } from "@/lib/supabase"

export default function Home() {
  const [username, setUsername] = useState("")
  // This controls the start button's image swap
  const [isButtonClicked, setIsButtonClicked] = useState(false)
  const [isMuted, setIsMuted] = useState(true)  
  const [audioLoaded, setAudioLoaded] = useState(false)

  const router = useRouter()

  const bgmAudioRef = useRef<HTMLAudioElement | null>(null)
  const clickAudioRef = useRef<HTMLAudioElement | null>(null)

  // ------------------------------------------------------
  // 1) On mount, create audio objects
  // ------------------------------------------------------
  useEffect(() => {
    //https://www.youtube.com/watch?v=xu2pESvXcmM
    const bgmAudio = new Audio("/intro_bgm.mp3")
    bgmAudio.loop = true
    bgmAudio.muted = true // start muted
    bgmAudio.play().catch((err) => {
      console.log("BGM playback blocked/failed:", err)
    })
    bgmAudioRef.current = bgmAudio

    const clickAudio = new Audio("/button_click.mp3")
    clickAudioRef.current = clickAudio

    setAudioLoaded(true)

    // Cleanup if leaving page
    return () => {
      bgmAudio.pause()
      bgmAudio.currentTime = 0
    }
  }, [])

  // Play the short click sound
  function playClickSound() {
    if (!clickAudioRef.current) return
    clickAudioRef.current.currentTime = 0
    clickAudioRef.current.play().catch((err) => {
      console.log("Click sound playback failed:", err)
    })
  }

  // 2) If user focuses the input, unmute BGM
  function handleFocus() {
    playClickSound()
    if (!bgmAudioRef.current) return
    if (bgmAudioRef.current.muted) {
      bgmAudioRef.current.muted = false
      setIsMuted(false)
      bgmAudioRef.current.play().catch((err) => {
        console.error("BGM play after focus failed:", err)
      })
    }
  }

  // 3) Toggle Mute for the BGM
  function toggleMute() {
    playClickSound()
    if (!bgmAudioRef.current) return
    if (bgmAudioRef.current.muted) {
      bgmAudioRef.current.muted = false
      setIsMuted(false)
      bgmAudioRef.current.play().catch((err) => console.error(err))
    } else {
      bgmAudioRef.current.muted = true
      setIsMuted(true)
    }
  }

  // 4) Handle login/submit
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!username.trim()) return

    playClickSound()

    const { data: existingUser, error } = await supabase
      .from("users")
      .select("*")
      .eq("name", username)
      .single()

    if (error) {
      console.log("User not found, creating new user...")
      const { data: newUser, error: createError } = await supabase
        .from("users")
        .insert([{ name: username }])
        .select()
        .single()

      if (createError) {
        console.error("Error creating user:", createError.message)
        return
      }
      if (!newUser) {
        console.error("No user data returned after insert")
        return
      }
      localStorage.setItem("username", newUser.name)
      router.push("/intro/1")
      return
    }

    localStorage.setItem("username", existingUser.name)

    if (existingUser.intro_done) {
      router.push("/dashboard")
    } else {
      router.push("/intro/1")
    }
  }

  return (
    <main
      className="min-h-screen w-full flex flex-col items-center justify-center relative"
      style={{
        backgroundImage: "url('/login_page.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* big game name */}
      <div className="mb-8">
        <Image src="/game_name.png" alt="Game Name" width={400} height={200} />
      </div>

      {/* Form for username */}
      <form
        onSubmit={handleSubmit}
        className="flex flex-col items-center"
        style={{
          backgroundColor: "rgba(255, 255, 255, 0.5)",
          padding: "20px",
          borderRadius: "8px",
        }}
      >
        <div className="mb-4">
          <Image
            src="/username.png"
            alt="Enter Your Name"
            width={200}
            height={40}
          />
        </div>

        <input
          type="text"
          value={username}
          onFocus={handleFocus}
          onChange={(e) => setUsername(e.target.value)}
          required
          placeholder="Your name"
          className="mb-4 px-3 py-2 border border-gray-300 rounded w-64 text-center 
                     hover:scale-105 transition-transform"
        />

        {/* Start button - swap images on mousedown/mouseup */}
        <button
          type="submit"
          onMouseDown={() => {
            setIsButtonClicked(true)
            playClickSound()
          }}
          onMouseUp={() => setIsButtonClicked(false)}
          style={{ outline: "none", border: "none", background: "transparent" }}
          className="hover:scale-105 transition-transform"
        >
          <Image
            src={isButtonClicked ? "/start_click.png" : "/start_orig.png"}
            alt="Start Button"
            width={180}
            height={60}
          />
        </button>
      </form>

      {/* Audio toggle in bottom-right */}
      {audioLoaded && (
        <button
          onMouseDown={() => playClickSound()}
          onClick={toggleMute}
          className="absolute bottom-4 right-4 hover:scale-105 transition-transform"
          style={{ border: "none", background: "transparent" }}
        >
          <Image
            src={isMuted ? "/audio_off.png" : "/audio_on.png"}
            alt="Audio Toggle"
            width={60}
            height={60}
          />
        </button>
      )}
    </main>
  )
}
