import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { AuthProvider } from '@/auth/AuthProvider'
import { ThemeSync } from '@/auth/ThemeSync'
import { FullPageSpinner } from '@/components/ui/Spinner'
import { APP_NAME } from '@/lib/app'
import { queryClient } from '@/lib/query-client'
import { router } from '@/router'
import './index.css'

document.title = APP_NAME

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} hydrateFallbackElement={<FullPageSpinner />} />
        <ThemeSync />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
