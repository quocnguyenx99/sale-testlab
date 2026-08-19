import os
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE_URL = os.getenv("SALES_WEB_URL", "http://127.0.0.1:5173")
EMAIL = os.environ["DEV_BOOTSTRAP_EMAIL"]
PASSWORD = os.environ["DEV_BOOTSTRAP_PASSWORD"]
ARTIFACTS = Path(__file__).parent.parent / "test-artifacts"

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context(viewport={"width": 1280, "height": 900})
    page = context.new_page()
    console_errors = []
    requests = []
    responses = []
    page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
    page.on("request", lambda request: requests.append((request.method, request.url)))
    page.on("response", lambda response: responses.append((response.status, response.url)))

    page.goto(f"{BASE_URL}/login", wait_until="networkidle")
    page.get_by_label("Email").fill(EMAIL)
    page.get_by_role("textbox", name="Mật khẩu").fill(PASSWORD)
    page.get_by_role("button", name="Đăng nhập").click()
    page.wait_for_url(f"{BASE_URL}/dashboard")

    requests.clear()
    responses.clear()
    console_errors.clear()
    page.reload(wait_until="networkidle")
    page.get_by_role("heading", name="Tiến độ luyện tập").wait_for()
    page.locator("[data-testid='dashboard-progress-card']").wait_for()
    api_progress = page.evaluate("async () => (await (await fetch('/api/v3/progress')).json()).progress")
    card = page.locator("[data-testid='dashboard-progress-card']")
    summary = api_progress["summary"]
    if summary["evaluatedSessions"] > 0 and summary["averageOverallScore"] is not None:
        average_text = page.evaluate("value => new Intl.NumberFormat('vi-VN', {maximumFractionDigits: 1}).format(value)", summary["averageOverallScore"])
        assert card.get_by_text(str(summary["evaluatedSessions"]), exact=True).count() == 1
        assert card.get_by_text(average_text, exact=True).count() == 1
    assert any(method == "GET" and url.endswith("/api/v3/progress") for method, url in requests)
    assert any(status == 200 and url.endswith("/api/v3/progress") for status, url in responses)
    assert not any(method == "POST" and (url.endswith("/evaluation") or url.endswith("/coaching")) for method, url in requests)
    assert not console_errors, console_errors
    page.screenshot(path=str(ARTIFACTS / "phase9d-dashboard-desktop.png"), full_page=True)

    page.get_by_role("button", name="Xem tiến độ").click()
    page.wait_for_url("**/progress")
    page.get_by_role("heading", name="Tiến độ luyện tập").wait_for()

    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(f"{BASE_URL}/dashboard", wait_until="networkidle")
    page.get_by_role("heading", name="Tiến độ luyện tập").wait_for()
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
    page.screenshot(path=str(ARTIFACTS / "phase9d-dashboard-mobile.png"), full_page=True)
    context.close()
    browser.close()

print("Phase 9D real Dashboard progress browser acceptance: PASS")
