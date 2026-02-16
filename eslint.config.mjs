import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

const eslintConfig = defineConfig([
  globalIgnores([
    "**/node_modules/**",
    "**/dist/**",
    "**/.next/**",
    "**/build/**",
    "**/.turbo/**",
  ]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [tseslint.configs.base],
    rules: {
      "no-unused-vars": "off",
    },
  },
]);

export default eslintConfig;
