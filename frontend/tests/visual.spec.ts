import { test, expect } from "@playwright/test";

async function login(page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill("admin@radassist.local");
  await page.getByLabel("Пароль").fill("admin123");
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(page).toHaveURL(/\/$/);
}

test.describe("visual-regression", () => {
  test("dashboard light", async ({ page }) => {
    await login(page);
    await expect(page).toHaveScreenshot("dashboard-light.png", { fullPage: true });
  });

  test("protocols and dialogs", async ({ page }) => {
    await login(page);
    await page.goto("/protocols");
    await expect(page).toHaveScreenshot("protocols-light.png", { fullPage: true });

    await page.getByRole("button", { name: "Новый протокол" }).click();
    await expect(page).toHaveScreenshot("new-protocol-dialog-light.png", { fullPage: true });
  });

  test("templates and dialogs", async ({ page }) => {
    await login(page);
    await page.goto("/templates");
    await expect(page).toHaveScreenshot("templates-light.png", { fullPage: true });

    await page.getByRole("button", { name: "Новый шаблон" }).click();
    await expect(page).toHaveScreenshot("new-template-dialog-light.png", { fullPage: true });

    await page.keyboard.press("Escape");
    await page.getByRole("button").filter({ hasText: /Просмотр|РџСЂРѕСЃРјРѕС‚СЂ/ }).first().click();
    await expect(page).toHaveScreenshot("view-template-dialog-light.png", { fullPage: true });
  });
});
