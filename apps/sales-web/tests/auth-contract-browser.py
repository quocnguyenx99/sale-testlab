import json
import os
from playwright.sync_api import sync_playwright

BASE_URL = os.getenv("SALES_WEB_URL", "http://127.0.0.1:5173")
MANAGER = {
    "id": "phase10a3-manager",
    "email": "manager@example.test",
    "displayName": "Phase 10A-3 Manager",
    "role": "MANAGER",
}
PROGRESS = {
    "evaluatorVersion": "testlab-evaluator-v1",
    "summary": {
        "totalSessions": 0,
        "completedSessions": 0,
        "evaluatedSessions": 0,
        "averageOverallScore": None,
        "recentAverageScore": None,
        "trainingFrequency": {"windowDays": 28, "completedSessions": 0, "averagePerWeek": 0},
    },
    "overallTrend": {
        "state": "INSUFFICIENT_DATA",
        "delta": None,
        "sampleCount": 0,
        "comparisonWindowSize": 0,
        "points": [],
    },
    "skills": [],
    "highlights": {"strongestSkillKey": None, "needsAttentionSkillKey": None},
    "recentEvaluatedSessions": [],
}


def fulfill(route, body, status=200):
    route.fulfill(status=status, content_type="application/json", body=json.dumps(body))


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 900})
    authenticated = {"value": False}
    requests = []
    console_errors = []
    page.on("request", lambda request: requests.append((request.method, request.url)))
    page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)

    def api(route):
        url = route.request.url
        method = route.request.method
        if url.endswith("/api/v3/auth/me"):
            if authenticated["value"]:
                return fulfill(route, {"user": MANAGER})
            return fulfill(route, {"error": {"code": "UNAUTHENTICATED", "message": "Authentication required"}}, 401)
        if url.endswith("/api/v3/auth/login") and method == "POST":
            authenticated["value"] = True
            return fulfill(route, {"user": MANAGER})
        if url.endswith("/api/v3/personas"):
            return fulfill(route, {"personas": []})
        if "/api/v3/sessions" in url and method == "GET":
            return fulfill(route, {"sessions": [], "items": [], "page": 1, "pageSize": 10, "total": 0, "totalPages": 0})
        if url.endswith("/api/v3/progress"):
            return fulfill(route, {"progress": PROGRESS})
        return fulfill(route, {"error": {"code": "NOT_FOUND", "message": "Not found"}}, 404)

    page.route("**/api/v3/**", api)
    page.goto(f"{BASE_URL}/login", wait_until="networkidle")
    page.locator("form").wait_for()
    console_errors.clear()  # Ignore only the expected initial /auth/me 401 resource message.
    page.locator("input[type='email']").fill(MANAGER["email"])
    page.locator("input[type='password']").fill("safe-browser-password")
    page.locator("form button[type='submit']").click()
    page.wait_for_url("**/dashboard")
    page.get_by_text(MANAGER["displayName"], exact=True).wait_for()
    page.locator("[data-testid='dashboard-progress-card']").wait_for()

    page.reload(wait_until="networkidle")
    page.wait_for_url("**/dashboard")
    page.get_by_text(MANAGER["displayName"], exact=True).wait_for()
    assert page.locator("a[href='/programs']").count() == 0
    assert page.locator("a[href='/assignments']").count() == 0
    assert sum(1 for method, url in requests if method == "POST" and url.endswith("/api/v3/auth/login")) == 1
    assert not any(method == "POST" and (url.endswith("/evaluation") or url.endswith("/coaching") or url.endswith("/messages")) for method, url in requests)
    assert not console_errors, console_errors

    page.close()
    browser.close()

print("Phase 10A-3 focused auth browser smoke: PASS")
