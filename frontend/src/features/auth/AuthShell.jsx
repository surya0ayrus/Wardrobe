import { Logo } from '@/components/ui/Logo'

/**
 * Frame for the login and change-password pages: the full-screen background video
 * (public/login-bg.mp4, the CRM's) under a dark tint, with a frosted-glass card on the left
 * (centred on phones). public/login-bg.jpg shows while the video loads, and instead of it for
 * people who ask for reduced motion. `tagline` is a short uppercase line under the title
 * (login); `subtitle` is a normal sentence (change password).
 */
export function AuthShell({ title, tagline, subtitle, children }) {
  return (
    <div className="theme-light relative flex min-h-dvh items-center justify-center overflow-hidden p-6 lg:justify-start lg:pl-[7%]">
      <div className="fixed inset-0 -z-10 bg-brand-dark" aria-hidden>
        <img src="/login-bg.jpg" alt="" className="absolute inset-0 size-full object-cover" />
        <video
          className="absolute inset-0 size-full object-cover motion-reduce:hidden"
          src="/login-bg.mp4"
          poster="/login-bg.jpg"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
        />
        {/* Darker on the card side so the form stays readable. */}
        <div className="absolute inset-0 bg-linear-to-r from-black/65 via-black/35 to-black/10 max-lg:bg-black/45" />
      </div>

      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/40 bg-white/75 px-6 py-8 shadow-[0_24px_70px_rgba(0,0,0,0.35)] ring-1 ring-white/10 backdrop-blur-xl backdrop-saturate-150 sm:px-8">
        <div className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-primary via-secondary to-primary" />
        <div className="flex justify-center"><Logo /></div>
        {title && <h1 className="mt-7 text-center text-3xl font-bold tracking-tight">{title}</h1>}
        {tagline && <p className="mt-2 text-center text-xs font-medium tracking-[0.18em] text-muted uppercase">{tagline}</p>}
        {subtitle && <p className="mt-2 text-center text-sm text-muted">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  )
}
