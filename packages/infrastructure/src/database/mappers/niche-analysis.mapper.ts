import { NicheAnalysis, PriceRange, RelevanceScore, type Competitor } from "@brandforge/domain";
import {
  ERROR_CODES,
  InfrastructureError,
  createAgentError,
  type ActionResult,
} from "@brandforge/shared";
import type { Prisma, NicheAnalysis as PrismaNicheAnalysis } from "@prisma/client";

/** Conversion `NicheAnalysis` ↔ ligne Prisma. */
export function toNicheAnalysisDomain(row: PrismaNicheAnalysis): NicheAnalysis {
  const priceRange = unwrap(
    PriceRange.create(row.priceRangeMin.toNumber(), row.priceRangeMax.toNumber()),
    "NicheAnalysis.priceRange",
  );
  const relevanceScore = unwrap(
    RelevanceScore.create(row.relevanceScore),
    "NicheAnalysis.relevanceScore",
  );

  return NicheAnalysis.reconstitute({
    id: row.id,
    storeProjectId: row.storeProjectId,
    keywords: row.keywords,
    competitors: row.competitors as unknown as readonly Competitor[],
    priceRange,
    relevanceScore,
    differentiationAngle: row.differentiationAngle,
    rawAnalysis: row.rawAnalysis,
    validatedByUser: row.validatedByUser,
    createdAt: row.createdAt,
  });
}

/** Champs persistés d'une analyse de niche. */
export function toNicheAnalysisPersistence(analysis: NicheAnalysis): {
  keywords: string[];
  competitors: Prisma.InputJsonValue;
  priceRangeMin: number;
  priceRangeMax: number;
  relevanceScore: number;
  differentiationAngle: string;
  rawAnalysis: Prisma.InputJsonValue;
  validatedByUser: boolean;
} {
  const snapshot = analysis.toSnapshot();
  return {
    keywords: [...snapshot.keywords],
    competitors: snapshot.competitors as unknown as Prisma.InputJsonValue,
    priceRangeMin: snapshot.priceRange.min,
    priceRangeMax: snapshot.priceRange.max,
    relevanceScore: snapshot.relevanceScore.value,
    differentiationAngle: snapshot.differentiationAngle,
    rawAnalysis: snapshot.rawAnalysis ?? {},
    validatedByUser: snapshot.validatedByUser,
  };
}

/**
 * Déballe un value object reconstruit depuis la base.
 *
 * Un échec signifie que la donnée stockée viole un invariant du domaine (corruption ou
 * migration manquée) : c'est une erreur d'infrastructure, pas un cas métier à propager
 * silencieusement.
 */
function unwrap<T>(result: ActionResult<T>, field: string): T {
  if (!result.success) {
    throw new InfrastructureError(
      createAgentError(
        ERROR_CODES.DATABASE_ERROR,
        `Donnée persistée incohérente pour ${field} : ${result.error.message}`,
        false,
      ),
    );
  }
  return result.data;
}
