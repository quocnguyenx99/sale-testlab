import os
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE_URL = os.getenv("SALES_WEB_URL", "http://localhost:5173")
EMAIL = os.environ["DEV_BOOTSTRAP_EMAIL"]
PASSWORD = os.environ["DEV_BOOTSTRAP_PASSWORD"]
ARTIFACTS = Path(__file__).parent.parent / "test-artifacts"

TREND_LABELS = {
    "NO_DATA": "Chưa có dữ liệu",
    "BASELINE_ONLY": "Đã có điểm khởi đầu",
    "LIMITED_DATA": "Chưa đủ dữ liệu để xác định xu hướng",
    "IMPROVING": "Đang cải thiện",
    "STABLE": "Tương đối ổn định",
    "DECLINING": "Có xu hướng giảm",
}

def collect_keys(value, keys=None):
    keys = [] if keys is None else keys
    if isinstance(value, dict):
        for key, child in value.items():
            keys.append(key)
            collect_keys(child, keys)
    elif isinstance(value, list):
        for child in value:
            collect_keys(child, keys)
    return keys

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
    page.goto(f"{BASE_URL}/progress", wait_until="networkidle")
    page.get_by_role("heading", name="Tiến độ luyện tập").wait_for()
    assert page.get_by_text("Không thể tải tiến độ luyện tập lúc này.").count() == 0
    api_progress = page.evaluate("async () => (await (await fetch('/api/v3/progress')).json()).progress")
    summary = api_progress["summary"]
    summary_section = page.locator("section[aria-label='Tóm tắt tiến độ']")
    total_card = summary_section.get_by_text("Tổng số phiên", exact=True).locator("..")
    completed_card = summary_section.get_by_text("Phiên đã hoàn thành", exact=True).locator("..")
    evaluated_card = summary_section.get_by_text("Phiên đã đánh giá", exact=True).locator("..")
    average_card = summary_section.get_by_text("Điểm trung bình", exact=True).locator("..")
    assert total_card.get_by_text(str(summary["totalSessions"]), exact=True).count() == 1
    assert completed_card.get_by_text(str(summary["completedSessions"]), exact=True).count() == 1
    assert evaluated_card.get_by_text(str(summary["evaluatedSessions"]), exact=True).count() == 1
    average_text = page.evaluate("value => value === null ? 'Chưa có dữ liệu' : new Intl.NumberFormat('vi-VN', {maximumFractionDigits: 1}).format(value)", summary["averageOverallScore"])
    recent_average_text = page.evaluate("value => value === null ? 'Chưa có dữ liệu' : new Intl.NumberFormat('vi-VN', {maximumFractionDigits: 1}).format(value)", summary["recentAverageScore"])
    assert average_card.get_by_text(average_text, exact=True).count() == 1
    if summary["recentAverageScore"] is not None:
        assert average_card.get_by_text(f"Gần đây: {recent_average_text}", exact=True).count() == 1
    assert page.get_by_text(TREND_LABELS[api_progress["overallTrend"]["state"]], exact=True).count() >= 1

    for skill in api_progress["skills"]:
        heading = page.get_by_role("heading", name=skill["label"], exact=True)
        assert heading.count() == 1
        card = heading.locator("xpath=../..")
        average = page.evaluate("value => value === null ? 'Chưa có dữ liệu' : new Intl.NumberFormat('vi-VN', {maximumFractionDigits: 1}).format(value)", skill["averageScore"])
        recent = page.evaluate("value => value === null ? 'Chưa có dữ liệu' : new Intl.NumberFormat('vi-VN', {maximumFractionDigits: 1}).format(value)", skill["recentScore"])
        assert card.get_by_text(average, exact=True).count() >= 1
        assert card.get_by_text(recent, exact=True).count() >= 1

    skills_by_key = {skill["criterionKey"]: skill for skill in api_progress["skills"]}
    for highlight_key in ["strongestSkillKey", "needsAttentionSkillKey"]:
        criterion_key = api_progress["highlights"][highlight_key]
        if criterion_key is not None:
            assert page.get_by_text(skills_by_key[criterion_key]["label"], exact=True).count() >= 2

    recent_rows = page.locator("table tbody tr")
    assert recent_rows.count() == len(api_progress["recentEvaluatedSessions"])
    for index, recent_session in enumerate(api_progress["recentEvaluatedSessions"]):
        assert recent_session["persona"]["displayName"] in recent_rows.nth(index).inner_text()

    forbidden = {"criteria", "evidence", "evidenceTurnSequences", "transcript", "coachingFeedback", "runtimeSnapshot", "personaSnapshot", "prompt", "rawProviderResponse", "source_entity_id", "stock_qty", "password", "credential"}
    assert not forbidden.intersection(collect_keys(api_progress))
    page.screenshot(path=str(ARTIFACTS / "phase9c-progress-desktop.png"), full_page=True)
    assert any(method == "GET" and url.endswith("/api/v3/progress") for method, url in requests)
    assert any(status == 200 and url.endswith("/api/v3/progress") for status, url in responses)
    assert not any(method == "POST" and (url.endswith("/evaluation") or url.endswith("/coaching")) for method, url in requests)
    assert not console_errors, console_errors

    for width, height, label in [(768, 1024, "tablet"), (390, 844, "mobile")]:
        page.set_viewport_size({"width": width, "height": height})
        page.goto(f"{BASE_URL}/progress", wait_until="networkidle")
        page.get_by_role("heading", name="Tiến độ luyện tập").wait_for()
        assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
        page.screenshot(path=str(ARTIFACTS / f"phase9c-progress-{label}.png"), full_page=True)

    page.set_viewport_size({"width": 1280, "height": 900})
    page.goto(f"{BASE_URL}/progress", wait_until="networkidle")
    result_link = page.get_by_role("button", name="Xem kết quả").first
    assert result_link.count() == 1
    result_link.click()
    page.wait_for_url("**/practice/*/result")
    page.go_back(wait_until="networkidle")
    page.get_by_role("heading", name="Tiến độ luyện tập").wait_for()
    page.reload(wait_until="networkidle")
    page.get_by_role("heading", name="Tiến độ luyện tập").wait_for()
    page.goto(f"{BASE_URL}/progress", wait_until="networkidle")
    page.get_by_role("heading", name="Tiến độ luyện tập").wait_for()
    assert not any(method == "POST" and (url.endswith("/evaluation") or url.endswith("/coaching")) for method, url in requests)
    assert not console_errors, console_errors

    context.close()
    browser.close()

print("Phase 9C real browser progress acceptance: PASS")
