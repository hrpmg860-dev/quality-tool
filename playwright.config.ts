import { defineConfig, devices } from "@playwright/test";

const PORT = process.env.PORT ?? "3000";
const baseURL = process.env.BASE_URL ?? `http://localhost:${PORT}`;

/** E2E against the real FastAPI backend + Celery worker.
 * Prerequisites: docker compose up (infra), alembic upgrade head,
 * python -m scripts.seed, uvicorn on :8000, celery worker. */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  workers: 1, // tests share the seeded backend — run serially
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
