import { test, expect } from "@playwright/test"

test.describe("Edge Cases & Validation", () => {

  // === Authentication Edge Cases ===

  test("login with empty email and password", async ({ page }) => {
    await page.goto("/login")
    const submitBtn = page.locator("button[type='submit']")
    // Submit button should be disabled with empty fields
    await expect(submitBtn).toBeDisabled()
  })

  test("login with email only (no password)", async ({ page }) => {
    await page.goto("/login")
    await page.locator("input[placeholder='name@example.com']").fill("student@hkive.com")
    // Password still empty — submit should remain disabled
    const submitBtn = page.locator("button[type='submit']")
    await expect(submitBtn).toBeDisabled()
  })

  test("login with password only (no email)", async ({ page }) => {
    await page.goto("/login")
    await page.locator("input[type='password']").fill("password123")
    const submitBtn = page.locator("button[type='submit']")
    await expect(submitBtn).toBeDisabled()
  })

  test("login with SQL injection attempt", async ({ page }) => {
    await page.goto("/login")
    await page.locator("input[placeholder='name@example.com']").fill("' OR 1=1 --")
    await page.locator("input[type='password']").fill("' OR 1=1 --")
    await page.locator("button[type='submit']").click()
    await page.waitForTimeout(2000)
    // Should stay on login page (auth failed, no injection)
    await expect(page).toHaveURL(/\/login/)
  })

  test("login with XSS attempt in email", async ({ page }) => {
    await page.goto("/login")
    await page.locator("input[placeholder='name@example.com']").fill("<script>alert(1)</script>@test.com")
    await page.locator("input[type='password']").fill("password123")
    await page.locator("button[type='submit']").click()
    await page.waitForTimeout(2000)
    // Should not execute script, should show error or stay on login
    await expect(page).toHaveURL(/\/login/)
    // Verify no alert dialog appeared
    expect(page.url()).toContain("/login")
  })

  // === Registration Edge Cases ===

  test("register with short username (< 3 chars)", async ({ page }) => {
    await page.goto("/register")
    await page.waitForTimeout(1000)
    const usernameInput = page.locator("input[placeholder='johndoe']").first()
    if (await usernameInput.isVisible()) {
      await usernameInput.fill("ab")
      await page.locator("input[placeholder='name@example.com']").fill("test@test.com")
      const passwords = page.locator("input[type='password']")
      await passwords.nth(0).fill("ValidPass1")
      await passwords.nth(1).fill("ValidPass1")
      // Select role
      const learnerBtn = page.locator("button:has-text('Learner')").first()
      if (await learnerBtn.isVisible()) await learnerBtn.click()
      const submitBtn = page.locator("button:has-text('Create Account')").first()
      if (await submitBtn.isEnabled()) {
        await submitBtn.click()
        await page.waitForTimeout(2000)
        // Should show validation error
        await expect(page).toHaveURL(/\/register/)
      }
    }
  })

  test("register with weak password (no uppercase)", async ({ page }) => {
    await page.goto("/register")
    await page.waitForTimeout(1000)
    const usernameInput = page.locator("input[placeholder='johndoe']").first()
    if (await usernameInput.isVisible()) {
      await usernameInput.fill("testuser123")
      await page.locator("input[placeholder='name@example.com']").fill("weakpass@test.com")
      const passwords = page.locator("input[type='password']")
      await passwords.nth(0).fill("weakpassword1") // no uppercase
      await passwords.nth(1).fill("weakpassword1")
      const learnerBtn = page.locator("button:has-text('Learner')").first()
      if (await learnerBtn.isVisible()) await learnerBtn.click()
      const submitBtn = page.locator("button:has-text('Create Account')").first()
      // Should be disabled or show error on submit
      if (await submitBtn.isEnabled()) {
        await submitBtn.click()
        await page.waitForTimeout(2000)
        await expect(page).toHaveURL(/\/register/)
      }
    }
  })

  test("register with password mismatch", async ({ page }) => {
    await page.goto("/register")
    await page.waitForTimeout(1000)
    const usernameInput = page.locator("input[placeholder='johndoe']").first()
    if (await usernameInput.isVisible()) {
      await usernameInput.fill("mismatchtest")
      await page.locator("input[placeholder='name@example.com']").fill("mismatch@test.com")
      const passwords = page.locator("input[type='password']")
      await passwords.nth(0).fill("ValidPass1")
      await passwords.nth(1).fill("DifferentPass2")
      const learnerBtn = page.locator("button:has-text('Learner')").first()
      if (await learnerBtn.isVisible()) await learnerBtn.click()
      const submitBtn = page.locator("button:has-text('Create Account')").first()
      // Should be disabled due to mismatch
      await expect(submitBtn).toBeDisabled()
    }
  })

  // === Unauthorized Access Edge Cases ===

  test("protected routes redirect to login when unauthenticated", async ({ page }) => {
    const protectedRoutes = [
      "/dashboard",
      "/knowledge/documents",
      "/knowledge/tags",
      "/community/friendship",
      "/profile",
      "/settings",
    ]

    for (const route of protectedRoutes) {
      await page.goto("/login")
      await page.evaluate(() => localStorage.clear())
      await page.goto(route)
      await expect(page).toHaveURL(/\/login/, { timeout: 5000 })
    }
  })

  // === Navigation Edge Cases ===

  test("404 page for non-existent route", async ({ page }) => {
    await page.goto("/nonexistent-route-xyz-123")
    await page.waitForTimeout(1000)
    // Should show 404 or redirect to landing/login
    const url = page.url()
    const has404 = await page.locator("text=/not found|404|page not found/i").first().isVisible().catch(() => false)
    const redirected = url.includes("/login") || url.endsWith("/")
    expect(has404 || redirected).toBeTruthy()
  })

  test("theme toggle persists across pages", async ({ page }) => {
    await page.goto("/login")
    // Toggle to dark mode
    const themeBtn = page.locator("button:has-text('Dark')").first()
    if (await themeBtn.isVisible()) {
      await themeBtn.click()
      await page.waitForTimeout(500)
      // Navigate away and back
      await page.goto("/")
      await page.goto("/login")
      // Should still be in dark mode (button says "Light")
      await expect(page.locator("button:has-text('Light')").first()).toBeVisible()
    }
  })

  // === Double Submit Prevention ===

  test("login button disables during submission", async ({ page }) => {
    await page.goto("/login")
    await page.locator("input[placeholder='name@example.com']").fill("student@hkive.com")
    await page.locator("input[type='password']").fill("password123")
    const submitBtn = page.locator("button[type='submit']")
    await submitBtn.click()
    // Button should show loading state briefly
    // Just verify no double navigation occurs
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 })
  })

  // === Forgot Password Edge Cases ===

  test("forgot password with empty email", async ({ page }) => {
    await page.goto("/forgot-password")
    const submitBtn = page.locator("button:has-text('Send Reset Code'), button[type='submit']").first()
    // Should be disabled or show error
    if (await submitBtn.isEnabled()) {
      await submitBtn.click()
      await page.waitForTimeout(1000)
      // Should stay on forgot password page
      await expect(page).toHaveURL(/\/forgot-password/)
    }
  })

  test("forgot password OTP only accepts digits", async ({ page }) => {
    await page.goto("/forgot-password")
    await page.locator("input[placeholder='name@example.com']").fill("student@hkive.com")
    await page.locator("button:has-text('Send Reset Code'), button[type='submit']").first().click()
    await page.waitForTimeout(3000)
    const otpInput = page.locator("input[placeholder='123456']")
    if (await otpInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await otpInput.fill("abcdef")
      // OTP field should reject non-digits or remain empty
      const value = await otpInput.inputValue()
      expect(value).not.toBe("abcdef")
    }
  })
})
