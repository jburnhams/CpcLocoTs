from playwright.sync_api import Page, expect, sync_playwright
import time

def verify_debug_ui(page: Page):
    page.goto("http://localhost:5173/")

    # Open settings
    page.click("#settingsButton")

    # Enable debug mode
    debug_mode = page.locator("#debugModeInput")
    if not debug_mode.is_checked():
        debug_mode.check()

    # Check if debug area is visible
    debug_area = page.locator("#debugArea")
    expect(debug_area).to_be_visible()

    # Check for new elements
    expect(page.locator("#debugCallStack")).to_be_visible()
    expect(page.locator("#debugConsoleArea")).to_be_visible()
    expect(page.locator("#debugMemoryArea")).to_be_visible()

    # Take screenshot of the debug panel
    page.screenshot(path="verification/debug_ui.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_debug_ui(page)
        finally:
            browser.close()
