import type { ReactNode } from 'react'
import loginBg from '@/assets/brand/login-bg.webp'
import v8Logo from '@/assets/brand/v8-logo.png'

/** Fundo e coluna de marca das telas de acesso (login, cadastro, nova senha); o conteúdo vai no cartão à direita. */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen relative grid lg:grid-cols-[1.25fr_1fr] bg-[#07070a] text-white">
      <img src={loginBg} alt="" aria-hidden className="absolute inset-0 size-full object-cover object-[35%_center]" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,7,10,.15)_0%,rgba(7,7,10,.35)_50%,rgba(7,7,10,.92)_72%)] max-lg:bg-[rgba(7,7,10,.72)]" aria-hidden />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-[linear-gradient(0deg,rgba(7,7,10,.95),transparent)]" aria-hidden />
      <div className="hidden lg:flex flex-col justify-between p-12 relative">
        <div className="flex items-center gap-3">
          <img src={v8Logo} alt="V8" className="h-11 w-auto drop-shadow-[0_2px_10px_rgba(0,0,0,.6)]" />
          <span className="font-extrabold tracking-[0.3em] text-lg">OS</span>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#ff7a1a] mb-3">V8 Aceleração · Sistema operacional</p>
          <h1 className="text-5xl font-extrabold tracking-tight leading-[1.05] drop-shadow-[0_4px_20px_rgba(0,0,0,.6)]">Cada fase do lançamento<br />sob controle.</h1>
          <p className="text-white/80 mt-4 max-w-md">Acompanhe, centralize e acelere seu lançamento com o sistema V8 OS.</p>
          <p className="text-xs text-white/50 mt-10">© {new Date().getFullYear()} V8 OS · V8 Aceleração</p>
        </div>
      </div>
      <div className="relative flex items-center justify-center p-6">
        <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#0d0d12]/90 backdrop-blur-xl p-7 shadow-2xl">
          <div className="flex items-center gap-2.5 lg:hidden mb-5">
            <img src={v8Logo} alt="V8" className="h-9 w-auto" />
            <span className="font-extrabold tracking-[0.3em]">OS</span>
          </div>

          {children}
        </div>
      </div>
    </div>
  )
}
