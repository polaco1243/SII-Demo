"use client";

import { useState } from "react";

type Tab = "signin" | "signup";

interface AuthFormProps {
  initialTab: Tab;
  loginAction: (formData: FormData) => void;
  registerAction: (formData: FormData) => void;
  loginError: boolean;
  registerError: "correo_en_uso" | "datos_invalidos" | null;
}

const inputClass =
  "rounded-[10px] border border-border bg-white/[0.03] px-4 py-3 text-sm text-text transition-all placeholder:text-faint hover:border-border-strong focus:border-accent/40 focus:shadow-[0_0_0_3px_rgba(249,115,22,0.08)] focus:outline-none";

const submitClass =
  "group relative mt-1 overflow-hidden rounded-[10px] bg-gradient-to-br from-primary to-accent-hover px-6 py-3.5 text-sm font-medium text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_6px_30px_rgba(249,115,22,0.35)] focus-visible:-translate-y-0.5";

export function AuthForm({
  initialTab,
  loginAction,
  registerAction,
  loginError,
  registerError,
}: AuthFormProps) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const isSignup = tab === "signup";

  return (
    <div>
      <h1 className="text-page">{isSignup ? "Crear cuenta" : "Bienvenido de vuelta"}</h1>
      <p className="mt-1 text-sm text-muted">
        {isSignup ? "Regístrate para empezar" : "Inicia sesión en tu cuenta"}
      </p>

      {/* Pill de tabs con indicador deslizante */}
      <div
        role="tablist"
        aria-label="Iniciar sesión o crear cuenta"
        className="relative mt-6 grid grid-cols-2 gap-0 rounded-[10px] border border-white/[0.06] bg-white/[0.03] p-1"
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-1 top-1 h-[calc(100%-8px)] w-[calc(50%-4px)] rounded-lg border border-accent/15 bg-accent/10 transition-transform duration-[350ms] ease-[cubic-bezier(0.4,0,0.2,1)]"
          style={{ transform: isSignup ? "translateX(100%)" : "translateX(0)" }}
        />
        <button
          type="button"
          role="tab"
          aria-selected={!isSignup}
          onClick={() => setTab("signin")}
          className={`relative z-10 rounded-lg py-2.5 text-center text-sm transition-colors ${
            !isSignup ? "font-medium text-text" : "text-muted hover:text-text"
          }`}
        >
          Iniciar sesión
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={isSignup}
          onClick={() => setTab("signup")}
          className={`relative z-10 rounded-lg py-2.5 text-center text-sm transition-colors ${
            isSignup ? "font-medium text-text" : "text-muted hover:text-text"
          }`}
        >
          Crear cuenta
        </button>
      </div>

      {/* Sign In */}
      {!isSignup && (
        <div className="fade-in mt-6">
          {loginError && (
            <p className="mb-4 text-sm text-danger">Correo o contraseña incorrectos</p>
          )}
          <form action={loginAction} className="flex flex-col gap-4">
            <input
              name="email"
              type="email"
              autoComplete="email"
              placeholder="correo@ejemplo.com"
              required
              className={inputClass}
            />
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="Contraseña"
              required
              className={inputClass}
            />
            <button type="submit" className={submitClass}>
              <span className="shimmer-layer" aria-hidden="true" />
              <span className="relative">Entrar</span>
            </button>
          </form>
          <p className="mt-4 text-sm text-muted">
            ¿No tienes cuenta?{" "}
            <button
              type="button"
              onClick={() => setTab("signup")}
              className="font-medium text-accent transition-colors hover:text-accent-hover"
            >
              Crea una
            </button>
          </p>
        </div>
      )}

      {/* Sign Up */}
      {isSignup && (
        <div className="fade-in mt-6">
          {registerError === "correo_en_uso" && (
            <p className="mb-4 text-sm text-danger">Ese correo ya está registrado</p>
          )}
          {registerError === "datos_invalidos" && (
            <p className="mb-4 text-sm text-danger">
              Correo inválido o contraseña muy corta (mínimo 8)
            </p>
          )}
          <form action={registerAction} className="flex flex-col gap-4">
            <input
              name="email"
              type="email"
              autoComplete="email"
              placeholder="correo@ejemplo.com"
              required
              className={inputClass}
            />
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              placeholder="Contraseña (mínimo 8 caracteres)"
              minLength={8}
              required
              className={inputClass}
            />
            <button type="submit" className={submitClass}>
              <span className="shimmer-layer" aria-hidden="true" />
              <span className="relative">Crear cuenta</span>
            </button>
          </form>
          <p className="mt-4 text-sm text-muted">
            ¿Ya tienes cuenta?{" "}
            <button
              type="button"
              onClick={() => setTab("signin")}
              className="font-medium text-accent transition-colors hover:text-accent-hover"
            >
              Inicia sesión
            </button>
          </p>
        </div>
      )}
    </div>
  );
}
