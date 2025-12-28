/**
 * E2E Tests for Voice Messages (F041)
 *
 * Tests the complete voice message workflow:
 * 1. Navigate to channel
 * 2. Click voice message button
 * 3. Grant microphone permission (mock)
 * 4. Record voice message
 * 5. Preview and send
 * 6. Verify message appears in channel
 * 7. Play voice message
 * 8. Verify transcription appears
 */

import { test, expect } from "@playwright/test";

test.describe("Voice Messages E2E (F041)", () => {
  test.beforeEach(async ({ page, context }) => {
    // Grant microphone permissions
    await context.grantPermissions(["microphone"]);

    // Navigate to the app (adjust URL as needed)
    await page.goto("/");

    // Wait for auth (this would need to be adapted based on your auth setup)
    // For testing, you might use test credentials or mock auth
  });

  test("complete voice message workflow in channel", async ({ page }) => {
    // Step 1: Navigate to a test channel
    await page.click('text=test-channel');
    await expect(page).toHaveURL(/.*channels.*/);

    // Step 2: Click voice message button
    await page.click('[aria-label="Record voice message"]');

    // Step 3: Verify recorder UI appears
    await expect(page.getByRole("button", { name: /start recording/i })).toBeVisible();

    // Step 4: Start recording
    await page.click('button:has-text("Start Recording")');

    // Step 5: Verify recording UI
    await expect(page.locator('[role="timer"]')).toBeVisible();
    await expect(page.locator('[role="img"][aria-label*="waveform"]')).toBeVisible();

    // Step 6: Wait a few seconds (simulate recording)
    await page.waitForTimeout(2000);

    // Step 7: Stop recording
    await page.click('button:has-text("Stop")');

    // Step 8: Verify preview appears
    await expect(page.getByRole("button", { name: /send/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /cancel|delete/i })).toBeVisible();

    // Step 9: Send the voice message
    await page.click('button:has-text("Send")');

    // Step 10: Verify message appears in channel
    await expect(page.locator('[data-message-type="voice"]')).toBeVisible({
      timeout: 10000,
    });

    // Step 11: Verify waveform is displayed
    await expect(
      page.locator('[data-message-type="voice"] >> [role="img"]')
    ).toBeVisible();

    // Step 12: Click play button
    await page.click('[data-message-type="voice"] >> button[aria-label*="play"]');

    // Step 13: Verify playback starts
    await expect(
      page.locator('[data-message-type="voice"] >> button[aria-label*="pause"]')
    ).toBeVisible();

    // Step 14: Wait for transcription to appear (may take a few seconds)
    await expect(
      page.locator('[data-message-type="voice"] >> [data-transcription]')
    ).toBeVisible({ timeout: 15000 });
  });

  test("cancel voice recording", async ({ page }) => {
    await page.click('text=test-channel');

    // Open voice recorder
    await page.click('[aria-label="Record voice message"]');

    // Start recording
    await page.click('button:has-text("Start Recording")');

    await page.waitForTimeout(1000);

    // Cancel recording
    await page.click('button:has-text("Cancel")');

    // Verify recorder is closed
    await expect(page.getByRole("button", { name: /start recording/i })).not.toBeVisible();
  });

  test("keyboard shortcuts work in voice recorder", async ({ page }) => {
    await page.click('text=test-channel');

    // Open voice recorder
    await page.click('[aria-label="Record voice message"]');

    // Press Escape to cancel
    await page.keyboard.press("Escape");

    // Verify recorder is closed
    await expect(page.getByRole("button", { name: /start recording/i })).not.toBeVisible();
  });

  test("voice message in thread reply", async ({ page }) => {
    await page.click('text=test-channel');

    // Click reply on an existing message
    await page.click('[data-message]:first-child >> button[aria-label*="reply"]');

    // Open voice recorder in thread
    await page.click('[aria-label="Record voice message"]');

    // Start, record, and send
    await page.click('button:has-text("Start Recording")');
    await page.waitForTimeout(2000);
    await page.click('button:has-text("Stop")');
    await page.click('button:has-text("Send")');

    // Verify voice message appears in thread
    await expect(
      page.locator('[data-thread] >> [data-message-type="voice"]')
    ).toBeVisible({ timeout: 10000 });
  });

  test("playback speed controls work", async ({ page }) => {
    await page.click('text=test-channel');

    // Assume there's already a voice message in the channel
    const voiceMessage = page.locator('[data-message-type="voice"]').first();
    await expect(voiceMessage).toBeVisible();

    // Click speed selector
    await voiceMessage.locator('button[aria-label*="speed"]').click();

    // Select 1.5x speed
    await page.click('text=1.5x');

    // Verify speed is applied (would need to check aria-label or state)
    await expect(
      voiceMessage.locator('button[aria-label*="1.5x"]')
    ).toBeVisible();
  });

  test("edit transcription", async ({ page }) => {
    await page.click('text=test-channel');

    // Assume there's a voice message with completed transcription
    const voiceMessage = page.locator('[data-message-type="voice"]').first();

    // Click edit button on transcription
    await voiceMessage.locator('button[aria-label*="edit transcription"]').click();

    // Edit the text
    const textarea = voiceMessage.locator('textarea[data-transcription-editor]');
    await textarea.fill("This is the edited transcription");

    // Save
    await voiceMessage.locator('button:has-text("Save")').click();

    // Verify edited transcription appears
    await expect(
      voiceMessage.locator('text=This is the edited transcription')
    ).toBeVisible();
  });

  test("retry failed transcription", async ({ page }) => {
    await page.click('text=test-channel');

    // Assume there's a voice message with failed transcription
    const voiceMessage = page.locator('[data-transcription-status="failed"]').first();
    await expect(voiceMessage).toBeVisible();

    // Click retry button
    await voiceMessage.locator('button[aria-label*="retry transcription"]').click();

    // Verify status changes to processing
    await expect(
      page.locator('[data-transcription-status="processing"]')
    ).toBeVisible({ timeout: 5000 });
  });

  test("accessibility - keyboard navigation", async ({ page }) => {
    await page.click('text=test-channel');

    // Open voice recorder
    await page.click('[aria-label="Record voice message"]');

    // Tab through controls
    await page.keyboard.press("Tab");
    await expect(page.locator(':focus')).toHaveRole("button");

    // Verify all interactive elements are keyboard accessible
    const startButton = page.getByRole("button", { name: /start recording/i });
    await expect(startButton).toBeFocused();
  });

  test("mobile: voice recording works on small screens", async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.click('text=test-channel');

    // Open voice recorder
    await page.click('[aria-label="Record voice message"]');

    // Verify UI is responsive
    await expect(page.getByRole("button", { name: /start recording/i })).toBeVisible();

    // Record and send
    await page.click('button:has-text("Start Recording")');
    await page.waitForTimeout(2000);
    await page.click('button:has-text("Stop")');
    await page.click('button:has-text("Send")');

    // Verify message appears
    await expect(page.locator('[data-message-type="voice"]')).toBeVisible({
      timeout: 10000,
    });
  });
});
