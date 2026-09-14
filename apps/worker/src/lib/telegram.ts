export async function sendTelegramMessage(input: { token: string; chatId: string; text: string }) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${input.token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: input.chatId,
        text: input.text,
        parse_mode: "HTML",
        disable_web_page_preview: true
      })
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false as const, error: text || `HTTP_${res.status}` };
    }

    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: String(e) };
  }
}

