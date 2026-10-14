import { fileURLToPath } from "node:url";
import { sessionContext } from "../scripts/context.mjs";
import { checkTaskStop, tasksEnabled } from "../scripts/task-state.mjs";

export default async function register({ client, directory }) {
  const sessions = new Map();
  const warn = async (message) => {
    try {
      await client.tui.showToast({ body: { title: "Rivet", message, variant: "warning" }, throwOnError: true });
    } catch {
      console.error(message);
    }
  };

  return {
    config: async (config) => {
      const skills = fileURLToPath(new URL("../skills", import.meta.url));
      config.skills ??= {};
      config.skills.paths ??= [];
      if (!config.skills.paths.includes(skills)) config.skills.paths.push(skills);
    },
    "experimental.chat.system.transform": async ({ sessionID }, output) => {
      if (!sessionID) return;
      const context = sessionContext("opencode", sessionID, directory);
      output.system[0] = [output.system[0], context].filter(Boolean).join("\n\n");
      if (!sessions.has(sessionID)) sessions.set(sessionID, { status: "busy", handledID: null });
    },
    "chat.message": async ({ sessionID }) => {
      sessions.set(sessionID, { status: "busy", handledID: sessions.get(sessionID)?.handledID ?? null });
    },
    event: async ({ event }) => {
      const sessionID = event.properties.sessionID ?? event.properties.info?.id;
      if (event.type === "session.deleted") {
        sessions.delete(sessionID);
        return;
      }
      if (event.type === "session.error") {
        for (const [id, state] of sessions) {
          if (!sessionID || id === sessionID) sessions.set(id, { ...state, status: "blocked" });
        }
        return;
      }
      const state = sessions.get(sessionID);
      if (!state || state.status === "blocked") return;
      if (event.type === "session.status" && event.properties.status.type !== "idle") {
        sessions.set(sessionID, { ...state, status: "busy" });
        return;
      }
      if (event.type !== "session.idle" || state.status === "checking") return;
      state.status = "checking";
      try {
        if (!tasksEnabled()) return;
        const request = { path: { id: sessionID }, query: { directory }, throwOnError: true };
        const [session, messages] = await Promise.all([
          client.session.get(request),
          client.session.messages({ ...request, query: { directory, limit: 1 } }),
        ]);
        if (sessions.get(sessionID) !== state || !tasksEnabled()) return;
        const info = messages.data?.at(-1)?.info;
        if (session.data?.id !== sessionID || session.data.parentID || info?.role !== "assistant" || info.sessionID !== sessionID || !info.time?.completed || info.finish !== "stop" || info.error || info.summary || info.id === state.handledID) return;
        const reentry = state.handledID !== null;
        state.handledID = info.id;
        const result = checkTaskStop("opencode", sessionID, directory, reentry);
        if (result.retry) {
          await client.session.promptAsync({
            ...request,
            body: {
              agent: info.mode,
              model: { providerID: info.providerID, modelID: info.modelID },
              ...(info.variant ? { variant: info.variant } : {}),
              parts: [{ type: "text", text: result.message, synthetic: true }],
            },
          });
        } else if (result.warning) await warn(result.warning);
      } catch (error) {
        await warn(`TASK cannot continue this OpenCode session: ${error.message ?? String(error)}`);
      } finally {
        if (sessions.get(sessionID) === state) state.status = "idle";
      }
    },
  };
}
