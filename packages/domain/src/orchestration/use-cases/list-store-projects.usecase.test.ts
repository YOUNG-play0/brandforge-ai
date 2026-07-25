import { describe, expect, it } from "vitest";
import { ListStoreProjects } from "./list-store-projects.usecase.js";
import { InMemoryStoreProjectRepository } from "../../test-support/fakes.js";
import { TEST_USER_ID, aStoreProject } from "../../test-support/builders.js";

describe("ListStoreProjects", () => {
  it("retourne les projets de l'utilisateur", async () => {
    const storeProjects = new InMemoryStoreProjectRepository();
    await storeProjects.save(aStoreProject({ id: "project-1" }));
    await storeProjects.save(aStoreProject({ id: "project-2", niche: "montres" }));

    const result = await new ListStoreProjects(storeProjects).execute({ userId: TEST_USER_ID });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toHaveLength(2);
    expect(result.data.map((project) => project.niche)).toContain("montres");
  });

  it("n'expose pas les projets des autres utilisateurs", async () => {
    const storeProjects = new InMemoryStoreProjectRepository();
    await storeProjects.save(aStoreProject({ id: "project-1" }));
    await storeProjects.save(aStoreProject({ id: "project-2", userId: "autre-user" }));

    const result = await new ListStoreProjects(storeProjects).execute({ userId: TEST_USER_ID });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.storeProjectId).toBe("project-1");
  });

  it("retourne une liste vide pour un utilisateur sans projet", async () => {
    const result = await new ListStoreProjects(new InMemoryStoreProjectRepository()).execute({
      userId: TEST_USER_ID,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toEqual([]);
  });
});
