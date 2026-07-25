// @ts-check
// Configuration ESLint unique et partagée pour tout le monorepo (cf. CODING_STANDARDS.md §2).
// Une seule configuration au niveau racine — pas de config par package.
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/build/**",
      "**/.next/**",
      "**/node_modules/**",
      "**/coverage/**",
      "**/*.gitkeep",
      "packages/infrastructure/src/database/generated/**",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // `any` interdit sauf justification explicite en commentaire (CODING_STANDARDS.md §2).
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/explicit-function-return-type": ["warn", { allowExpressions: true }],
    },
  },
  // Tests et doublures : une doublure en mémoire implémente légitimement un port
  // asynchrone de façon synchrone, et le type de retour des helpers de test est inféré.
  {
    files: ["**/*.test.ts", "**/test-support/**/*.ts"],
    rules: {
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/explicit-function-return-type": "off",
      // Faux positif sur les assertions vitest du type `expect(mock.method)`.
      "@typescript-eslint/unbound-method": "off",
    },
  },
  // Les fichiers de configuration à la racine ne sont pas couverts par un tsconfig applicatif.
  {
    files: ["**/*.config.{js,mjs,cjs,ts}", "eslint.config.mjs"],
    ...tseslint.configs.disableTypeChecked,
  },
  prettier,
);
