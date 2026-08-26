import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    // `.tsx` included: `testing.md`'s "Component / behaviour" level needs tests that mount React,
    // and a test that mounts React is JSX.
    include: ["src/**/*.test.{ts,tsx}"],
    // `src/config.ts` refuses to load without these, on purpose - a bundle that silently defaulted
    // its API origin would be a bundle that could point at the wrong deployment. Supplying them here
    // rather than in a `.env.test` keeps the test run independent of which dotenv files happen to
    // exist on a machine, which is what makes the suite reproducible in CI.
    env: {
      VITE_API_BASE_URL: "https://calendar.test.invalid",
      VITE_KEYCLOAK_AUTHORITY: "https://keycloak.test.invalid/realms/ago-chat",
      VITE_KEYCLOAK_CLIENT_ID: "ago-calendar-console",
    },
  },
});
