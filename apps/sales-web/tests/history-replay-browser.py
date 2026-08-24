import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE_URL = os.getenv("SALES_WEB_URL", "http://localhost:5173")
ARTIFACTS = Path("output/playwright/ui-redesign-v3/implementation/ui-v3-5")
ARTIFACTS.mkdir(parents=True, exist_ok=True)

USER = {"id": "history-user", "email": "sale@testlab.local", "displayName": "Nguyễn Văn A", "role": "SALE"}

PERSONA_A = {
    "id": "persona-tuan",
    "displayName": "Anh Tuấn",
    "initials": "AT",
    "role": "Chủ chuỗi bán lẻ",
    "customerType": "Khách hàng B2B",
    "difficulty": "MEDIUM",
    "summary": "Thận trọng, quan tâm đến giá và công nợ.",
    "interests": ["Báo giá", "Công nợ 30 ngày"],
    "scenarioContext": "Muốn trang bị lô PC cho 5 chi nhánh.",
    "defaultScenario": {
        "id": "sc-tuan",
        "title": "Tư vấn báo giá lô 5 chi nhánh",
        "description": "Thương lượng giá và công nợ.",
        "difficulty": "MEDIUM"
    },
    "color": "#1E3A8A"
}

PERSONA_B = {
    "id": "persona-lan",
    "displayName": "Chị Lan",
    "initials": "CL",
    "role": "Trưởng phòng Mua hàng",
    "customerType": "Doanh nghiệp vừa",
    "difficulty": "HARD",
    "summary": "Khó tính, kiểm tra kỹ tiêu chuẩn kỹ thuật.",
    "interests": ["SLA", "Bảo hành 24T"],
    "scenarioContext": "Đấu thầu thiết bị tin học.",
    "defaultScenario": {
        "id": "sc-lan",
        "title": "Đàm phán tiêu chuẩn kỹ thuật",
        "description": "Kiểm tra kỹ thuật và điều khoản SLA.",
        "difficulty": "HARD"
    },
    "color": "#0F766E"
}

HISTORY_PAGE_1 = {
    "items": [
        {
            "id": "sess-comp-1",
            "persona": {
                "id": PERSONA_A["id"],
                "displayName": PERSONA_A["displayName"],
                "role": PERSONA_A["role"],
                "customerType": PERSONA_A["customerType"]
            },
            "mode": "CUSTOMER_FIRST",
            "status": "COMPLETED",
            "createdAt": "2026-08-20T08:00:00.000Z",
            "updatedAt": "2026-08-20T08:15:00.000Z",
            "completedAt": "2026-08-20T08:15:00.000Z",
            "turnCount": 6,
            "dealOutcome": "quote_requested",
            "trainingStatus": "completed"
        },
        {
            "id": "sess-run-1",
            "persona": {
                "id": PERSONA_B["id"],
                "displayName": PERSONA_B["displayName"],
                "role": PERSONA_B["role"],
                "customerType": PERSONA_B["customerType"]
            },
            "mode": "SALE_FIRST",
            "status": "RUNNING",
            "createdAt": "2026-08-20T09:00:00.000Z",
            "updatedAt": "2026-08-20T09:10:00.000Z",
            "completedAt": None,
            "turnCount": 3,
            "dealOutcome": None,
            "trainingStatus": "in_progress"
        }
    ],
    "page": 1,
    "pageSize": 10,
    "total": 12,
    "totalPages": 2
}

HISTORY_PAGE_2 = {
    "items": [
        {
            "id": "sess-comp-2",
            "persona": {
                "id": PERSONA_A["id"],
                "displayName": PERSONA_A["displayName"],
                "role": PERSONA_A["role"],
                "customerType": PERSONA_A["customerType"]
            },
            "mode": "CUSTOMER_FIRST",
            "status": "COMPLETED",
            "createdAt": "2026-08-19T14:00:00.000Z",
            "updatedAt": "2026-08-19T14:20:00.000Z",
            "completedAt": "2026-08-19T14:20:00.000Z",
            "turnCount": 4,
            "dealOutcome": "negotiating",
            "trainingStatus": "completed"
        }
    ],
    "page": 2,
    "pageSize": 10,
    "total": 12,
    "totalPages": 2
}

FILTERED_HISTORY = {
    "items": [HISTORY_PAGE_1["items"][0]],
    "page": 1,
    "pageSize": 10,
    "total": 1,
    "totalPages": 1
}

EMPTY_HISTORY = {
    "items": [],
    "page": 1,
    "pageSize": 10,
    "total": 0,
    "totalPages": 0
}

REPLAY_SESSION = {
    "session": {
        "id": "sess-comp-1",
        "persona": PERSONA_A,
        "scenario": PERSONA_A["defaultScenario"],
        "mode": "CUSTOMER_FIRST",
        "status": "COMPLETED",
        "createdAt": "2026-08-20T08:00:00.000Z",
        "completedAt": "2026-08-20T08:15:00.000Z",
        "messages": [
            {
                "id": "msg-1",
                "sender": "CUSTOMER",
                "content": "Chào em, anh đang tham khảo lô máy tính để bàn cho 5 chi nhánh mới.",
                "createdAt": "2026-08-20T08:00:05.000Z"
            },
            {
                "id": "msg-2",
                "sender": "SALE",
                "content": "Dạ em chào anh Tuấn! Bên em có chính sách chiết khấu bậc thang theo số lượng từ 10 bộ trở lên ạ.",
                "createdAt": "2026-08-20T08:01:10.000Z"
            },
            {
                "id": "msg-3",
                "sender": "CUSTOMER",
                "content": "Cấu hình văn phòng Core i5, RAM 16GB. Quan trọng là giá net và thanh toán công nợ 30 ngày thế nào?",
                "createdAt": "2026-08-20T08:02:15.000Z"
            }
        ],
        "runtimeInsight": {
            "runtimeState": "NEGOTIATING",
            "resolvedTopics": ["specs_confirmed", "quantity_confirmed"],
            "missingTopics": ["discount_agreed", "credit_terms"],
            "nextUnresolvedTopic": "discount_agreed",
            "dealOutcome": "quote_requested",
            "trainingStatus": "completed",
            "topicProgress": {"resolved": 2, "total": 4},
            "activeProduct": {"model": "Dell OptiPlex 7010 Micro", "code": "DELL-7010"}
        },
        "result": {
            "outcome": "quote_requested",
            "trainingStatus": "completed",
            "turnCount": 6,
            "durationSeconds": 900,
            "resolvedTopics": ["specs_confirmed", "quantity_confirmed"],
            "missingTopics": ["credit_terms"],
            "signals": ["signal_price_sensitivity"]
        }
    }
}

REPLAY_RUNNING_SESSION = {
    "session": {
        "id": "sess-run-1",
        "persona": PERSONA_B,
        "scenario": PERSONA_B["defaultScenario"],
        "mode": "SALE_FIRST",
        "status": "RUNNING",
        "createdAt": "2026-08-20T09:00:00.000Z",
        "completedAt": None,
        "messages": [],
        "runtimeInsight": None,
        "result": None
    }
}

def fulfill(route, body, status=200):
    route.fulfill(status=status, content_type="application/json", body=json.dumps(body, ensure_ascii=False))

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 900})
    console_errors = []
    requests = []
    page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
    page.on("request", lambda req: requests.append((req.method, req.url)))

    def api(route):
        url = route.request.url
        method = route.request.method
        if url.endswith("/api/v3/auth/me"):
            return fulfill(route, {"user": USER})
        if "/api/v3/sessions/sess-comp-1" in url:
            return fulfill(route, REPLAY_SESSION)
        if "/api/v3/sessions/sess-run-1" in url:
            return fulfill(route, REPLAY_RUNNING_SESSION)
        if "/api/v3/sessions" in url:
            if "search=nomatch" in url:
                return fulfill(route, EMPTY_HISTORY)
            if "status=COMPLETED" in url or "search=Tu%E1%BA%A5n" in url or "search=Tuan" in url:
                return fulfill(route, FILTERED_HISTORY)
            if "page=2" in url:
                return fulfill(route, HISTORY_PAGE_2)
            return fulfill(route, HISTORY_PAGE_1)
        return fulfill(route, {"error": {"code": "NOT_FOUND", "message": "Not found"}}, 404)

    page.route("**/api/v3/**", api)

    # 1. Test History Page initial load
    page.goto(f"{BASE_URL}/history", wait_until="networkidle")
    page.get_by_role("heading", name="Lịch sử luyện tập").wait_for()

    # Verify both session items are rendered
    assert page.get_by_text("Anh Tuấn").first.is_visible()
    assert page.get_by_text("Chị Lan").first.is_visible()
    assert page.locator("span", has_text="Đã hoàn thành").first.is_visible()
    assert page.locator("span", has_text="Đang hoạt động").first.is_visible()

    page.screenshot(path=ARTIFACTS / "history-1280.png", full_page=True)

    # 2. Test Pagination controls
    assert page.get_by_text("Trang 1 / 2").is_visible()
    next_btn = page.get_by_role("button", name="Sau")
    assert next_btn.is_enabled()
    next_btn.click()
    page.wait_for_timeout(300)
    assert page.get_by_text("Trang 2 / 2").is_visible()

    prev_btn = page.get_by_role("button", name="Trước")
    assert prev_btn.is_enabled()
    prev_btn.click()
    page.wait_for_timeout(300)
    assert page.get_by_text("Trang 1 / 2").is_visible()

    # 3. Test Keyword Search & Filter
    search_box = page.get_by_placeholder("Tìm theo tên khách hàng...")
    search_box.fill("Tuấn")
    page.get_by_role("button", name="Tìm kiếm").click()
    page.wait_for_timeout(300)
    assert page.get_by_text("Anh Tuấn").first.is_visible()

    # Test Clear Filters button
    clear_btn = page.get_by_role("button", name="Xóa bộ lọc").first
    assert clear_btn.is_visible()
    clear_btn.click()
    page.wait_for_timeout(300)

    # 4. Test Filter with No Match
    search_box.fill("nomatch")
    page.get_by_role("button", name="Tìm kiếm").click()
    page.wait_for_timeout(300)
    page.get_by_text("Không tìm thấy phiên phù hợp").wait_for()
    page.get_by_role("button", name="Xóa bộ lọc").first.click()
    page.wait_for_timeout(300)

    # 5. Test Mobile viewport on History Page
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(f"{BASE_URL}/history", wait_until="networkidle")
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
    assert page.locator("h3:visible", has_text="Anh Tuấn").is_visible()

    # 6. Test Replay Page (Desktop)
    page.set_viewport_size({"width": 1280, "height": 900})
    page.goto(f"{BASE_URL}/history/sess-comp-1", wait_until="networkidle")

    page.screenshot(path=ARTIFACTS / "replay-1280.png", full_page=True)

    # Verify Read-Only Banner
    page.get_by_text("Chế độ xem lại").wait_for()
    assert page.get_by_text("Phiên luyện tập đã kết thúc. Nội dung bên dưới được đọc trực tiếp").is_visible()

    # Verify Persona and Metadata Sidebar
    assert page.get_by_text("Anh Tuấn").first.is_visible()
    assert page.get_by_text("Tư vấn báo giá lô 5 chi nhánh").first.is_visible()
    assert page.get_by_text("Khách hàng B2B").first.is_visible()
    assert page.get_by_text("6 lượt").first.is_visible()

    # Verify Messages rendered chronologically
    assert page.get_by_text("Chào em, anh đang tham khảo lô máy tính để bàn").first.is_visible()
    assert page.get_by_text("Dạ em chào anh Tuấn! Bên em có chính sách chiết khấu").first.is_visible()
    assert page.get_by_text("Cấu hình văn phòng Core i5, RAM 16GB").first.is_visible()

    # Verify Speaker tags
    assert page.get_by_text("Khách hàng AI").first.is_visible()
    assert page.get_by_text("Bạn").first.is_visible()

    # Verify NO Composer or Input exists
    assert not page.get_by_placeholder("Nhập tin nhắn").is_visible()
    assert not page.locator("textarea").is_visible()

    # Verify Navigation to Result page
    result_btn = page.get_by_role("button", name="Xem kết quả").first
    assert result_btn.is_visible()

    # Verify Back to History navigation
    back_btn = page.get_by_role("button", name="Về lịch sử").first
    assert back_btn.is_visible()

    # 7. Test Running session Replay protection
    page.goto(f"{BASE_URL}/history/sess-run-1", wait_until="networkidle")
    page.get_by_text("Phiên vẫn đang hoạt động").wait_for()
    assert page.get_by_role("button", name="Tiếp tục luyện tập").is_visible()

    # 8. Test Mobile viewport on Replay Page
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(f"{BASE_URL}/history/sess-comp-1", wait_until="networkidle")
    page.screenshot(path=ARTIFACTS / "replay-390.png", full_page=True)
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")

    # 9. Verify that NO unexpected POST, AI, Evaluation or Coaching requests were made
    assert not any(method == "POST" for method, url in requests), [req for req in requests if req[0] == "POST"]
    assert not any("/evaluation" in url or "/coaching" in url for method, url in requests)
    assert not console_errors, console_errors

    page.close()
    browser.close()

print("Phase UI-6 History & Replay browser tests: PASS")
