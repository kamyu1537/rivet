import { sessionContext } from "../scripts/context.mjs";
import { checkTaskStop, tasksEnabled } from "../scripts/task-state.mjs";

export default function register(pi) {
  const inject = (_event, ctx) => {
    pi.sendMessage({
      customType: "rivet",
      content: sessionContext("omp", ctx.sessionManager.getSessionId(), ctx.cwd),
      display: false,
    }, { deliverAs: "nextTurn" });
  };
  pi.on("session_start", inject);
  pi.on("session_switch", inject);
  pi.on("session_compact", inject);
  pi.on("session_stop", (event, ctx) => {
    if (!tasksEnabled() || event.signal.aborted || ["error", "aborted"].includes(event.last_assistant_message?.stopReason)) return;
    const result = checkTaskStop("omp", event.session_id, ctx.cwd, event.stop_hook_active === true);
    if (result.retry) return { continue: true, additionalContext: result.message };
    if (result.warning) ctx.ui?.notify?.(result.warning, "warning");
  });
}
