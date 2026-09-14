"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6">
      <div className="text-lg font-semibold">Ошибка загрузки расписания</div>
      <div className="mt-2 text-sm text-zinc-600">Попробуйте обновить страницу.</div>
      <button className="mt-4 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800" onClick={reset} type="button">
        Повторить
      </button>
    </div>
  );
}

