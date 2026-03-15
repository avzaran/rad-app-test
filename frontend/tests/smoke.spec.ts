import { test, expect } from "@playwright/test";

test("e2e smoke: login -> templates -> new protocol -> open/edit/save", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("admin@radassist.local");
  await page.getByLabel("Пароль").fill("admin123");
  await page.getByRole("button", { name: "Войти" }).click();

  await expect(page).toHaveURL(/\/$/);

  await page.goto("/templates");
  await expect(page.getByRole("heading", { name: "Шаблоны" })).toBeVisible();

  await page.goto("/protocols");
  await page.getByRole("button", { name: "Новый протокол" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  await dialog.getByRole("button", { name: /Выбрать из списка|Р’С‹Р±СЂР°С‚СЊ РёР· СЃРїРёСЃРєР°/ }).click();
  await page.locator("button", { hasText: "Иванов Иван Иванович" }).first().click();

  await dialog.getByRole("button", { name: /Далее|Р”Р°Р»РµРµ/ }).click();
  await dialog.getByRole("button", { name: /КТ|РљРў/ }).click();
  await dialog.getByRole("button", { name: /Далее|Р”Р°Р»РµРµ/ }).click();
  await dialog.getByRole("button", { name: /Создать протокол|РЎРѕР·РґР°С‚СЊ РїСЂРѕС‚РѕРєРѕР»/ }).click();

  await expect(page).toHaveURL(/\/protocols\//);
  await page.getByRole("textbox").first().fill("Текст протокола для smoke теста");
  await page.getByRole("button", { name: "Сохранить черновик" }).click();
  await expect(page.getByText("Черновик сохранен")).toBeVisible();
});
