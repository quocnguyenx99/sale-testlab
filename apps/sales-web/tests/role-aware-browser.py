import json
import os
from playwright.sync_api import sync_playwright

BASE_URL = os.getenv("SALES_WEB_URL", "http://127.0.0.1:5173")
ROLE_LABELS = {
    "SALE": "Nhân viên kinh doanh",
    "MANAGER": "Quản lý",
    "ADMIN": "Quản trị viên",
}
EXPECTED_NAV = ["/dashboard", "/customers", "/practice/new", "/history", "/progress"]
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
    route.fulfill(status=status, content_type="application/json", body=json.dumps(body, ensure_ascii=False))


def user(role):
    return {
        "id": f"phase10a4-{role.lower()}",
        "email": f"{role.lower()}@example.test",
        "displayName": f"Phase 10A-4 {role.title()}",
        "role": role,
    }


def install_api(page, state, requests):
    def api(route):
        url = route.request.url
        method = route.request.method
        requests.append((method, url))
        if url.endswith("/api/v3/auth/me"):
            if state["authenticated"]:
                return fulfill(route, {"user": user(state["role"])})
            return fulfill(route, {"error": {"code": "UNAUTHENTICATED", "message": "Authentication required"}}, 401)
        if url.endswith("/api/v3/auth/login") and method == "POST":
            state["authenticated"] = True
            return fulfill(route, {"user": user(state["role"])})
        if url.endswith("/api/v3/auth/logout") and method == "POST":
            state["authenticated"] = False
            return fulfill(route, {"ok": True})
        if url.endswith("/api/v3/personas"):
            status = state.get("personas_status", 200)
            if status != 200:
                code = "UNAUTHENTICATED" if status == 401 else "FORBIDDEN"
                return fulfill(route, {"error": {"code": code, "message": "Safe authorization fixture"}}, status)
            return fulfill(route, {"personas": []})
        if "/api/v3/sessions" in url and method == "GET":
            return fulfill(route, {"sessions": [], "items": [], "page": 1, "pageSize": 10, "total": 0, "totalPages": 0})
        if url.endswith("/api/v3/progress"):
            return fulfill(route, {"progress": PROGRESS})
        return fulfill(route, {"error": {"code": "NOT_FOUND", "message": "Not found"}}, 404)

    page.route("**/api/v3/**", api)


def assert_no_ai_calls(requests):
    assert not any(
        method == "POST" and (
            url.endswith("/messages")
            or url.endswith("/evaluation")
            or url.endswith("/coaching")
            or url.endswith("/api/v3/sessions")
        )
        for method, url in requests
    )


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)

    for role, label in ROLE_LABELS.items():
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        state = {"authenticated": False, "role": role}
        requests = []
        console_errors = []
        page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
        install_api(page, state, requests)

        page.goto(f"{BASE_URL}/login", wait_until="networkidle")
        page.locator("form").wait_for()
        console_errors.clear()  # Expected initial /auth/me 401 is part of the login flow.
        page.locator("input[type='email']").fill(user(role)["email"])
        page.locator("input[type='password']").fill("safe-browser-password")
        page.locator("form button[type='submit']").click()
        page.wait_for_url("**/dashboard")
        page.get_by_text(label, exact=True).wait_for()
        page.locator("[data-testid='dashboard-progress-card']").wait_for()

        nav_paths = page.locator("aside nav a").evaluate_all("links => links.map(link => new URL(link.href).pathname)")
        assert nav_paths == EXPECTED_NAV, (role, nav_paths)
        assert page.locator("a[href='/programs']").count() == 0
        assert page.locator("a[href='/assignments']").count() == 0
        assert page.locator("a[href='/users']").count() == 0
        assert_no_ai_calls(requests)
        assert not console_errors, console_errors

        if role == "SALE":
            page.set_viewport_size({"width": 390, "height": 844})
            page.locator("header button").click()
            mobile_drawer = page.locator("aside").nth(1)
            mobile_drawer.get_by_text(label, exact=True).wait_for()
            assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")

        if role == "ADMIN":
            page.set_viewport_size({"width": 768, "height": 1024})
            page.locator("header button").click()
            tablet_drawer = page.locator("aside").nth(1)
            tablet_drawer.get_by_text(label, exact=True).wait_for()
            assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")

        if role == "MANAGER":
            state["role"] = "SALE"
            page.reload(wait_until="networkidle")
            page.get_by_text(ROLE_LABELS["SALE"], exact=True).wait_for()
            assert page.get_by_text(ROLE_LABELS["MANAGER"], exact=True).count() == 0

        page.close()

    forbidden_page = browser.new_page(viewport={"width": 1280, "height": 900})
    forbidden_state = {"authenticated": True, "role": "MANAGER", "personas_status": 403}
    forbidden_requests = []
    install_api(forbidden_page, forbidden_state, forbidden_requests)
    forbidden_page.goto(f"{BASE_URL}/customers", wait_until="networkidle")
    forbidden_page.get_by_role("heading", name="Bạn không có quyền truy cập").wait_for()
    forbidden_page.get_by_text(ROLE_LABELS["MANAGER"], exact=True).wait_for()
    assert forbidden_page.url.endswith("/customers")
    assert not any(method == "POST" and url.endswith("/api/v3/auth/logout") for method, url in forbidden_requests)
    forbidden_page.set_viewport_size({"width": 390, "height": 844})
    assert forbidden_page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
    forbidden_state["personas_status"] = 200
    forbidden_page.get_by_role("button", name="Về trang tổng quan").click()
    forbidden_page.wait_for_url("**/dashboard")
    assert_no_ai_calls(forbidden_requests)
    forbidden_page.close()

    unauthenticated_page = browser.new_page(viewport={"width": 1280, "height": 900})
    unauthenticated_state = {"authenticated": True, "role": "MANAGER", "personas_status": 401}
    unauthenticated_requests = []
    install_api(unauthenticated_page, unauthenticated_state, unauthenticated_requests)
    unauthenticated_page.goto(f"{BASE_URL}/customers", wait_until="networkidle")
    unauthenticated_page.wait_for_timeout(500)
    assert unauthenticated_page.url.endswith("/login"), (unauthenticated_page.url, unauthenticated_requests)
    unauthenticated_page.locator("form").wait_for()
    assert not any(method == "POST" and url.endswith("/api/v3/auth/logout") for method, url in unauthenticated_requests)
    assert_no_ai_calls(unauthenticated_requests)
    unauthenticated_page.close()

    browser.close()

print("Phase 10A-4 role-aware frontend browser acceptance: PASS")
