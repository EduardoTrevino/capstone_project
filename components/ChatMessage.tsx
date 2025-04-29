import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

interface ChatMessageProps {
  message: string
  name: string
  avatarUrl: string
  avatarFallback?: string
  className?: string
}

export function ChatMessage({ message, name, avatarUrl, avatarFallback, className }: ChatMessageProps) {
  return (
    <div className={cn("flex flex-col items-start gap-1 mb-6 relative", className)}>
      <div className="relative">
        {/* Chat bubble with pointer */}
        <div className="max-w-[80%] rounded-3xl bg-[#f5e9c0] px-4 py-3 text-sm relative">
          {message}
          {/* Triangle pointer */}
          <div className="absolute -bottom-2 left-12 h-4 w-4 rotate-45 bg-[#f5e9c0] rounded-sm"></div>
        </div>

        {/* Avatar and name positioned below the bubble */}
        <div className="absolute -bottom-14 left-0 flex flex-col items-center">
          <Avatar className="h-10 w-10 border-2 border-white">
            <AvatarImage src={avatarUrl || "/placeholder.svg"} alt={name} />
            <AvatarFallback>{avatarFallback || name.charAt(0)}</AvatarFallback>
          </Avatar>
          <span className="text-base font-medium text-white mt-1">{name}</span>
        </div>
      </div>
    </div>
  )
}
