// @ts-check
import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "ux-gate/screenshots", "ux-gate/test-results", "ux-gate/playwright-report"] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,

  // `15-11`: the two React plugins are restricted to `src/**` explicitly. Both applied repo-wide by
  // omission before, which was harmless while `src` was the only TypeScript here. `ux-gate/` is plain
  // TypeScript with no component and no hook, and `react-refresh/only-export-components` in
  // particular would flag ordinary multi-export fixture and lib modules for a Fast-Refresh
  // constraint that has no meaning outside a Vite-served React tree.
  { ...reactHooks.configs["recommended-latest"], files: ["src/**/*.{ts,tsx}"] },
  { ...reactRefresh.configs.vite, files: ["src/**/*.{ts,tsx}"] },
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.app.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // `ux-gate/` is a second TypeScript project with its own `tsconfig.json`, so it gets its own
  // type-aware-linting block rather than folding into the one above: pointing `parserOptions.project`
  // at `tsconfig.app.json` would make every import in this directory an unresolvable-project error.
  {
    files: ["ux-gate/**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: "./ux-gate/tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
);
