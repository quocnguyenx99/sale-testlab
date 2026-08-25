import json
import os
from playwright.sync_api import sync_playwright

BASE_URL = os.getenv("SALES_WEB_URL", "http://127.0.0.1:5173")
ROLE_LABELS = {
    "SALE": "Nhân viên kinh doanh",
    "MANAGER": "Quản lý",
    "ADMIN": "Quản trị viên",
}
EXPECTED_NAV = {
    "SALE": [
        "/dashboard", "/customers", "/practice/new", "/my-training-assignments",
        "/history", "/progress", "/leaderboard",
    ],
    "MANAGER": [
        "/dashboard", "/customers", "/practice/new", "/history", "/progress", "/leaderboard",
        "/training-programs", "/training-assignments", "/manage/personas", "/manage/scenarios",
    ],
    "ADMIN": [
        "/dashboard", "/customers", "/practice/new", "/history", "/progress", "/leaderboard",
        "/training-programs", "/training-assignments", "/manage/personas", "/manage/scenarios",
    ],
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
GAMIFICATION = {
    "ruleVersion": "testlab-gamification-v1",
    "timezone": "Asia/Ho_Chi_Minh",
    "totalXp": 320,
    "level": 2,
    "currentLevelXp": 70,
    "xpToNextLevel": 180,
    "currentStreakDays": 2,
    "bestStreakDays": 5,
    "currentMonth": {"xp": 70, "rank": 2, "creditedSessions": 2},
    "recentActivities": [],
}
LEADERBOARD = {
    "period": {"type": "CURRENT_MONTH", "startAt": "2026-07-31T17:00:00.000Z", "endAt": "2026-08-31T17:00:00.000Z", "timezone": "Asia/Ho_Chi_Minh"},
    "rows": [
        {"rank": 1, "displayName": "Sale Fixture A", "level": 3, "currentMonthXp": 120, "creditedSessions": 3, "isCurrentUser": False},
        {"rank": 2, "displayName": "Phase 10A-4 Sale", "level": 2, "currentMonthXp": 70, "creditedSessions": 2, "isCurrentUser": True},
    ],
    "totalParticipants": 2,
    "totalPages": 1,
    "currentUser": {"rank": 2, "displayName": "Phase 10A-4 Sale", "level": 2, "currentMonthXp": 70, "creditedSessions": 2, "isCurrentUser": True},
    "page": 1,
    "pageSize": 25,
}
PERSONA = {
    "id": "phase10a5-persona",
    "displayName": "Khách hàng RBAC",
    "initials": "RB",
    "role": "Quản lý mua hàng",
    "customerType": "Doanh nghiệp",
    "difficulty": "MEDIUM",
    "summary": "Fixture an toàn cho role acceptance.",
    "interests": ["sản phẩm mẫu"],
    "scenarioContext": "Tư vấn sản phẩm mẫu.",
    "defaultScenario": {
        "id": "phase10a5-scenario",
        "title": "Tình huống RBAC",
        "description": "Fixture không gọi AI.",
        "difficulty": "MEDIUM",
    },
    "color": "#2f6fed",
}
RUNNING_SESSION = {
    "id": "phase10a5-running",
    "persona": PERSONA,
    "scenario": PERSONA["defaultScenario"],
    "mode": "SALE_FIRST",
    "status": "RUNNING",
    "createdAt": "2026-08-20T01:00:00.000Z",
    "completedAt": None,
    "messages": [],
    "runtimeInsight": None,
}
COMPLETED_SESSION = {
    **RUNNING_SESSION,
    "id": "phase10a5-completed",
    "status": "COMPLETED",
    "completedAt": "2026-08-20T01:05:00.000Z",
    "result": {
        "outcome": "completed",
        "trainingStatus": "completed",
        "turnCount": 0,
        "durationSeconds": 300,
        "resolvedTopics": [],
        "missingTopics": [],
        "signals": [],
    },
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
            return fulfill(route, {"personas": [PERSONA]})
        if url.endswith(f"/api/v3/personas/{PERSONA['id']}"):
            return fulfill(route, {"persona": PERSONA})
        if url.endswith("/api/v3/sessions/phase10a5-running") and method == "GET":
            return fulfill(route, {"session": RUNNING_SESSION})
        if url.endswith("/api/v3/sessions/phase10a5-completed") and method == "GET":
            return fulfill(route, {"session": COMPLETED_SESSION})
        if url.endswith("/api/v3/sessions/phase10a5-completed/evaluation") and method == "GET":
            return fulfill(route, {"state": "NOT_EVALUATED", "evaluation": None})
        if url.endswith("/api/v3/sessions/phase10a5-completed/coaching") and method == "GET":
            return fulfill(route, {"state": "LOCKED_NEEDS_EVALUATION", "coaching": None})
        if "/api/v3/sessions" in url and method == "GET":
            return fulfill(route, {"sessions": [], "items": [], "page": 1, "pageSize": 10, "total": 0, "totalPages": 0})
        if url.endswith("/api/v3/progress"):
            return fulfill(route, {"progress": PROGRESS})
        if url.endswith("/api/v3/gamification/me"):
            return fulfill(route, {"gamification": GAMIFICATION})
        if "/api/v3/leaderboard" in url:
            leaderboard = dict(LEADERBOARD)
            if state["role"] != "SALE":
                leaderboard["currentUser"] = None
                leaderboard["rows"] = [{**row, "isCurrentUser": False} for row in LEADERBOARD["rows"]]
            return fulfill(route, {"leaderboard": leaderboard})
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
        assert nav_paths == EXPECTED_NAV[role], (role, nav_paths)
        assert page.locator("a[href='/training-programs']").count() == (0 if role == "SALE" else 1)
        assert page.locator("a[href='/training-assignments']").count() == (0 if role == "SALE" else 1)
        assert page.locator("a[href='/my-training-assignments']").count() == (1 if role == "SALE" else 0)
        assert page.locator("a[href='/programs']").count() == 0
        assert page.locator("a[href='/assignments']").count() == 0
        assert page.locator("a[href='/users']").count() == 0
        assert_no_ai_calls(requests)
        assert not console_errors, console_errors

        own_training_routes = [
            ("/customers", "Thư viện khách hàng AI"),
            (f"/practice/new?personaId={PERSONA['id']}", "Thiết lập phiên luyện tập"),
            (f"/practice/{RUNNING_SESSION['id']}", PERSONA["displayName"]),
            (f"/practice/{COMPLETED_SESSION['id']}/result", "Tổng kết phiên luyện tập"),
            ("/history", "Lịch sử luyện tập"),
            ("/progress", "Tiến độ luyện tập"),
        ]
        for path, marker in own_training_routes:
            page.goto(f"{BASE_URL}{path}", wait_until="networkidle")
            page.get_by_text(marker, exact=True).first.wait_for()
            page.get_by_text(label, exact=True).wait_for()
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

        page.set_viewport_size({"width": 1280, "height": 900})
        page.get_by_role("button", name="Đăng xuất").first.click()
        page.wait_for_url("**/login")
        page.locator("form").wait_for()
        assert sum(method == "POST" and url.endswith("/api/v3/auth/logout") for method, url in requests) == 1
        assert_no_ai_calls(requests)

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
