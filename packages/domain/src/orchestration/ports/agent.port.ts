import type { AgentResult } from "@brandforge/shared";
import type { AgentName } from "../value-objects/agent-name.vo.js";

/**
 * Contrat générique de tout agent IA (AI_AGENTS.md §1).
 *
 * Un agent est **stateless** : il ne conserve aucun état entre deux exécutions, tout
 * l'état vit dans `PipelineRun`/`PipelineStep`. Il n'a aucun effet de bord caché — toute
 * écriture ou tout appel externe passe par un port injecté.
 *
 * Un agent n'appelle jamais un autre agent : seul l'Orchestrator séquence (WORKFLOWS.md §1).
 */
export interface Agent<TInput, TOutput> {
  readonly name: AgentName;
  execute(input: TInput): Promise<AgentResult<TOutput>>;
}
