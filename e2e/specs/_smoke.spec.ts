import { test, expect } from "../fixtures/test";

test("smoke: server reachable and admin session works", async ({ page }) => {
  await page.goto("/");
  // Admin storageState is loaded by default; confirm we are NOT on /login.
  await expect(page).not.toHaveURL(/\/login/);
});

test("smoke: api fixture can hit authed endpoint", async ({ api }) => {
  const res = await api.get("/api/admin/inboxes");
  expect(res.ok()).toBe(true);
});
