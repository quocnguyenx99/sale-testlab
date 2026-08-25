import json
import os
from copy import deepcopy
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE_URL = os.getenv("SALES_WEB_URL", "http://127.0.0.1:5173")
ARTIFACTS = Path("output/playwright/ui-redesign-v3/implementation/ui-v3-6")
ARTIFACTS.mkdir(parents=True, exist_ok=True)
NOW = "2026-08-21T09:00:00.000Z"
PERSONAS = [
    {
        "id": "program-persona-a",
        "displayName": "Khách hàng doanh nghiệp",
        "initials": "DN",
        "role": "Quản lý mua hàng",
        "customerType": "Doanh nghiệp",
        "difficulty": "MEDIUM",
        "summary": "Persona fixture an toàn.",
        "interests": ["tư vấn giải pháp"],
        "scenarioContext": "Tư vấn giải pháp doanh nghiệp.",
        "defaultScenario": {
            "id": "persona-program-persona-a",
            "title": "Tư vấn doanh nghiệp",
            "description": "Tình huống fixture an toàn.",
            "difficulty": "MEDIUM",
        },
        "color": "#2f6fed",
    },
    {
        "id": "program-persona-b",
        "displayName": "Khách hàng bán lẻ",
        "initials": "BL",
        "role": "Chủ cửa hàng",
        "customerType": "Bán lẻ",
        "difficulty": "EASY",
        "summary": "Persona fixture an toàn thứ hai.",
        "interests": ["sản phẩm mẫu"],
        "scenarioContext": "Tư vấn sản phẩm bán lẻ.",
        "defaultScenario": {
            "id": "persona-program-persona-b",
            "title": "Tư vấn bán lẻ",
            "description": "Tình huống fixture an toàn.",
            "difficulty": "EASY",
        },
        "color": "#0f766e",
    },
]


def fulfill(route, body, status=200):
    route.fulfill(status=status, content_type="application/json", body=json.dumps(body, ensure_ascii=False))


def public_user(role):
    return {
        "id": f"phase10b-{role.lower()}",
        "email": f"{role.lower()}@phase10b.test",
        "displayName": f"Phase 10B {role.title()}",
        "role": role,
    }


def program_item(raw, index):
    persona = next(persona for persona in PERSONAS if persona["id"] == raw["personaId"])
    return {
        "id": f"phase10b-item-{index + 1}",
        "personaId": raw["personaId"],
        "personaLabel": persona["displayName"],
        "scenarioId": raw["scenarioId"],
        "scenarioLabel": persona["defaultScenario"]["title"],
        "mode": raw["mode"],
        "sortOrder": raw["sortOrder"],
    }


def install_api(page, state, requests):
    def api(route):
        request = route.request
        method = request.method
        url = request.url
        path = url.split("/api/v3", 1)[-1].split("?", 1)[0]
        requests.append((method, path))

        if path == "/auth/me":
            if state["authenticated"]:
                return fulfill(route, {"user": public_user(state["role"])})
            return fulfill(route, {"error": {"code": "UNAUTHENTICATED", "message": "Authentication required"}}, 401)
        if path == "/auth/login" and method == "POST":
            state["authenticated"] = True
            return fulfill(route, {"user": public_user(state["role"])})
        if path == "/auth/logout" and method == "POST":
            state["authenticated"] = False
            return fulfill(route, {"ok": True})
        if path == "/progress":
            return fulfill(route, {"progress": {
                "evaluatorVersion": "testlab-evaluator-v1",
                "summary": {"totalSessions": 0, "completedSessions": 0, "evaluatedSessions": 0,
                            "averageOverallScore": None, "recentAverageScore": None,
                            "trainingFrequency": {"windowDays": 28, "completedSessions": 0, "averagePerWeek": 0}},
                "overallTrend": {"state": "INSUFFICIENT_DATA", "delta": None, "sampleCount": 0,
                                 "comparisonWindowSize": 0, "points": []},
                "skills": [], "highlights": {"strongestSkillKey": None, "needsAttentionSkillKey": None},
                "recentEvaluatedSessions": [],
            }})
        if path == "/sessions" and method == "GET":
            return fulfill(route, {"items": [], "page": 1, "pageSize": 10, "total": 0, "totalPages": 0})
        if path == "/personas" and method == "GET":
            return fulfill(route, {"personas": PERSONAS})

        if path == "/training-programs" and method == "GET":
            return fulfill(route, {"programs": list(state["programs"].values())})
        if path == "/training-programs" and method == "POST":
            raw = request.post_data_json
            program = {
                "id": "phase10b-program",
                "name": raw["name"].strip(),
                "description": raw.get("description"),
                "status": "DRAFT",
                "createdBy": {"id": state["user_id"], "displayName": public_user(state["role"])["displayName"]},
                "createdAt": NOW,
                "updatedAt": NOW,
                "items": [program_item(item, index) for index, item in enumerate(raw["items"])],
            }
            state["programs"][program["id"]] = program
            state["saved_payloads"].append(raw)
            return fulfill(route, {"program": program}, 201)

        if path.startswith("/training-programs/"):
            suffix = path.removeprefix("/training-programs/")
            parts = suffix.split("/")
            program_id = parts[0]
            program = state["programs"].get(program_id)
            if not program:
                return fulfill(route, {"error": {"code": "TRAINING_PROGRAM_NOT_FOUND", "message": "Not found"}}, 404)
            if len(parts) == 1 and method == "GET":
                return fulfill(route, {"program": program})
            if len(parts) == 1 and method == "PATCH":
                raw = request.post_data_json
                program.update({
                    "name": raw["name"].strip(),
                    "description": raw.get("description"),
                    "updatedAt": NOW,
                    "items": [program_item(item, index) for index, item in enumerate(raw["items"])],
                })
                state["saved_payloads"].append(raw)
                return fulfill(route, {"program": program})
            if len(parts) == 2 and parts[1] == "publish" and method == "POST":
                program["status"] = "PUBLISHED"
                return fulfill(route, {"program": program})
            if len(parts) == 2 and parts[1] == "archive" and method == "POST":
                program["status"] = "ARCHIVED"
                return fulfill(route, {"program": program})
            if len(parts) == 1 and method == "DELETE":
                del state["programs"][program_id]
                return fulfill(route, {"ok": True})

        return fulfill(route, {"error": {"code": "NOT_FOUND", "message": "Not found"}}, 404)

    page.route("**/api/v3/**", api)


def login(page, role):
    page.goto(f"{BASE_URL}/login", wait_until="networkidle")
    page.locator("input[type='email']").fill(public_user(role)["email"])
    page.locator("input[type='password']").fill("safe-browser-password")
    page.locator("form button[type='submit']").click()
    page.wait_for_url("**/dashboard")


def assert_zero_ai(requests):
    forbidden = ("/messages", "/evaluation", "/coaching")
    assert not any(method == "POST" and (path.endswith(forbidden) or path == "/sessions") for method, path in requests)


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)

    manager_page = browser.new_page(viewport={"width": 1280, "height": 900})
    manager_state = {"authenticated": False, "role": "MANAGER", "user_id": "phase10b-manager",
                     "programs": {}, "saved_payloads": []}
    manager_requests = []
    manager_errors = []
    manager_page.on("console", lambda message: manager_errors.append(message.text) if message.type == "error" else None)
    install_api(manager_page, manager_state, manager_requests)
    login(manager_page, "MANAGER")
    manager_errors.clear()
    manager_page.get_by_role("link", name="Chương trình", exact=True).click()
    manager_page.wait_for_url("**/training-programs")
    manager_page.get_by_role("heading", name="Chưa có chương trình đào tạo").wait_for()
    manager_page.get_by_role("button", name="Tạo chương trình đầu tiên").click()
    manager_page.wait_for_url("**/training-programs/new")
    manager_page.get_by_label("Tên chương trình").fill("Kỹ năng tư vấn nền tảng")
    manager_page.get_by_label("Mô tả").fill("Chương trình fixture Phase 10B")
    manager_page.get_by_role("button", name="Thêm nội dung").click()
    manager_page.get_by_role("button", name="Thêm nội dung").click()
    manager_page.get_by_label("Persona nội dung 2").select_option(PERSONAS[1]["id"])
    manager_page.get_by_label("Chế độ nội dung 2").select_option("CUSTOMER_FIRST")
    manager_page.get_by_label("Di chuyển nội dung 2 lên").click()
    manager_page.get_by_role("button", name="Lưu bản nháp").click()
    manager_page.wait_for_url("**/training-programs/phase10b-program")
    manager_page.get_by_text("Bản nháp", exact=True).wait_for()
    manager_page.screenshot(path=ARTIFACTS / "program-editor-1280.png", full_page=True)
    first_payload = manager_state["saved_payloads"][0]
    assert [item["personaId"] for item in first_payload["items"]] == [PERSONAS[1]["id"], PERSONAS[0]["id"]]
    assert [item["sortOrder"] for item in first_payload["items"]] == [1, 2]

    manager_page.get_by_label("Mô tả").fill("Bản nháp đã chỉnh sửa")
    manager_page.get_by_role("button", name="Lưu bản nháp").click()
    manager_page.get_by_role("button", name="Xuất bản").click()
    manager_page.get_by_text("Đã xuất bản", exact=True).wait_for()
    assert manager_page.get_by_label("Tên chương trình").is_disabled()
    assert manager_page.get_by_role("button", name="Lưu bản nháp").count() == 0
    manager_page.get_by_role("button", name="Lưu trữ").click()
    manager_page.get_by_text("Đã lưu trữ", exact=True).wait_for()
    assert manager_page.get_by_role("button", name="Lưu trữ").count() == 0
    manager_page.set_viewport_size({"width": 390, "height": 844})
    manager_page.reload(wait_until="networkidle")
    manager_page.get_by_text("Đã lưu trữ", exact=True).wait_for()
    manager_page.screenshot(path=ARTIFACTS / "program-editor-390.png", full_page=True)
    assert manager_page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
    assert not manager_errors, manager_errors
    assert_zero_ai(manager_requests)
    manager_page.close()

    seeded_program = deepcopy(manager_state["programs"]["phase10b-program"])
    admin_page = browser.new_page(viewport={"width": 768, "height": 1024})
    admin_state = {"authenticated": False, "role": "ADMIN", "user_id": "phase10b-admin",
                   "programs": {seeded_program["id"]: seeded_program}, "saved_payloads": []}
    admin_requests = []
    install_api(admin_page, admin_state, admin_requests)
    login(admin_page, "ADMIN")
    admin_page.locator("header button").click()
    admin_page.locator("aside").nth(1).get_by_role("link", name="Chương trình", exact=True).click()
    admin_page.wait_for_url("**/training-programs")
    admin_page.get_by_text(seeded_program["name"], exact=True).wait_for()
    admin_page.screenshot(path=ARTIFACTS / "program-list-768.png", full_page=True)
    admin_page.get_by_role("button", name="Xem chương trình").click()
    admin_page.wait_for_url("**/training-programs/phase10b-program")
    admin_page.get_by_text("Đã lưu trữ", exact=True).wait_for()
    assert admin_page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
    assert_zero_ai(admin_requests)
    admin_page.close()

    sale_page = browser.new_page(viewport={"width": 390, "height": 844})
    sale_state = {"authenticated": False, "role": "SALE", "user_id": "phase10b-sale",
                  "programs": {}, "saved_payloads": []}
    sale_requests = []
    install_api(sale_page, sale_state, sale_requests)
    login(sale_page, "SALE")
    sale_page.locator("header button").click()
    sale_drawer = sale_page.locator("aside").nth(1)
    assert sale_drawer.get_by_role("link", name="Chương trình", exact=True).count() == 0
    sale_page.goto(f"{BASE_URL}/training-programs", wait_until="networkidle")
    sale_page.get_by_role("heading", name="Bạn không có quyền truy cập").wait_for()
    assert sale_page.url.endswith("/training-programs")
    assert not any(path.startswith("/training-programs") for _, path in sale_requests)
    assert not any(method == "POST" and path == "/auth/logout" for method, path in sale_requests)
    assert sale_page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
    assert_zero_ai(sale_requests)
    sale_page.close()

    browser.close()

print("Phase 10B Training Programs browser acceptance: PASS")
