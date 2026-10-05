/**
 * Project guard extension for pi.
 *
 * Intercepts bash tool calls that look destructive or externally impactful
 * (rm -rf /, git reset --hard, terraform destroy, drop table, ...) and either
 * asks for interactive confirmation or blocks outright in non-interactive
 * modes (print / JSON).
 *
 * Auto-discovered from .pi/extensions/ — hot-reload with /reload.
 */

import {
  isToolCallEventType,
  type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";

type Guard = { pattern: RegExp; label: string };

const guards: Guard[] = [
  { pattern: /\brm\s+-rf\s+[\/~.]/, label: "rm -rf against /, ~, or ." },
  { pattern: /\bgit\s+reset\s+--hard\b/, label: "git reset --hard" },
  { pattern: /\bgit\s+clean\s+-[a-z]*f[a-z]*d\b/, label: "git clean -fd" },
  { pattern: /\bgit\s+push\b.*--force\b/, label: "git push --force" },
  { pattern: /\bterraform\s+(apply|destroy)\b/, label: "terraform apply/destroy" },
  { pattern: /\bkubectl\s+delete\b/, label: "kubectl delete" },
  { pattern: /\bhelm\s+(uninstall|delete)\b/, label: "helm uninstall/delete" },
  { pattern: /\bdocker\s+system\s+prune\b/, label: "docker system prune" },
  { pattern: /\b(prisma|drizzle)\s+.*\b(reset|push)\b/, label: "prisma/drizzle reset or push" },
  { pattern: /\bdrop\s+(database|table)\b/i, label: "DROP DATABASE/TABLE" },
  { pattern: /\bdelete\s+from\b/i, label: "SQL DELETE FROM" },
];

/** Returns a human-readable reason if the command matches a guard. */
export function blockedReason(command: string): string | undefined {
  return guards.find((g) => g.pattern.test(command))?.label;
}

export default function (pi: ExtensionAPI) {
  pi.on("tool_call", async (event, ctx) => {
    if (!isToolCallEventType("bash", event)) return;

    const command = event.input.command ?? "";
    const reason = blockedReason(command);
    if (!reason) return;

    // Interactive (TUI/RPC): let the user decide
    if (ctx.hasUI) {
      const ok = await ctx.ui.confirm(
        "Project guard: destructive command?",
        `${reason}\n\n${command.trim()}\n\nAllow anyway?`,
      );
      if (ok) return;
      ctx.ui.notify(`Blocked by project guard: ${reason}`, "info");
      return { block: true, reason: `Blocked by project guard (user declined): ${reason}` };
    }

    // Non-interactive (print / JSON): block unconditionally
    return {
      block: true,
      reason:
        "Blocked by project guard: destructive or externally impactful command. " +
        "Explain the exact command and request explicit user approval.",
    };
  });
}
