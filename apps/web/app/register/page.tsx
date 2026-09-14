"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "../../lib/authContext";

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-6 py-16 text-zinc-900">
      <main className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-semibold tracking-tight">Регистрация</h1>
          <p className="text-sm text-zinc-600">Создаёт пользователя и выдаёт accessToken.</p>
        </div>

        <form
          className="mt-7 flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setLoading(true);
            setError(null);
            try {
              await register({ email, password, firstName, lastName });
              router.push("/admin");
            } catch {
              setError("Не удалось зарегистрироваться (возможно, email уже занят).");
            } finally {
              setLoading(false);
            }
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-2 text-sm">
              <span className="text-zinc-700">Имя</span>
              <input
                className="h-11 rounded-lg border border-zinc-200 bg-white px-3 outline-none ring-0 focus:border-zinc-400"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                type="text"
                autoComplete="given-name"
                required
              />
            </label>

            <label className="flex flex-col gap-2 text-sm">
              <span className="text-zinc-700">Фамилия</span>
              <input
                className="h-11 rounded-lg border border-zinc-200 bg-white px-3 outline-none ring-0 focus:border-zinc-400"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                type="text"
                autoComplete="family-name"
                required
              />
            </label>
          </div>

          <label className="flex flex-col gap-2 text-sm">
            <span className="text-zinc-700">Email</span>
            <input
              className="h-11 rounded-lg border border-zinc-200 bg-white px-3 outline-none ring-0 focus:border-zinc-400"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              autoComplete="email"
              required
            />
          </label>

          <label className="flex flex-col gap-2 text-sm">
            <span className="text-zinc-700">Пароль</span>
            <input
              className="h-11 rounded-lg border border-zinc-200 bg-white px-3 outline-none ring-0 focus:border-zinc-400"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>

          {error ? <div className="text-sm text-red-600">{error}</div> : null}

          <button
            className="mt-1 inline-flex h-11 items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
            type="submit"
            disabled={loading}
          >
            {loading ? "Создаём…" : "Создать аккаунт"}
          </button>
        </form>

        <div className="mt-6 text-sm text-zinc-600">
          Уже есть аккаунт?{" "}
          <Link className="font-medium text-zinc-900 hover:underline" href="/login">
            Войти
          </Link>
        </div>
      </main>
    </div>
  );
}

