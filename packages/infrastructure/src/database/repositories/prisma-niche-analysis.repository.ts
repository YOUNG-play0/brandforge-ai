import type { INicheAnalysisRepository, NicheAnalysis } from "@brandforge/domain";
import type { PrismaDatabase } from "../prisma-client.js";
import { runQuery } from "../prisma-error-mapper.js";
import {
  toNicheAnalysisDomain,
  toNicheAnalysisPersistence,
} from "../mappers/niche-analysis.mapper.js";

/** Implémentation Prisma de `INicheAnalysisRepository` (relation 1-1 avec le projet). */
export class PrismaNicheAnalysisRepository implements INicheAnalysisRepository {
  constructor(private readonly prisma: PrismaDatabase) {}

  async save(analysis: NicheAnalysis): Promise<void> {
    const data = toNicheAnalysisPersistence(analysis);

    await runQuery("NicheAnalysis.save", () =>
      this.prisma.nicheAnalysis.upsert({
        where: { id: analysis.id },
        create: { id: analysis.id, storeProjectId: analysis.storeProjectId, ...data },
        update: data,
      }),
    );
  }

  async findByStoreProjectId(storeProjectId: string): Promise<NicheAnalysis | null> {
    const row = await runQuery("NicheAnalysis.findByStoreProjectId", () =>
      this.prisma.nicheAnalysis.findUnique({ where: { storeProjectId } }),
    );

    return row === null ? null : toNicheAnalysisDomain(row);
  }
}
