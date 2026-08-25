import json
import os
from copy import deepcopy
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE_URL = os.getenv("SALES_WEB_URL", "http://127.0.0.1:5173")
ARTIFACTS = Path("output/playwright/ui-redesign-v3/implementation/ui-v3-6")
ARTIFACTS.mkdir(parents=True, exist_ok=True)
NOW = "2026-08-21T07:00:00.000Z"
USERS = {
    "SALE": {"id": "sale-a", "email": "sale-a@example.test", "displayName": "Nguyễn An", "role": "SALE"},
    "SALE_B": {"id": "sale-b", "email": "sale-b@example.test", "displayName": "Trần Bình", "role": "SALE"},
    "MANAGER": {"id": "manager-a", "email": "manager@example.test", "displayName": "Quản lý Minh", "role": "MANAGER"},
    "ADMIN": {"id": "admin-a", "email": "admin@example.test", "displayName": "Quản trị Anh", "role": "ADMIN"},
}
PERSONAS = {
    "persona-a": {"id": "persona-a", "displayName": "Khách hàng doanh nghiệp", "initials": "DN", "role": "Quản lý mua hàng", "customerType": "Doanh nghiệp", "difficulty": "MEDIUM", "summary": "Safe", "interests": ["solution"], "scenarioContext": "Safe", "defaultScenario": {"id": "persona-persona-a", "title": "Tư vấn doanh nghiệp", "description": "Safe", "difficulty": "MEDIUM"}, "color": "#2f6fed"},
    "persona-b": {"id": "persona-b", "displayName": "Khách hàng bán lẻ", "initials": "BL", "role": "Chủ cửa hàng", "customerType": "Bán lẻ", "difficulty": "EASY", "summary": "Safe", "interests": ["product"], "scenarioContext": "Safe", "defaultScenario": {"id": "persona-persona-b", "title": "Tư vấn bán lẻ", "description": "Safe", "difficulty": "EASY"}, "color": "#0f766e"},
}


def make_program(program_id, name):
    return {
        "id": program_id, "name": name, "description": f"Mô tả {name}", "status": "PUBLISHED",
        "createdBy": {"id": USERS["MANAGER"]["id"], "displayName": USERS["MANAGER"]["displayName"]},
        "createdAt": NOW, "updatedAt": NOW,
        "items": [
            {"id": f"{program_id}-item-1", "personaId": "persona-a", "personaLabel": PERSONAS["persona-a"]["displayName"], "scenarioId": "persona-persona-a", "scenarioLabel": "Tư vấn doanh nghiệp", "mode": "SALE_FIRST", "sortOrder": 1},
            {"id": f"{program_id}-item-2", "personaId": "persona-b", "personaLabel": PERSONAS["persona-b"]["displayName"], "scenarioId": "persona-persona-b", "scenarioLabel": "Tư vấn bán lẻ", "mode": "SALE_FIRST", "sortOrder": 2},
        ],
    }


PROGRAMS = {"program-a": make_program("program-a", "Program A"), "program-b": make_program("program-b", "Program B")}
STORE = {"assignments": {}, "sessions": {}, "sequence": 0}


def derive(assignment):
    completed = sum(item["state"] == "COMPLETED" for item in assignment["items"])
    if assignment.get("cancelledAt"):
        state = "CANCELLED"
    elif completed == len(assignment["items"]):
        state = "COMPLETED"
    elif any(item["state"] != "NOT_STARTED" for item in assignment["items"]):
        state = "IN_PROGRESS"
    else:
        state = "ASSIGNED"
    return state, completed


def public_assignment(assignment, own=False):
    state, completed = derive(assignment)
    result = {
        "id": assignment["id"],
        "program": {key: assignment["program"][key] for key in ["id", "name", "description", "status"]},
        "assignedAt": assignment["assignedAt"], "dueAt": assignment.get("dueAt"),
        "cancelledAt": assignment.get("cancelledAt"), "state": state, "isOverdue": False,
        "completedItems": completed, "totalItems": len(assignment["items"]),
        "progressPercent": round(completed / len(assignment["items"]) * 100),
        "items": [],
    }
    for item in assignment["items"]:
        safe = {key: item[key] for key in ["id", "sortOrder", "personaId", "personaLabel", "scenarioId", "scenarioLabel", "mode", "state"]}
        if own:
            safe["activeSessionId"] = item.get("activeSessionId")
        result["items"].append(safe)
    if not own:
        result["assignedTo"] = {key: assignment["assignedTo"][key] for key in ["id", "displayName", "email"]}
        result["assignedBy"] = {"id": assignment["assignedBy"]["id"], "displayName": assignment["assignedBy"]["displayName"]}
    return result


def create_assignment(program_id, sale_key, assigned_by_key, assignment_id=None, cancelled=False):
    STORE["sequence"] += 1
    program = PROGRAMS[program_id]
    value = {
        "id": assignment_id or f"assignment-{STORE['sequence']}", "program": deepcopy(program),
        "assignedTo": deepcopy(USERS[sale_key]), "assignedBy": deepcopy(USERS[assigned_by_key]),
        "assignedAt": NOW, "dueAt": "2026-08-30T23:59:59.999Z", "cancelledAt": NOW if cancelled else None,
        "items": [{**deepcopy(item), "state": "NOT_STARTED", "activeSessionId": None} for item in program["items"]],
    }
    STORE["assignments"][value["id"]] = value
    return value


def session_payload(session):
    persona = PERSONAS[session["personaId"]]
    completed = session["status"] == "COMPLETED"
    return {
        "id": session["id"], "persona": persona, "scenario": persona["defaultScenario"], "mode": session["mode"],
        "status": session["status"], "createdAt": NOW, "completedAt": NOW if completed else None, "messages": [],
        "runtimeInsight": None,
        **({"result": {"outcome": "completed", "trainingStatus": "completed", "turnCount": 0, "durationSeconds": 60, "resolvedTopics": [], "missingTopics": [], "signals": []}} if completed else {}),
    }


def fulfill(route, body, status=200):
    route.fulfill(status=status, content_type="application/json", body=json.dumps(body, ensure_ascii=False))


def install_api(page, role, requests):
    state = {"authenticated": False}

    def api(route):
        request = route.request
        method = request.method
        path = request.url.split("/api/v3", 1)[-1].split("?", 1)[0]
        requests.append((method, path, request.post_data or ""))
        current = USERS[role]
        if path == "/auth/me":
            return fulfill(route, {"user": current}) if state["authenticated"] else fulfill(route, {"error": {"code": "UNAUTHENTICATED", "message": "Authentication required"}}, 401)
        if path == "/auth/login" and method == "POST":
            state["authenticated"] = True
            return fulfill(route, {"user": current})
        if path == "/auth/logout" and method == "POST":
            state["authenticated"] = False
            return fulfill(route, {"ok": True})
        if path == "/sessions" and method == "GET":
            return fulfill(route, {"items": [], "sessions": [], "page": 1, "pageSize": 10, "total": 0, "totalPages": 0})
        if path == "/progress":
            return fulfill(route, {"progress": {"evaluatorVersion": "testlab-evaluator-v1", "summary": {"totalSessions": 0, "completedSessions": 0, "evaluatedSessions": 0, "averageOverallScore": None, "recentAverageScore": None, "trainingFrequency": {"windowDays": 28, "completedSessions": 0, "averagePerWeek": 0}}, "overallTrend": {"state": "INSUFFICIENT_DATA", "delta": None, "sampleCount": 0, "comparisonWindowSize": 0, "points": []}, "skills": [], "highlights": {"strongestSkillKey": None, "needsAttentionSkillKey": None}, "recentEvaluatedSessions": []}})
        if path == "/personas":
            return fulfill(route, {"personas": list(PERSONAS.values())})
        if path == "/training-programs" and method == "GET":
            return fulfill(route, {"programs": list(PROGRAMS.values())})
        if path == "/training-assignees" and method == "GET":
            return fulfill(route, {"assignees": [USERS["SALE"], USERS["SALE_B"]]})

        management = role in ["MANAGER", "ADMIN"]
        if path == "/training-assignments" and not management:
            return fulfill(route, {"error": {"code": "FORBIDDEN", "message": "Forbidden"}}, 403)
        if path == "/training-assignments" and method == "GET":
            return fulfill(route, {"assignments": [public_assignment(value) for value in STORE["assignments"].values()]})
        if path == "/training-assignments" and method == "POST":
            body = request.post_data_json
            sale_key = "SALE" if body["assignedToUserId"] == USERS["SALE"]["id"] else "SALE_B"
            program_id = body["programId"]
            assignment = create_assignment(program_id, sale_key, role)
            assignment["dueAt"] = body.get("dueAt")
            return fulfill(route, {"assignment": public_assignment(assignment)}, 201)
        if path.startswith("/training-assignments/"):
            parts = path.removeprefix("/training-assignments/").split("/")
            assignment = STORE["assignments"].get(parts[0])
            if not management:
                return fulfill(route, {"error": {"code": "FORBIDDEN", "message": "Forbidden"}}, 403)
            if not assignment:
                return fulfill(route, {"error": {"code": "TRAINING_ASSIGNMENT_NOT_FOUND", "message": "Not found"}}, 404)
            if len(parts) == 1 and method == "GET":
                return fulfill(route, {"assignment": public_assignment(assignment)})
            if len(parts) == 2 and parts[1] == "cancel" and method == "POST":
                assignment["cancelledAt"] = NOW
                return fulfill(route, {"assignment": public_assignment(assignment)})

        if path == "/my-training-assignments" and method == "GET":
            own = [value for value in STORE["assignments"].values() if value["assignedTo"]["id"] == current["id"]]
            return fulfill(route, {"assignments": [public_assignment(value, own=True) for value in own]})
        if path.startswith("/my-training-assignments/"):
            parts = path.removeprefix("/my-training-assignments/").split("/")
            assignment = STORE["assignments"].get(parts[0])
            if not assignment or assignment["assignedTo"]["id"] != current["id"]:
                return fulfill(route, {"error": {"code": "TRAINING_ASSIGNMENT_NOT_FOUND", "message": "Not found"}}, 404)
            if len(parts) == 1 and method == "GET":
                return fulfill(route, {"assignment": public_assignment(assignment, own=True)})
            if len(parts) == 4 and parts[1] == "items" and parts[3] == "start" and method == "POST":
                item = next(value for value in assignment["items"] if value["id"] == parts[2])
                STORE["sequence"] += 1
                session_id = f"assigned-session-{STORE['sequence']}"
                item["state"] = "IN_PROGRESS"; item["activeSessionId"] = session_id
                session = {"id": session_id, "ownerId": current["id"], "assignmentId": assignment["id"], "itemId": item["id"], "personaId": item["personaId"], "mode": item["mode"], "status": "RUNNING"}
                STORE["sessions"][session_id] = session
                return fulfill(route, {"session": session_payload(session)}, 201)

        if path.startswith("/sessions/"):
            parts = path.removeprefix("/sessions/").split("/")
            session = STORE["sessions"].get(parts[0])
            if not session or session["ownerId"] != current["id"]:
                return fulfill(route, {"error": {"code": "SESSION_NOT_FOUND", "message": "Not found"}}, 404)
            if len(parts) == 1 and method == "GET":
                return fulfill(route, {"session": session_payload(session)})
            if len(parts) == 2 and parts[1] == "stop" and method == "POST":
                session["status"] = "COMPLETED"
                assignment = STORE["assignments"][session["assignmentId"]]
                item = next(value for value in assignment["items"] if value["id"] == session["itemId"])
                item["state"] = "COMPLETED"; item["activeSessionId"] = None
                payload = session_payload(session)
                return fulfill(route, {"session": payload, "result": payload["result"]})
            if len(parts) == 2 and parts[1] == "evaluation" and method == "GET":
                return fulfill(route, {"state": "NOT_EVALUATED", "evaluation": None})
            if len(parts) == 2 and parts[1] == "coaching" and method == "GET":
                return fulfill(route, {"state": "LOCKED_NEEDS_EVALUATION", "coaching": None})
        return fulfill(route, {"error": {"code": "NOT_FOUND", "message": "Not found"}}, 404)

    page.route("**/api/v3/**", api)


def login(page, role):
    page.goto(f"{BASE_URL}/login", wait_until="networkidle")
    page.locator("input[type='email']").fill(USERS[role]["email"])
    page.locator("input[type='password']").fill("safe-password")
    page.locator("form button[type='submit']").click()
    page.wait_for_url("**/dashboard")


def complete_current_session(page):
    page.get_by_role("button", name="Kết thúc phiên").click()
    dialog = page.get_by_role("dialog", name="Kết thúc phiên luyện tập?")
    dialog.get_by_role("button", name="Kết thúc phiên").click()
    page.wait_for_url("**/result")


def assert_no_new_ai(requests):
    assert not any(method == "POST" and (path.endswith("/messages") or path.endswith("/evaluation") or path.endswith("/coaching")) for method, path, _ in requests)


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)

    manager = browser.new_page(viewport={"width": 1280, "height": 900})
    manager_requests = []
    install_api(manager, "MANAGER", manager_requests)
    login(manager, "MANAGER")
    manager.get_by_role("link", name="Phân công", exact=True).click()
    manager.get_by_role("heading", name="Chưa có phân công đào tạo").wait_for()
    manager.get_by_role("button", name="Tạo phân công đầu tiên").click()
    manager.get_by_label("Nhân viên SALE").select_option(USERS["SALE"]["id"])
    manager.get_by_label("Chương trình đã xuất bản").select_option("program-a")
    manager.get_by_label("Hạn hoàn thành").fill("2026-08-30")
    manager.get_by_role("button", name="Phân công chương trình").click()
    manager.wait_for_url("**/training-assignments/assignment-1")
    manager.get_by_text("0/2 nội dung", exact=True).wait_for()
    manager.screenshot(path=ARTIFACTS / "assignment-detail-1280.png", full_page=True)
    assert manager.get_by_text("hội thoại", exact=False).count() == 1
    assert manager.get_by_text("Tin nhắn", exact=False).count() == 0
    create_assignment("program-b", "SALE", "MANAGER", "cancel-fixture")
    manager.goto(f"{BASE_URL}/training-assignments", wait_until="networkidle")
    manager.once("dialog", lambda dialog: dialog.accept())
    manager.get_by_label("Hủy phân công Program B").click()
    manager.get_by_text("Đã hủy", exact=True).wait_for()
    manager.screenshot(path=ARTIFACTS / "assignment-list-1280.png", full_page=True)
    manager.set_viewport_size({"width": 390, "height": 844})
    manager.reload(wait_until="networkidle")
    manager.get_by_text("Đã hủy", exact=True).wait_for()
    manager.screenshot(path=ARTIFACTS / "assignment-list-390.png", full_page=True)
    overflow = manager.evaluate("""() => ({
        viewport: window.innerWidth,
        document: document.documentElement.scrollWidth,
        offenders: [...document.querySelectorAll('*')]
            .filter((element) => element.getBoundingClientRect().right > window.innerWidth + 1)
            .slice(0, 8)
            .map((element) => ({
                tag: element.tagName,
                text: element.textContent?.trim(),
                aria: element.getAttribute('aria-label'),
                rect: element.getBoundingClientRect().toJSON(),
                className: String(element.className)
            }))
    })""")
    assert overflow["document"] <= overflow["viewport"], overflow
    assert_no_new_ai(manager_requests)
    manager.close()

    sale = browser.new_page(viewport={"width": 1280, "height": 900})
    sale_requests = []
    install_api(sale, "SALE", sale_requests)
    login(sale, "SALE")
    assert sale.get_by_role("link", name="Phân công", exact=True).count() == 0
    sale.get_by_role("link", name="Bài tập được giao").click()
    sale.get_by_text("Program A", exact=True).wait_for()
    sale.get_by_role("button", name="Xem bài tập").first.click()
    sale.wait_for_url("**/my-training-assignments/assignment-1")
    sale.get_by_text("Khách hàng doanh nghiệp", exact=True).wait_for()
    assert sale.get_by_text("Khách hàng doanh nghiệp", exact=True).count() == 1
    assert sale.get_by_text("Khách hàng bán lẻ", exact=True).count() == 1
    sale.get_by_role("button", name="Bắt đầu luyện tập").first.click()
    sale.wait_for_url("**/practice/assigned-session-3")
    complete_current_session(sale)
    sale.goto(f"{BASE_URL}/my-training-assignments/assignment-1", wait_until="networkidle")
    sale.get_by_text("1/2 nội dung", exact=True).wait_for()
    sale.get_by_role("button", name="Bắt đầu luyện tập").click()
    sale.wait_for_url("**/practice/assigned-session-4")
    complete_current_session(sale)
    sale.goto(f"{BASE_URL}/my-training-assignments/assignment-1", wait_until="networkidle")
    sale.get_by_text("2/2 nội dung", exact=True).wait_for()
    sale.get_by_text("Hoàn thành", exact=True).first.wait_for()
    sale.set_viewport_size({"width": 390, "height": 844})
    assert sale.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
    start_posts = [body for method, path, body in sale_requests if method == "POST" and path.endswith("/start")]
    assert start_posts == ["{}", "{}"], start_posts
    assert_no_new_ai(sale_requests)
    sale.close()

    admin = browser.new_page(viewport={"width": 768, "height": 1024})
    admin_requests = []
    install_api(admin, "ADMIN", admin_requests)
    login(admin, "ADMIN")
    assert admin.get_by_role("link", name="Bài tập được giao").count() == 0
    admin.locator("header button").click()
    admin.locator("aside").nth(1).get_by_role("link", name="Phân công", exact=True).click()
    admin.get_by_role("button", name="Phân công chương trình").click()
    admin.get_by_label("Nhân viên SALE").select_option(USERS["SALE_B"]["id"])
    admin.get_by_label("Chương trình đã xuất bản").select_option("program-b")
    admin.get_by_role("button", name="Phân công chương trình").click()
    admin.wait_for_url("**/training-assignments/assignment-5")
    private_status = admin.evaluate("async () => (await fetch('/api/v3/sessions/assigned-session-3')).status")
    assert private_status == 404
    assert admin.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
    assert_no_new_ai(admin_requests)
    admin.close()

    browser.close()

print("Phase 10C Training Assignments browser acceptance: PASS")
