// SPDX-License-Identifier: MIT

import { test, expect } from "@playwright/test";

// Mobile viewport (Pixel 5)
const MOBILE_VIEWPORT = { width: 412, height: 915 };

// Fake Stellar public key for the mock wallet
const MOCK_PUBLIC_KEY = "GBD4R7KL1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZABCD";

interface FreighterMock {
  isConnected: () => Promise<boolean>;
  getAddress: () => Promise<string>;
  getNetwork: () => Promise<string>;
  requestAccess: () => Promise<string>;
  signTransaction: (xdr: string) => Promise<string>;
  signMessage: () => Promise<string>;
  getNetworkDetails: () => Promise<{ network: string; networkPassphrase: string }>;
}

/** Mock the Freighter wallet extension so the page renders the form. */
async function mockWalletConnection(page: import("@playwright/test").Page) {
  await page.addInitScript((pk: string) => {
    const mock: FreighterMock = {
      isConnected: async () => true,
      getAddress: async () => pk,
      getNetwork: async () => "TESTNET",
      requestAccess: async () => pk,
      signTransaction: async (xdr: string) => xdr,
      signMessage: async () => "mock-signature",
      getNetworkDetails: async () => ({
        network: "TESTNET",
        networkPassphrase: "Test SDF Network ; September 2015",
      }),
    };
    (window as unknown as Record<string, unknown>).freighter = mock;
  }, MOCK_PUBLIC_KEY);

  // Mock the Horizon balance API to return a sufficient balance
  await page.route("**/accounts/**/balances", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        balances: [
          {
            balance: "10000.0000000",
            asset_type: "native",
          },
        ],
      }),
    })
  );
}

test.describe("Batch Creation - Mobile Layout", () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  test("batch form renders correctly on mobile", async ({ page }) => {
    await mockWalletConnection(page);
    await page.goto("/batches/new");

    // Wait for page to load
    await expect(page.locator("main")).toBeVisible({ timeout: 15000 });

    // Verify page title is visible
    await expect(page.getByText("New Batch Payment")).toBeVisible();

    // Verify CSV dropzone is visible and usable
    const dropzone = page.locator("[data-testid='csv-dropzone']");
    await expect(dropzone).toBeVisible();

    // Verify Choose CSV File button is visible with proper touch target
    const chooseFileBtn = page.getByText("Choose CSV File");
    await expect(chooseFileBtn).toBeVisible();
    const chooseFileBtnBox = await chooseFileBtn.boundingBox();
    expect(chooseFileBtnBox?.height).toBeGreaterThanOrEqual(44);

    // Verify Download Template button is visible with proper touch target
    const downloadTemplateBtn = page.getByText("Download Template");
    await expect(downloadTemplateBtn).toBeVisible();
    const downloadTemplateBtnBox = await downloadTemplateBtn.boundingBox();
    expect(downloadTemplateBtnBox?.height).toBeGreaterThanOrEqual(44);
  });

  test("CSV dropzone fits within mobile viewport", async ({ page }) => {
    await mockWalletConnection(page);
    await page.goto("/batches/new");

    const dropzone = page.locator("[data-testid='csv-dropzone']");
    await expect(dropzone).toBeVisible();

    const dropzoneBox = await dropzone.boundingBox();
    expect(dropzoneBox).not.toBeNull();

    // Verify dropzone doesn't overflow viewport
    expect(dropzoneBox!.x).toBeGreaterThanOrEqual(0);
    expect(dropzoneBox!.x + dropzoneBox!.width).toBeLessThanOrEqual(
      MOBILE_VIEWPORT.width
    );
  });

  test("no horizontal overflow on mobile", async ({ page }) => {
    await mockWalletConnection(page);
    await page.goto("/batches/new");

    // Wait for page to load
    await expect(page.locator("main")).toBeVisible({ timeout: 15000 });

    // Check for horizontal overflow
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);

    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1); // Allow 1px tolerance
  });

  test("recipient row inputs have proper touch targets", async ({ page }) => {
    await mockWalletConnection(page);
    await page.goto("/batches/new");

    // Wait for page to load
    await expect(page.locator("main")).toBeVisible({ timeout: 15000 });

    // Verify address input has proper touch target
    const addressInput = page.locator('input[placeholder*="G... destination address"]').first();
    await expect(addressInput).toBeVisible();
    const addressInputBox = await addressInput.boundingBox();
    expect(addressInputBox?.height).toBeGreaterThanOrEqual(44);

    // Verify amount input has proper touch target
    const amountInput = page.locator('input[placeholder="0.00"]').first();
    await expect(amountInput).toBeVisible();
    const amountInputBox = await amountInput.boundingBox();
    expect(amountInputBox?.height).toBeGreaterThanOrEqual(44);

    // Verify memo input has proper touch target
    const memoInput = page.locator('input[placeholder="Memo (optional)"]').first();
    await expect(memoInput).toBeVisible();
    const memoInputBox = await memoInput.boundingBox();
    expect(memoInputBox?.height).toBeGreaterThanOrEqual(44);
  });

  test("Add Recipient button has proper touch target", async ({ page }) => {
    await mockWalletConnection(page);
    await page.goto("/batches/new");

    // Wait for page to load
    await expect(page.locator("main")).toBeVisible({ timeout: 15000 });

    // Verify Add Recipient button has proper touch target
    const addRecipientBtn = page.getByText("Add Recipient");
    await expect(addRecipientBtn).toBeVisible();
    const addRecipientBtnBox = await addRecipientBtn.boundingBox();
    expect(addRecipientBtnBox?.height).toBeGreaterThanOrEqual(44);
  });

  test("Remove button has proper touch target", async ({ page }) => {
    await mockWalletConnection(page);
    await page.goto("/batches/new");

    // Wait for page to load
    await expect(page.locator("main")).toBeVisible({ timeout: 15000 });

    // Add a second recipient to show Remove button
    const addRecipientBtn = page.getByText("Add Recipient");
    await addRecipientBtn.click();

    // Verify Remove button has proper touch target
    const removeBtn = page.getByText("Remove").first();
    await expect(removeBtn).toBeVisible();
    const removeBtnBox = await removeBtn.boundingBox();
    expect(removeBtnBox?.height).toBeGreaterThanOrEqual(44);
    expect(removeBtnBox?.width).toBeGreaterThanOrEqual(44);
  });

  test("Send Batch Payment button has proper touch target", async ({ page }) => {
    await mockWalletConnection(page);
    await page.goto("/batches/new");

    // Wait for page to load
    await expect(page.locator("main")).toBeVisible({ timeout: 15000 });

    // Verify Send Batch Payment button has proper touch target
    const sendBtn = page.getByText("Send Batch Payment");
    await expect(sendBtn).toBeVisible();
    const sendBtnBox = await sendBtn.boundingBox();
    expect(sendBtnBox?.height).toBeGreaterThanOrEqual(44);
  });

  test("confirmation dialog opens correctly on mobile", async ({ page }) => {
    await mockWalletConnection(page);
    await page.goto("/batches/new");

    // Wait for page to load
    await expect(page.locator("main")).toBeVisible({ timeout: 15000 });

    // Fill in a valid recipient (use a different address than the wallet's own)
    const addressInput = page.locator('input[placeholder*="G... destination address"]').first();
    await addressInput.fill("GCZBMJLNWV5KQ5MG3KQG7ZQ6M7ZS5YRLZVFKQWVGCFSVMNAMR7ZNCJ4");

    const amountInput = page.locator('input[placeholder="0.00"]').first();
    await amountInput.fill("10");

    // Click Send Batch Payment
    const sendBtn = page.getByText("Send Batch Payment");
    await sendBtn.click();

    // Verify confirmation dialog opens
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Verify dialog fits within viewport
    const dialogBox = await dialog.boundingBox();
    expect(dialogBox).not.toBeNull();
    expect(dialogBox!.x).toBeGreaterThanOrEqual(0);
    expect(dialogBox!.x + dialogBox!.width).toBeLessThanOrEqual(
      MOBILE_VIEWPORT.width
    );

    // Verify Confirm & Sign button is visible with proper touch target
    const confirmBtn = page.getByTestId("batch-confirm-send");
    await expect(confirmBtn).toBeVisible();
    const confirmBtnBox = await confirmBtn.boundingBox();
    expect(confirmBtnBox?.height).toBeGreaterThanOrEqual(44);

    // Verify Back button is visible with proper touch target
    const backBtn = page.getByText("Back");
    await expect(backBtn).toBeVisible();
    const backBtnBox = await backBtn.boundingBox();
    expect(backBtnBox?.height).toBeGreaterThanOrEqual(44);

    // Verify dialog doesn't create horizontal overflow
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });

  test("desktop layout still works", async ({ page }) => {
    await mockWalletConnection(page);
    // Use desktop viewport
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/batches/new");

    // Wait for page to load
    await expect(page.locator("main")).toBeVisible({ timeout: 15000 });

    // Verify page title is visible
    await expect(page.getByText("New Batch Payment")).toBeVisible();

    // Verify CSV dropzone is visible
    const dropzone = page.locator("[data-testid='csv-dropzone']");
    await expect(dropzone).toBeVisible();

    // Verify form elements are visible
    const addressInput = page.locator('input[placeholder*="G... destination address"]').first();
    await expect(addressInput).toBeVisible();

    // Verify no horizontal overflow
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });
});
