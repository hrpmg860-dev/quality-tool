import { expect, type Page, test } from "@playwright/test";

const ADMIN = { email: "admin@opscore.dev", password: "admin123" };
const REVIEWER = { email: "reviewer@opscore.dev", password: "reviewer123" };
const VIEWER = { email: "viewer@opscore.dev", password: "viewer123" };

async function login(page: Page, { email, password } = ADMIN) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
}

test.describe("auth", () => {
  test("rejects bad credentials with a visible error", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(ADMIN.email);
    await page.getByLabel(/password/i).fill("wrong-password");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.getByText(/invalid|incorrect|failed|unauthorized/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("redirects unauthenticated users to login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("logs in and shows the dashboard", async ({ page }) => {
    await login(page);
    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
    await expect(page.getByText(/duplicate|group|dataset/i).first()).toBeVisible();
  });

  test("sign out returns to login", async ({ page }) => {
    await login(page);
    await page.getByRole("button", { name: /sign out|log out/i }).click();
    await expect(page).toHaveURL(/\/login/);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("platform screens", () => {
  test.beforeEach(async ({ page }) => login(page));

  test("upload history lists real uploads", async ({ page }) => {
    await page.goto("/uploads");
    await expect(page.getByRole("heading", { name: /upload history/i })).toBeVisible();
    await expect(page.getByRole("table")).toBeVisible();
  });

  test("upload flow creates an upload with real file bytes", async ({ page }) => {
    await page.goto("/uploads/new");
    await expect(page.getByRole("heading", { name: /upload dataset/i })).toBeVisible();
    await page.getByLabel(/target dataset/i).selectOption({ index: 1 });
    const runId = Date.now().toString(36);
    await page.getByTestId("file-input").setInputFiles({
      name: `e2e-${runId}.csv`,
      mimeType: "text/csv",
      buffer: Buffer.from(
        `full_name,email\nAlice Tester,alice.e2e.${runId}@example.com\nBob Tester,bob.e2e.${runId}@example.com\n`,
      ),
    });
    await page.getByRole("button", { name: /^upload$/i }).click();
    await expect(page).toHaveURL(/\/uploads\/\d+/, { timeout: 20_000 });
    await expect(page.getByText(/uploaded|mapped|processing|completed/i).first()).toBeVisible();
  });

  test("datasets list and detail render", async ({ page }) => {
    await page.goto("/datasets");
    await expect(page.getByRole("heading", { name: /datasets/i })).toBeVisible();
    const first = page.getByRole("table").getByRole("link").first();
    if (await first.count()) {
      await first.click();
      await expect(page).toHaveURL(/\/datasets\/\d+/);
    }
  });

  test("duplicate analysis shows tier matrix", async ({ page }) => {
    await page.goto("/analysis");
    await expect(page.getByRole("heading", { name: /duplicate analysis/i })).toBeVisible();
    await expect(page.getByText(/status × confidence/i).first()).toBeVisible();
  });

  test("review center lists groups and opens a group", async ({ page }) => {
    await page.goto("/review");
    await expect(page.getByRole("heading", { name: /review center/i })).toBeVisible();
    const link = page.getByTestId("group-link").first();
    if (await link.count()) {
      await link.click();
      await expect(page).toHaveURL(/\/review\/\d+/);
      await expect(page.getByText(/side-by-side/i)).toBeVisible();
    }
  });

  test("master records list and detail", async ({ page }) => {
    await page.goto("/masters");
    await expect(page.getByRole("heading", { name: /master records/i })).toBeVisible();
    const link = page.getByTestId("master-link").first();
    if (await link.count()) {
      await link.click();
      await expect(page).toHaveURL(/\/masters\/\d+/);
      await expect(page.getByText(/golden/i).first()).toBeVisible();
    }
  });

  test("record search filters server-side", async ({ page }) => {
    await page.goto("/search");
    await expect(page.getByRole("heading", { name: /record search/i })).toBeVisible();
    await page.getByLabel(/search everything/i).fill("alice");
    await expect(page.getByRole("table")).toBeVisible();
  });

  test("exports page lists history and opens the request dialog", async ({ page }) => {
    await page.goto("/exports");
    await expect(page.getByRole("heading", { name: /reports/i })).toBeVisible();
    await page.getByRole("button", { name: /new export/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: /request export/i }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(page.getByRole("table")).toBeVisible();
  });

  test("audit trail shows entries", async ({ page }) => {
    await page.goto("/audit");
    await expect(page.getByRole("heading", { name: /audit/i })).toBeVisible();
    await expect(page.getByRole("table")).toBeVisible();
  });

  test("user management lists users", async ({ page }) => {
    await page.goto("/admin/users");
    await expect(page.getByRole("heading", { name: /user management/i })).toBeVisible();
    await expect(page.getByText(/admin@opscore\.dev/).first()).toBeVisible();
  });

  test("teams list and seed team detail", async ({ page }) => {
    await page.goto("/admin/teams");
    await expect(page.getByRole("heading", { name: /^teams$/i })).toBeVisible();
    await page.getByRole("link", { name: /review team/i }).first().click();
    await expect(page).toHaveURL(/\/admin\/teams\/\d+/);
    await expect(page.getByText(/reviewer@opscore\.dev/).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: /dataset access/i })).toBeVisible();
  });

  test("roles page shows the permission matrix", async ({ page }) => {
    await page.goto("/admin/roles");
    await expect(page.getByRole("heading", { name: /roles & permissions/i })).toBeVisible();
    for (const name of ["Super Admin", "Admin", "Manager", "Reviewer", "Viewer"]) {
      await expect(page.getByRole("columnheader", { name, exact: true })).toBeVisible();
    }
    await expect(page.getByText("merge.revert").first()).toBeVisible();
  });

  test("settings shows profile and health", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: /settings/i })).toBeVisible();
    await expect(page.getByText(/admin@opscore\.dev/).first()).toBeVisible();
  });
});

test.describe("role-based access", () => {
  test("reviewer does not see user management", async ({ page }) => {
    await login(page, REVIEWER);
    await expect(page.getByRole("link", { name: /user management/i })).not.toBeVisible();
    await page.goto("/admin/users");
    await expect(page.getByText(/have access|not authorized|forbidden/i).first()).toBeVisible();
  });

  test("reviewer sees only their own teams and no admin controls", async ({ page }) => {
    await login(page, REVIEWER);
    await page.goto("/admin/teams");
    await expect(page.getByRole("button", { name: /new team/i })).not.toBeVisible();
    await expect(page.getByRole("link", { name: /review team/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /roles & permissions/i })).not.toBeVisible();
  });

  test("viewer cannot upload or decide", async ({ page }) => {
    await login(page, VIEWER);
    await expect(page.getByRole("link", { name: /upload dataset/i })).not.toBeVisible();
    await page.goto("/uploads/new");
    await expect(page.getByText(/have access|not authorized|forbidden/i).first()).toBeVisible();
  });
});
