import json
import os
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright


BASE_URL = os.getenv("SALES_WEB_URL", "http://127.0.0.1:5173")
ARTIFACTS = Path("output/playwright/ui-redesign-v3/implementation/ui-v3-2")
ARTIFACTS.mkdir(parents=True, exist_ok=True)

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
    "totalXp": 180,
    "level": 1,
    "currentLevelXp": 180,
    "xpToNextLevel": 70,
    "currentStreakDays": 2,
    "bestStreakDays": 4,
    "currentMonth": {"xp": 180, "rank": 2, "creditedSessions": 2},
    "recentActivities": [],
}

ROLE_LABELS = {
    "SALE": "Nhân viên kinh doanh",
    "MANAGER": "Quản lý",
    "ADMIN": "Quản trị viên",
}

PERSONA = {
    "id": "ui-v3-persona",
    "displayName": "Khách hàng UI V3",
    "initials": "UV",
    "role": "Quản lý mua hàng",
    "customerType": "Doanh nghiệp",
    "difficulty": "MEDIUM",
    "summary": "Persona fixture an toàn dùng để kiểm tra dialog.",
    "interests": ["Quy trình", "Hiệu quả"],
    "scenarioContext": "Trao đổi về giải pháp phù hợp.",
    "defaultScenario": {
        "id": "ui-v3-scenario",
        "title": "Tư vấn giải pháp",
        "description": "Fixture không gọi Customer AI.",
        "difficulty": "MEDIUM",
    },
    "color": "#0068FF",
}


def fulfill(route, body, status=200):
    route.fulfill(status=status, content_type="application/json", body=json.dumps(body, ensure_ascii=False))


def fixture_user(role):
    return {
        "id": f"ui-v3-{role.lower()}",
        "email": f"{role.lower()}@ui-v3.test",
        "displayName": f"UI V3 {role.title()}",
        "role": role,
    }


def install_api(page, state, requests):
    def api(route):
        url = route.request.url
        method = route.request.method
        requests.append((method, url))
        if url.endswith("/api/v3/auth/me"):
            if state["authenticated"]:
                return fulfill(route, {"user": fixture_user(state["role"])})
            return fulfill(route, {"error": {"code": "UNAUTHENTICATED", "message": "Authentication required"}}, 401)
        if url.endswith("/api/v3/auth/login") and method == "POST":
            state["authenticated"] = True
            return fulfill(route, {"user": fixture_user(state["role"])})
        if url.endswith("/api/v3/auth/logout") and method == "POST":
            state["authenticated"] = False
            return fulfill(route, {"ok": True})
        if url.endswith("/api/v3/personas"):
            if state.get("personas_status") == 403:
                return fulfill(route, {"error": {"code": "FORBIDDEN", "message": "Safe fixture"}}, 403)
            return fulfill(route, {"personas": state.get("personas", [])})
        if url.endswith("/api/v3/progress"):
            return fulfill(route, {"progress": PROGRESS})
        if url.endswith("/api/v3/gamification/me"):
            return fulfill(route, {"gamification": GAMIFICATION})
        if "/api/v3/sessions" in url and method == "GET":
            return fulfill(route, {"sessions": [], "items": [], "page": 1, "pageSize": 10, "total": 0, "totalPages": 0})
        return fulfill(route, {"error": {"code": "NOT_FOUND", "message": "Not found"}}, 404)

    page.route("**/api/v3/**", api)


def assert_safe_requests(requests):
    forbidden_posts = [
        (method, url)
        for method, url in requests
        if method == "POST"
        and (
            url.endswith("/evaluation")
            or url.endswith("/coaching")
            or url.endswith("/messages")
            or url.endswith("/api/v3/sessions")
        )
    ]
    assert forbidden_posts == [], forbidden_posts


def assert_local_assets(requests):
    expected = urlparse(BASE_URL)
    external = []
    for _, url in requests:
        parsed = urlparse(url)
        if parsed.scheme in ("http", "https") and (parsed.hostname, parsed.port) != (expected.hostname, expected.port):
            external.append(url)
    assert external == [], external


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)

    for role in ("SALE", "MANAGER", "ADMIN"):
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        state = {"authenticated": False, "role": role}
        api_requests = []
        all_requests = []
        console_errors = []
        page.on("request", lambda request: all_requests.append((request.method, request.url)))
        page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
        install_api(page, state, api_requests)

        page.goto(f"{BASE_URL}/login", wait_until="networkidle")
        if role == "SALE":
            page.screenshot(path=ARTIFACTS / "login-1440.png", full_page=True)
            page.set_viewport_size({"width": 390, "height": 844})
            page.screenshot(path=ARTIFACTS / "login-390.png", full_page=True)
            assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
            page.set_viewport_size({"width": 1440, "height": 900})

        console_errors.clear()
        page.locator("input[type='email']").fill(fixture_user(role)["email"])
        page.locator("input[type='password']").fill("safe-browser-password")
        page.locator("form button[type='submit']").click()
        page.wait_for_url("**/dashboard")
        page.get_by_text(ROLE_LABELS[role], exact=True).wait_for()
        page.locator("[data-testid='dashboard-progress-card']").wait_for()

        sidebar = page.locator("aside").first
        assert 247 <= sidebar.bounding_box()["width"] <= 249
        assert page.get_by_role("link", name="Tổng quan").first.get_attribute("aria-current") == "page"
        assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
        page.screenshot(path=ARTIFACTS / f"{role.lower()}-dashboard-shell-1440.png", full_page=True)

        if role == "SALE":
            page.get_by_role("button", name="Thu gọn thanh điều hướng").click()
            page.wait_for_timeout(220)
            assert 71 <= sidebar.bounding_box()["width"] <= 73
            assert page.evaluate("localStorage.getItem('testlab-v3-sidebar-collapsed')") == "true"
            page.screenshot(path=ARTIFACTS / "collapsed-sidebar-1440.png", full_page=True)
            page.get_by_role("button", name="Mở rộng thanh điều hướng").click()
            page.wait_for_timeout(220)

            page.set_viewport_size({"width": 1024, "height": 768})
            page.wait_for_timeout(220)
            assert 71 <= sidebar.bounding_box()["width"] <= 73
            assert page.get_by_role("link", name="Tổng quan").first.is_visible()
            assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
            page.screenshot(path=ARTIFACTS / "collapsed-rail-1024.png", full_page=True)

            page.set_viewport_size({"width": 390, "height": 844})
            menu_button = page.get_by_role("button", name="Mở menu điều hướng")
            menu_button.click()
            drawer = page.get_by_role("complementary", name="Menu điều hướng")
            drawer.wait_for()
            assert page.evaluate("document.body.style.overflow") == "hidden"
            assert page.get_by_role("button", name="Đóng menu", exact=True).evaluate("node => node === document.activeElement")
            page.keyboard.press("Shift+Tab")
            assert drawer.evaluate("(node) => node.contains(document.activeElement)")
            page.screenshot(path=ARTIFACTS / "mobile-drawer-390.png", full_page=True)
            page.keyboard.press("Escape")
            drawer.wait_for(state="detached")
            assert menu_button.evaluate("node => node === document.activeElement")
            assert page.evaluate("document.body.style.overflow") == ""
            assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")

        assert_safe_requests(api_requests)
        assert_local_assets(all_requests)
        assert console_errors == [], console_errors
        page.close()

    forbidden_page = browser.new_page(viewport={"width": 1440, "height": 900})
    forbidden_state = {"authenticated": True, "role": "MANAGER", "personas_status": 403}
    forbidden_requests = []
    install_api(forbidden_page, forbidden_state, forbidden_requests)
    forbidden_page.goto(f"{BASE_URL}/customers", wait_until="networkidle")
    forbidden_page.get_by_role("heading", name="Bạn không có quyền truy cập").wait_for()
    forbidden_page.get_by_text(ROLE_LABELS["MANAGER"], exact=True).wait_for()
    forbidden_page.screenshot(path=ARTIFACTS / "forbidden-1440.png", full_page=True)
    assert forbidden_page.url.endswith("/customers")
    assert_safe_requests(forbidden_requests)
    forbidden_page.close()

    dialog_page = browser.new_page(viewport={"width": 1440, "height": 900})
    dialog_state = {"authenticated": True, "role": "SALE", "personas": [PERSONA]}
    dialog_requests = []
    install_api(dialog_page, dialog_state, dialog_requests)
    dialog_page.goto(f"{BASE_URL}/customers", wait_until="networkidle")
    dialog_trigger = dialog_page.get_by_role("button", name=f"Xem chi tiết {PERSONA['displayName']}")
    dialog_trigger.click()
    dialog = dialog_page.get_by_role("dialog", name="Chi tiết khách hàng")
    dialog.wait_for()
    assert dialog_page.evaluate("document.body.style.overflow") == "hidden"
    assert dialog_page.get_by_role("button", name="Đóng", exact=True).first.evaluate("node => node === document.activeElement")
    dialog_page.keyboard.press("Shift+Tab")
    assert dialog.evaluate("node => node.contains(document.activeElement)")
    dialog_page.keyboard.press("Escape")
    dialog.wait_for(state="detached")
    assert dialog_trigger.evaluate("node => node === document.activeElement")
    assert dialog_page.evaluate("document.body.style.overflow") == ""
    assert_safe_requests(dialog_requests)
    dialog_page.close()

    not_found_page = browser.new_page(viewport={"width": 390, "height": 844})
    not_found_state = {"authenticated": True, "role": "SALE"}
    not_found_requests = []
    install_api(not_found_page, not_found_state, not_found_requests)
    not_found_page.goto(f"{BASE_URL}/route-khong-ton-tai", wait_until="networkidle")
    not_found_page.get_by_role("heading", name="Không tìm thấy trang").wait_for()
    assert not_found_page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
    not_found_page.screenshot(path=ARTIFACTS / "not-found-390.png", full_page=True)
    assert_safe_requests(not_found_requests)
    not_found_page.close()

    browser.close()

print("UI-V3-2 responsive shell, accessibility, network, and screenshot acceptance: PASS")
