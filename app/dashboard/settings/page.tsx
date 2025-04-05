"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import Image from "next/image"
import { supabase } from "@/lib/supabase"

interface SettingsDialogProps {
  username: string
  initialAvatar: string
  initialLanguage: string
  initialSoundEnabled: boolean
  onClose: () => void
  onSave: (avatar: string, language: string, soundEnabled: boolean) => void
}

export default function SettingsDialog({
  username,
  initialAvatar,
  initialLanguage,
  initialSoundEnabled,
  onClose,
  onSave,
}: SettingsDialogProps) {
  const [avatar, setAvatar] = useState(initialAvatar)
  const [language, setLanguage] = useState(initialLanguage)
  const [soundEnabled, setSoundEnabled] = useState(initialSoundEnabled)
  const [showIconPicker, setShowIconPicker] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Common 3D beveled button style (green that flips to orange on active)
  const beveledButtonClasses =
    "px-4 py-2 border-2 border-green-900 rounded shadow-lg bg-green-500 text-white font-bold active:bg-orange-500 transition-colors"

  async function handleSave() {
    setIsSaving(true)
    const { error } = await supabase
      .from("users")
      .update({ avatar_path: avatar, language, sound_enabled: soundEnabled })
      .eq("name", username)
    if (error) {
      console.error("Error saving settings:", error.message)
    }
    setIsSaving(false)
    onSave(avatar, language, soundEnabled)
  }

  function handleSoundToggle() {
    setSoundEnabled((prev) => !prev)
  }

  function handleLanguageChange(lang: string) {
    setLanguage(lang)
  }

  function handleIconSelect(newAvatar: string) {
    setAvatar(newAvatar)
    setShowIconPicker(false)
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent
        className="sm:max-w-[425px] relative"
        style={{
          backgroundImage: 'url("/dashboard/settings_texture.png")',
          backgroundSize: "cover",
          border: "4px solid #FCD34D", // Organish yellow border (adjust as needed)
        }}
      >
        {/* X button to close without saving */}
        <button
          className="absolute top-2 right-2 text-xl font-bold text-black"
          onClick={onClose}
        >
          X
        </button>
        <DialogHeader>
          <DialogTitle>Profile Settings</DialogTitle>
          <DialogDescription>Adjust your settings below.</DialogDescription>
        </DialogHeader>
        <div className="flex items-center space-x-4 my-4">
          <div className="relative">
            <Avatar className="w-16 h-16">
              {avatar ? (
                <AvatarImage src={avatar} alt={username} />
              ) : (
                <AvatarFallback>{username.charAt(0).toUpperCase()}</AvatarFallback>
              )}
            </Avatar>
            {/* Pencil overlay to open icon picker */}
            <button
              className="absolute bottom-0 right-0 rounded-full p-1"
              onClick={() => setShowIconPicker(true)}
            >
              <Image src="/dashboard/pencil.png" alt="Edit" width={16} height={16} />
            </button>
          </div>
          <div>
            <p className="text-lg font-semibold">Hello {username}</p>
          </div>
        </div>

        {showIconPicker && (
          <div className="grid grid-cols-4 gap-4 mb-4">
            {Array.from({ length: 7 }, (_, i) => {
              const iconPath = `/dashboard/avatars/icon_${i + 1}.png`
              return (
                <button key={i} onClick={() => handleIconSelect(iconPath)}>
                  <Image src={iconPath} alt={`Icon ${i + 1}`} width={50} height={50} />
                </button>
              )
            })}
          </div>
        )}

        {/* Modular settings section */}
        <div className="space-y-4">
          {/* Language Selection */}
          <div>
            <p className="font-semibold mb-1">Language</p>
            <div className="flex gap-4">
              <button
                className={`${beveledButtonClasses} ${language === "english" ? "bg-green-700" : ""}`}
                onClick={() => handleLanguageChange("english")}
              >
                English
              </button>
              <button
                className={`${beveledButtonClasses} ${language === "hindi" ? "bg-green-700" : ""}`}
                onClick={() => handleLanguageChange("hindi")}
              >
                Hindi
              </button>
            </div>
          </div>
          {/* Audio Toggle */}
          <div>
            <p className="font-semibold mb-1">Audio</p>
            <button className={beveledButtonClasses} onClick={handleSoundToggle}>
              <span className="mr-2">Audio</span>
              <Image
                src={soundEnabled ? "/audio_on.png" : "/audio_off.png"}
                alt="Audio Toggle"
                width={24}
                height={24}
              />
            </button>
          </div>
          {/* Additional settings can be added here */}
        </div>

        <DialogFooter>
          <Button className={beveledButtonClasses} onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
