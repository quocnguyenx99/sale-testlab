import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE_URL = os.getenv("SALES_WEB_URL", "http://localhost:5173")
ARTIFACTS = Path(__file__).parent.parent / "test-artifacts"

USER = {"id": "dashboard-user", "email": "dashboard@example.test", "displayName": "Dashboard User", "role": "SALE"}
PERSONA = {"id": "safe-persona", "displayName": "Khách hàng mẫu", "role": "Mua hàng", "customerType": "Doanh nghiệp", "difficulty": "MEDIUM", "summary": "Fixture", "interests": [], "scenarioContext": "Fixture", "defaultScenario": {"id": "safe", "title": "Fixture", "description": "Fixture", "difficulty": "MEDIUM"}}
SESSION = {"id": "safe-session", "persona": {"id": "safe-persona", "displayName": "Khách hàng mẫu", "role": "Mua hàng", "customerType": "Doanh nghiệp"}, "mode": "SALE_FIRST", "status": "COMPLETED", "createdAt": "2026-08-18T08:00:00.000Z", "updatedAt": "2026-08-18T08:15:00.000Z", "completedAt": "2026-08-18T08:15:00.000Z", "turnCount": 4, "dealOutcome": "quote_requested", "trainingStatus": "completed"}

def progress(state="IMPROVING", evaluated=4, average=72):
    return {"progress": {"evaluatorVersion": "testlab-evaluator-v1", "summary": {"totalSessions": 5, "completedSessions": 5, "evaluatedSessions": evaluated, "averageOverallScore": average, "recentAverageScore": average, "trainingFrequency": {"windowDays": 28, "completedSessions": 5, "averagePerWeek": 1.3}}, "overallTrend": {"state": state, "delta": 5 if state == "IMPROVING" else -5 if state == "DECLINING" else 0, "sampleCount": evaluated, "comparisonWindowSize": 2, "points": []}, "skills": [], "highlights": {"strongestSkillKey": None, "needsAttentionSkillKey": None}, "recentEvaluatedSessions": []}}

def fulfill(route, body, status=200):
    route.fulfill(status=status, content_type="application/json", body=json.dumps(body, ensure_ascii=False))

def run_case(browser, response, expected_text, progress_status=200):
    page = browser.new_page(viewport={"width": 1280, "height": 900})
    console_errors = []
    requests = []
    page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
    page.on("request", lambda request: requests.append((request.method, request.url)))

    def api(route):
        url = route.request.url
        if url.endswith("/api/v3/auth/me"): return fulfill(route, {"user": USER})
        if url.endswith("/api/v3/personas"): return fulfill(route, {"personas": [PERSONA]})
        if "/api/v3/sessions" in url: return fulfill(route, {"items": [SESSION], "sessions": [SESSION], "page": 1, "pageSize": 10, "total": 1, "totalPages": 1})
        if url.endswith("/api/v3/progress"): return fulfill(route, response, progress_status)
        if url.endswith("/api/v3/gamification/me"): return fulfill(route, {"gamification": {"ruleVersion": "testlab-gamification-v1", "timezone": "Asia/Ho_Chi_Minh", "totalXp": 0, "level": 1, "currentLevelXp": 0, "xpToNextLevel": 250, "currentStreakDays": 0, "bestStreakDays": 0, "currentMonth": {"xp": 0, "rank": None, "creditedSessions": 0}, "recentActivities": []}})
        return fulfill(route, {"error": {"code": "NOT_FOUND", "message": "Not found"}}, 404)

    page.route("**/api/v3/**", api)
    page.goto(f"{BASE_URL}/dashboard", wait_until="networkidle")
    page.get_by_role("heading", name="Khách hàng đề xuất").wait_for()
    page.get_by_role("heading", name="Tiến độ luyện tập").wait_for()
    page.get_by_text(expected_text, exact=True).wait_for()
    assert any(method == "GET" and url.endswith("/api/v3/progress") for method, url in requests)
    assert not any(method == "POST" and (url.endswith("/evaluation") or url.endswith("/coaching")) for method, url in requests)
    if progress_status == 200:
        assert not console_errors, console_errors
    else:
        assert all("503" in message for message in console_errors), console_errors
    return page

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)

    page = run_case(browser, progress(), "Đang cải thiện")
    page.get_by_text("72", exact=True).wait_for()
    page.screenshot(path=str(ARTIFACTS / "phase9d-dashboard-fixture-desktop.png"), full_page=True)
    page.set_viewport_size({"width": 390, "height": 844})
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
    page.screenshot(path=str(ARTIFACTS / "phase9d-dashboard-fixture-mobile.png"), full_page=True)
    page.set_viewport_size({"width": 1280, "height": 900})
    page.get_by_role("button", name="Xem tiến độ").click()
    page.wait_for_url("**/progress")
    page.close()

    for state, label in [("STABLE", "Tương đối ổn định"), ("DECLINING", "Có xu hướng giảm")]:
        case_page = run_case(browser, progress(state=state), label)
        case_page.close()

    no_data_page = run_case(browser, progress(evaluated=0, average=None), "Chưa có dữ liệu đánh giá")
    assert no_data_page.locator("[data-testid='dashboard-progress-card']").get_by_text("0", exact=True).count() == 0
    no_data_page.close()

    error_page = run_case(browser, {"error": {"code": "PROGRESS_UNAVAILABLE", "message": "safe"}}, "Chưa thể tải tiến độ lúc này.", 503)
    assert error_page.get_by_role("heading", name="Khách hàng đề xuất").is_visible()
    error_page.close()
    browser.close()

print("Phase 9D deterministic dashboard progress browser tests: PASS")
