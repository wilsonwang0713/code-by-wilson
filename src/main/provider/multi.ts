import type { PersistedSession, SessionCandidate } from "@shared/types";
import type { Provider } from "./types";

/**
 * Compose several Providers behind the one Provider the rest of the app already consumes (sync, ipc,
 * adopt). Aggregation is candidate-level: each discovery pass concatenates every provider's
 * candidates, remembering which provider produced each session id, and every per-session read
 * dispatches to that owner. Snapshots leave here stamped with `providerId`, so ownership survives
 * the SQLite round trip and the renderer can degrade per-session UI (see @shared/providers).
 *
 * The seam is deliberately here and not in sync.ts: syncSessions stays a pure "candidates in,
 * snapshots out" loop with no idea providers exist, and a single-provider build composes
 * createMultiProvider([claude]) at zero behavioral cost.
 */
export function createMultiProvider(providers: readonly Provider[]): Provider {
  if (providers.length === 0)
    throw new Error("createMultiProvider needs at least one provider");
  // The primary provider: the capability contract IPC.capabilities serves (the app-level surface
  // that predates per-session flags), and the dispatch fallback for an id no pass has claimed yet.
  const primary = providers[0];

  // session id → owning provider, (re)claimed on every discovery pass. Never pruned: ids are UUIDs
  // minted by their provider, so a stale entry can't be re-claimed by a different provider, and the
  // map stays small (one pointer per session ever seen this run). An id missing from the map — a
  // per-session read before the first sync's listCandidates, which startup ordering already
  // prevents — falls back to the primary, which answers `absent` for a foreign id exactly like the
  // single-provider build did.
  const ownerById = new Map<string, Provider>();
  const owner = (id: string): Provider => ownerById.get(id) ?? primary;

  const stamp = (p: Provider, s: PersistedSession): PersistedSession => ({
    ...s,
    providerId: p.id,
  });

  return {
    id: "multi",
    capabilities: primary.capabilities,
    listCandidates: (): SessionCandidate[] => {
      const out: SessionCandidate[] = [];
      for (const provider of providers) {
        let candidates: SessionCandidate[];
        try {
          candidates = provider.listCandidates();
        } catch (err) {
          // Per-provider isolation: only the primary's throw propagates (its throw-on-EACCES is a
          // deliberate prune-guard for its own index — see claude/discover). A SECONDARY provider's
          // disk fault (root-owned ~/.codex after a sudo run, EIO on a network home) must never
          // blank the primary's sessions with it: sync would abort, and on a fresh index (the
          // schema-bump relaunch rebuilds from empty) the user would see NO sessions at all until
          // they fixed a foreign provider's permissions. Skipping the pass prunes only that
          // provider's rows, which restore themselves once it reads again.
          if (provider === primary) throw err;
          console.error(
            `provider ${provider.id}: listCandidates failed; skipping this pass`,
            err,
          );
          continue;
        }
        for (const candidate of candidates) {
          // First claimant wins a (theoretical) cross-provider id collision, so one session id can
          // never flip owners between passes and double-appear in the index.
          const claimed = ownerById.get(candidate.id);
          if (claimed !== undefined && claimed !== provider) continue;
          ownerById.set(candidate.id, provider);
          out.push(candidate);
        }
      }
      return out;
    },
    summarize: (c) => {
      const p = owner(c.id);
      return stamp(p, p.summarize(c));
    },
    restate: (c, prev) => {
      const p = owner(c.id);
      return stamp(p, p.restate(c, prev));
    },
    readTranscript: (id, since) => owner(id).readTranscript(id, since),
    getToolResult: (id, toolUseId, agentId) =>
      owner(id).getToolResult(id, toolUseId, agentId),
    readSubagentTranscript: (id, agentId, since) =>
      owner(id).readSubagentTranscript(id, agentId, since),
    readTasks: (id, since) => owner(id).readTasks(id, since),
    readShells: (id, since) => owner(id).readShells(id, since),
    readShellOutput: (id, shellId, since) =>
      owner(id).readShellOutput(id, shellId, since),
    readMonitors: (id, since) => owner(id).readMonitors(id, since),
    readMonitorOutput: (id, monitorId, since) =>
      owner(id).readMonitorOutput(id, monitorId, since),
    readMetrics: (id, since) => owner(id).readMetrics(id, since),
    resolveAdoptTarget: (id) => owner(id).resolveAdoptTarget(id),
    resolveSessionCwd: (id) => owner(id).resolveSessionCwd(id),
  };
}
