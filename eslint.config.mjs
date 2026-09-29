import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  prettier,
  { rules: { "@typescript-eslint/consistent-type-imports": "error" } },
  globalIgnores([
    ".next/**",
    ".next-build/**",
    "out/**",
    "next-env.d.ts",
    "supabase/functions/**",
  ]),
]);
