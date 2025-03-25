"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import React from "react"

// Define the proper type for params
type NextParams = { step: string } & { then: any } // This signals it's a Promise-like object

export default function IntroPage({ params }: { params: NextParams }) {
  const [username, setUsername] = useState("")
  const router = useRouter()
  
  // Now params is properly typed for React.use
  const unwrappedParams = React.use(params) as { step: string }
  const step = Number.parseInt(unwrappedParams.step)

  useEffect(() => {
    const storedUsername = localStorage.getItem("username")
    if (storedUsername) {
      setUsername(storedUsername)
    } else {
      router.push("/")
    }
  }, [router])

  const handleNext = () => {
    if (step < 3) {
      router.push(`/intro/${step + 1}`)
    } else {
      router.push("/dashboard")
    }
  }

  const getContent = () => {
    switch (step) {
      case 1:
        return {
          image: "/img_3.jpeg",
          text: `Hello there! I'm Rani Singh, and I'm thrilled to welcome you to our village. Word around town is that you're here to start something special—an entrepreneurial venture that will transform agriculture with drone technology!`,
        }
      case 2:
        return {
          image: "/img_2.jpeg",
          text: `You see these fields? Many farmers here struggle to maintain efficiency and keep up with modern methods. Drones can change all that! By leasing drones to local farms, you'll help them save time, reduce costs, and protect precious resources.`,
        }
      case 3:
        return {
          image: "/img_3.jpeg",
          text: `Your business will revolve around leasing drones to farmers. They can book a slot, use the drones, and pay a fee. Simple as that! But remember—managing revenue, reputation, and customer satisfaction will be just as important as the drones themselves.`,
        }
      default:
        return {
          image: "/img_3.jpeg",
          text: "Let's get started!",
        }
    }
  }

  const content = getContent()

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-6 bg-gradient-to-b from-green-50 to-blue-50">
      <div className="w-full max-w-md">
        <Card className="border-0 shadow-lg overflow-hidden">
          <div className="bg-green-600 h-2" />
          <div className="p-4 bg-green-50">
            <div className="flex justify-between mb-2">
              <div className="text-sm text-green-800">Welcome, {username}</div>
              <div className="text-sm text-green-800">Step {step}/3</div>
            </div>
          </div>
          <div className="relative w-full h-[350px] bg-white">
            <Image
              src={content.image || "/placeholder.svg"}
              alt="Rani Singh"
              fill
              style={{ objectFit: "contain" }}
              priority
            />
          </div>
          <CardContent className="p-6 bg-white">
            <div className="text-base mb-6">{content.text}</div>
            <Button onClick={handleNext} className="w-full bg-green-600 hover:bg-green-700">
              {step < 3 ? "Continue" : "Start Your Business"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

