function req(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) throw new Error(`Missing env: ${name}`);
  return v.trim();
}

function opt(name: string, fallback: string): string {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : fallback;
}

function optOrNull(name: string): string | null {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : null;
}

export const env = {
  TELEGRAM_BOT_TOKEN: optOrNull("TELEGRAM_BOT_TOKEN"),
  API_URL: opt("API_URL", "http://localhost:3001"),
  BOT_TOKEN: optOrNull("BOT_TOKEN"),
  UNIVERSITY_TZ: opt("UNIVERSITY_TZ", "UTC")
};

