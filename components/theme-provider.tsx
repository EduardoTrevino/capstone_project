'use client'

import * as React from 'react'
import {
  ThemeProvider as NextThemesProvider,
  type ThemeProviderProps,
} from 'next-themes'

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  const [mounted, setMounted] = React.useState(false)

  // After mounting, we can render the children
  React.useEffect(() => {
    setMounted(true)
  }, [])

  // Prevent hydration mismatch by only rendering children client-side
  return (
    <NextThemesProvider defaultTheme="light" enableSystem={false} forcedTheme="light" {...props}>
      {mounted ? children : null}
    </NextThemesProvider>
  )
}
