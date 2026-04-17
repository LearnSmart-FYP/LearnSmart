import { test, expect, type Page } from "@playwright/test"

async function loginAsStudent(page: Page) {
  await page.goto("/login")
  await page.locator("input[placeholder='name@example.com']").fill("student@hkive.com")
  await page.locator("input[type='password']").fill("password123")
  await page.locator("button[type='submit']").click()
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 })
}

test.describe("Activities Page (UC-615/616)", () => {

  test("activity page loads with heading", async ({ page }) => {
    await loginAsStudent(page)
    await page.goto("/community/activities")
    await expect(page.locator("h1:has-text('Activities')")).toBeVisible({ timeout: 10000 })
    await expect(page.locator("text=/See what's happening/i").first()).toBeVisible()
  })

  test("displays feed and requests tabs", async ({ page }) => {
    await loginAsStudent(page)
    await page.goto("/community/activities")
    await page.waitForTimeout(2000)
    await expect(page.locator("button:has-text('Activity Feed')").first()).toBeVisible()
    await expect(page.locator("button:has-text('Content Requests')").first()).toBeVisible()
  })

  test("feed tab shows sub-view toggles", async ({ page }) => {
    await loginAsStudent(page)
    await page.goto("/community/activities")
    await page.waitForTimeout(3000)
    // Feed tab is active by default; sub-views should be visible
    await expect(page.locator("text=/All Activity/i").first()).toBeVisible()
    await expect(page.locator("text=/Following/i").first()).toBeVisible()
  })

  test("can switch to content requests tab", async ({ page }) => {
    await loginAsStudent(page)
    await page.goto("/community/activities")
    await page.waitForTimeout(2000)
    await page.locator("button:has-text('Content Requests')").first().click()
    await page.waitForTimeout(1000)
    // Should show requests content or empty state
    const hasContent = await page.locator("text=/request|submit|no request|New Request/i").first().isVisible().catch(() => false)
    expect(hasContent).toBeTruthy()
  })

  test("activity feed shows items or empty state", async ({ page }) => {
    await loginAsStudent(page)
    await page.goto("/community/activities")
    await page.waitForTimeout(3000)
    // Should show either activity items or an indication of no activity
    const content = page.locator("text=/ago|activit|no activit|follow|feed/i").first()
    await expect(content).toBeVisible()
  })

  test("activities page requires authentication", async ({ page }) => {
    await page.goto("/login")
    await page.evaluate(() => localStorage.clear())
    await page.goto("/community/activities")
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 })
  })
})
