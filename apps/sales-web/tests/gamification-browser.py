import json
import os
from playwright.sync_api import sync_playwright

BASE_URL = os.getenv("SALES_WEB_URL", "http://127.0.0.1:5173")


def fulfill(route, body, status=200):
    route.fulfill(status=status, content_type="application/json", body=json.dumps(body, ensure_ascii=False))


def user(role):
    return {"id": f"phase12-{role.lower()}", "email": f"{role.lower()}@example.test", "displayName": f"Phase 12 {role.title()}", "role": role}


def progress():
    return {
        "evaluatorVersion": "testlab-evaluator-v1",
        "summary": {"totalSessions": 0, "completedSessions": 0, "evaluatedSessions": 0, "averageOverallScore": None, "recentAverageScore": None, "trainingFrequency": {"windowDays": 28, "completedSessions": 0, "averagePerWeek": 0}},
        "overallTrend": {"state": "INSUFFICIENT_DATA", "delta": None, "sampleCount": 0, "comparisonWindowSize": 0, "points": []},
        "skills": [], "highlights": {"strongestSkillKey": None, "needsAttentionSkillKey": None}, "recentEvaluatedSessions": [],
    }


def personal():
    return {
        "ruleVersion": "testlab-gamification-v1", "timezone": "Asia/Ho_Chi_Minh", "totalXp": 320,
        "level": 2, "currentLevelXp": 70, "xpToNextLevel": 180, "currentStreakDays": 2, "bestStreakDays": 5,
        "currentMonth": {"xp": 70, "rank": 2, "creditedSessions": 2},
        "recentActivities": [{"type": "SESSION_XP", "creditStatus": "AWARDED", "points": 35, "occurredAt": "2026-08-23T02:00:00.000Z"}],
    }


def leaderboard(role, empty=False):
    current = role == "SALE"
    rows = [
        {"rank": 1, "displayName": "Sale dẫn đầu", "level": 3, "currentMonthXp": 120, "creditedSessions": 3, "isCurrentUser": False},
        {"rank": 2, "displayName": "Phase 12 Sale", "level": 2, "currentMonthXp": 70, "creditedSessions": 2, "isCurrentUser": current},
    ]
    return {
        "period": {"type": "CURRENT_MONTH", "startAt": "2026-07-31T17:00:00.000Z", "endAt": "2026-08-31T17:00:00.000Z", "timezone": "Asia/Ho_Chi_Minh"},
        "rows": [] if empty else rows, "totalParticipants": 0 if empty else 2, "totalPages": 0 if empty else 2, "currentUser": None if empty else rows[1] if current else None, "page": 1, "pageSize": 25,
    }


def install_api(page, role, requests, gamification_status=200, empty_leaderboard=False):
    def api(route):
        method = route.request.method
        url = route.request.url
        requests.append((method, url))
        if url.endswith("/api/v3/auth/me"):
            return fulfill(route, {"user": user(role)})
        if url.endswith("/api/v3/personas"):
            return fulfill(route, {"personas": []})
        if "/api/v3/sessions" in url and method == "GET":
            return fulfill(route, {"sessions": [], "items": [], "page": 1, "pageSize": 10, "total": 0, "totalPages": 0})
        if url.endswith("/api/v3/progress"):
            return fulfill(route, {"progress": progress()})
        if url.endswith("/api/v3/gamification/me"):
            if gamification_status != 200:
                return fulfill(route, {"error": {"code": "GAMIFICATION_UNAVAILABLE", "message": "Safe unavailable fixture"}}, gamification_status)
            return fulfill(route, {"gamification": personal()})
        if "/api/v3/leaderboard" in url:
            return fulfill(route, {"leaderboard": leaderboard(role, empty_leaderboard)})
        return fulfill(route, {"error": {"code": "NOT_FOUND", "message": "Safe fixture miss"}}, 404)
    page.route("**/api/v3/**", api)


def assert_zero_ai(requests):
    forbidden = [
        (method, url) for method, url in requests
        if method == "POST" and (url.endswith("/messages") or url.endswith("/evaluation") or url.endswith("/coaching") or url.endswith("/api/v3/sessions"))
    ]
    assert forbidden == [], forbidden


def install_evaluation_to_xp_flow(page, requests, state):
    session_id = "phase12-qualifying-session"
    session = {
        "id": session_id,
        "persona": {"id": "phase12-persona", "displayName": "Khách hàng Phase 12", "role": "Người mua", "customerType": "Doanh nghiệp", "difficulty": "MEDIUM", "summary": "Safe fixture", "interests": [], "scenarioContext": "Safe fixture", "defaultScenario": {"id": "phase12-scenario", "title": "Tư vấn", "description": "Safe fixture", "difficulty": "MEDIUM"}},
        "scenario": {"id": "phase12-scenario", "title": "Tư vấn", "description": "Safe fixture", "difficulty": "MEDIUM"},
        "mode": "SALE_FIRST", "status": "COMPLETED", "createdAt": "2026-08-24T01:00:00.000Z", "completedAt": "2026-08-24T01:10:00.000Z",
        "messages": [
            {"id": "turn-1", "sender": "SALE", "content": "Chào anh", "createdAt": "2026-08-24T01:01:00.000Z"},
            {"id": "turn-2", "sender": "CUSTOMER", "content": "Tôi cần tư vấn", "createdAt": "2026-08-24T01:02:00.000Z"},
            {"id": "turn-3", "sender": "SALE", "content": "Anh ưu tiên điều gì?", "createdAt": "2026-08-24T01:03:00.000Z"},
            {"id": "turn-4", "sender": "CUSTOMER", "content": "Hiệu năng", "createdAt": "2026-08-24T01:04:00.000Z"},
            {"id": "turn-5", "sender": "SALE", "content": "Tôi đề xuất cấu hình phù hợp", "createdAt": "2026-08-24T01:05:00.000Z"},
        ],
        "runtimeInsight": None,
        "result": {"outcome": "completed", "trainingStatus": "completed", "turnCount": 5, "durationSeconds": 600, "resolvedTopics": [], "missingTopics": [], "signals": []},
    }
    evaluation = {
        "id": "phase12-evaluation", "evaluatorVersion": "testlab-evaluator-v1", "status": "COMPLETED", "overallScore": 75,
        "criteria": [{"key": "COMMUNICATION", "label": "Giao tiếp", "score": 75, "weight": 10, "effectiveWeight": 10, "source": "LLM", "applicability": "APPLICABLE", "summary": "Trao đổi rõ ràng.", "evidenceTurnSequences": [1]}],
        "strengths": ["Trao đổi rõ ràng."], "improvementAreas": ["Có thể làm rõ bước tiếp theo."], "evaluatedAt": "2026-08-24T01:11:00.000Z",
    }

    def api(route):
        method = route.request.method
        url = route.request.url
        requests.append((method, url))
        if url.endswith("/api/v3/auth/me"):
            return fulfill(route, {"user": user("SALE")})
        if url.endswith(f"/api/v3/sessions/{session_id}"):
            return fulfill(route, {"session": session})
        if url.endswith(f"/api/v3/sessions/{session_id}/evaluation"):
            if method == "POST":
                state["evaluated"] = True
            return fulfill(route, {"state": "COMPLETED", "evaluation": evaluation} if state["evaluated"] else {"state": "NOT_EVALUATED", "evaluation": None})
        if url.endswith(f"/api/v3/sessions/{session_id}/coaching"):
            return fulfill(route, {"state": "NOT_GENERATED" if state["evaluated"] else "LOCKED_NEEDS_EVALUATION", "coaching": None})
        if url.endswith("/api/v3/personas"):
            return fulfill(route, {"personas": []})
        if "/api/v3/sessions" in url and method == "GET":
            return fulfill(route, {"sessions": [], "items": [], "page": 1, "pageSize": 10, "total": 0, "totalPages": 0})
        if url.endswith("/api/v3/progress"):
            return fulfill(route, {"progress": progress()})
        if url.endswith("/api/v3/gamification/me"):
            profile = personal()
            profile.update({"totalXp": 30 if state["evaluated"] else 0, "currentLevelXp": 30 if state["evaluated"] else 0, "xpToNextLevel": 220 if state["evaluated"] else 250, "currentStreakDays": 1 if state["evaluated"] else 0, "currentMonth": {"xp": 30 if state["evaluated"] else 0, "rank": 1 if state["evaluated"] else None, "creditedSessions": 1 if state["evaluated"] else 0}})
            return fulfill(route, {"gamification": profile})
        if "/api/v3/leaderboard" in url:
            data = leaderboard("SALE", empty=not state["evaluated"])
            if state["evaluated"]:
                data.update({"rows": [{"rank": 1, "displayName": "Phase 12 Sale", "level": 1, "currentMonthXp": 30, "creditedSessions": 1, "isCurrentUser": True}], "totalParticipants": 1, "totalPages": 1, "currentUser": {"rank": 1, "displayName": "Phase 12 Sale", "level": 1, "currentMonthXp": 30, "creditedSessions": 1, "isCurrentUser": True}})
            return fulfill(route, {"leaderboard": data})
        return fulfill(route, {"error": {"code": "NOT_FOUND", "message": "Safe fixture miss"}}, 404)
    page.route("**/api/v3/**", api)


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    for role in ("SALE", "MANAGER", "ADMIN"):
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        requests = []
        errors = []
        page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
        install_api(page, role, requests)

        page.goto(f"{BASE_URL}/dashboard", wait_until="networkidle")
        page.locator("[data-testid='dashboard-gamification-card']").wait_for()
        page.locator("a[href='/leaderboard']").first.wait_for()
        if role == "SALE":
            page.get_by_text("Thành tích luyện tập", exact=True).wait_for()
            page.get_by_text("320", exact=True).wait_for()
            page.get_by_text("#2", exact=True).wait_for()
            assert sum(url.endswith("/api/v3/gamification/me") for method, url in requests if method == "GET") >= 1
        else:
            page.get_by_text("Bảng xếp hạng tháng", exact=True).wait_for()
            assert not any(url.endswith("/api/v3/gamification/me") for _, url in requests)

        page.goto(f"{BASE_URL}/leaderboard", wait_until="networkidle")
        page.get_by_role("heading", name="Bảng xếp hạng").wait_for()
        page.get_by_text("Sale dẫn đầu", exact=True).wait_for()
        page.get_by_text("120", exact=True).wait_for()
        assert page.get_by_text("peer@example.test").count() == 0
        assert page.get_by_text("overallScore").count() == 0
        assert page.get_by_role("button", name="Trao XP").count() == 0
        if role == "SALE":
            page.get_by_role("button", name="Trang sau").click()
            page.get_by_text("Trang 2/2", exact=True).wait_for()
            assert any("page=2" in url for method, url in requests if method == "GET" and "/api/v3/leaderboard" in url)
        assert_zero_ai(requests)
        assert errors == [], errors

        page.set_viewport_size({"width": 390, "height": 844})
        page.reload(wait_until="networkidle")
        page.get_by_text("Sale dẫn đầu", exact=True).wait_for()
        assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
        assert_zero_ai(requests)
        assert errors == [], errors
        page.close()

    failure_page = browser.new_page(viewport={"width": 1280, "height": 900})
    failure_requests = []
    install_api(failure_page, "SALE", failure_requests, gamification_status=503)
    failure_page.goto(f"{BASE_URL}/dashboard", wait_until="networkidle")
    failure_page.get_by_text("Chưa thể tải XP cá nhân lúc này.", exact=True).wait_for()
    failure_page.locator("[data-testid='dashboard-progress-card']").wait_for()
    assert_zero_ai(failure_requests)
    failure_page.close()

    empty_page = browser.new_page(viewport={"width": 390, "height": 844})
    empty_requests = []
    install_api(empty_page, "MANAGER", empty_requests, empty_leaderboard=True)
    empty_page.goto(f"{BASE_URL}/leaderboard", wait_until="networkidle")
    empty_page.get_by_text("Chưa có xếp hạng trong tháng này", exact=True).wait_for()
    assert empty_page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
    assert_zero_ai(empty_requests)
    empty_page.close()

    flow_page = browser.new_page(viewport={"width": 1280, "height": 900})
    flow_requests = []
    flow_state = {"evaluated": False}
    install_evaluation_to_xp_flow(flow_page, flow_requests, flow_state)
    flow_page.goto(f"{BASE_URL}/practice/phase12-qualifying-session/result", wait_until="networkidle")
    flow_page.get_by_role("button", name="Đánh giá phiên luyện tập").click()
    flow_page.get_by_text("75", exact=True).wait_for()
    assert sum(method == "POST" and url.endswith("/evaluation") for method, url in flow_requests) == 1
    flow_page.goto(f"{BASE_URL}/dashboard", wait_until="networkidle")
    flow_page.locator("[data-testid='dashboard-gamification-card']").get_by_text("30", exact=True).wait_for()
    flow_page.reload(wait_until="networkidle")
    assert sum(method == "POST" and url.endswith("/evaluation") for method, url in flow_requests) == 1
    flow_page.goto(f"{BASE_URL}/leaderboard", wait_until="networkidle")
    flow_page.get_by_text("30", exact=True).wait_for()
    assert not any(method == "POST" and (url.endswith("/messages") or url.endswith("/coaching") or url.endswith("/api/v3/sessions")) for method, url in flow_requests)
    flow_page.close()

    browser.close()

print("Phase 12 Gamification Dashboard/Leaderboard role/mobile browser acceptance: PASS")
