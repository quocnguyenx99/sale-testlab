import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE_URL = os.getenv("SALES_WEB_URL", "http://localhost:5173")
ARTIFACTS = Path(__file__).parent.parent / "test-artifacts"

USER = {"id": "chat-user", "email": "sale@testlab.local", "displayName": "Nguyễn Văn A", "role": "SALE"}
PERSONA = {
    "id": "persona-chat",
    "displayName": "Anh Quân",
    "initials": "AQ",
    "role": "Chủ tiệm bán lẻ",
    "customerType": "Cá nhân kinh doanh",
    "difficulty": "MEDIUM",
    "summary": "Thận trọng, quan tâm đến giá thành.",
    "interests": ["Báo giá", "Chiết khấu"],
    "scenarioContext": "Muốn tìm nhà cung cấp thiết bị tin cậy.",
    "defaultScenario": {
        "id": "sc-chat",
        "title": "Tư vấn báo giá sỉ",
        "description": "Tham khảo giá nhập số lượng lớn.",
        "difficulty": "MEDIUM"
    },
    "color": "#4F46E5"
}

INSIGHT = {
    "runtimeState": "EXPLORING_NEED",
    "resolvedTopics": ["budget_clarified"],
    "missingTopics": ["warranty_terms", "payment_schedule"],
    "nextUnresolvedTopic": "warranty_terms",
    "dealOutcome": "pending",
    "trainingStatus": "in_progress",
    "topicProgress": {"resolved": 1, "total": 3},
    "activeProduct": {"model": "Máy in mã vạch A100", "code": "PRN-A100"}
}

CUSTOMER_FIRST_SESSION = {
    "session": {
        "id": "sess-cf-1",
        "persona": PERSONA,
        "scenario": PERSONA["defaultScenario"],
        "mode": "CUSTOMER_FIRST",
        "status": "RUNNING",
        "createdAt": "2026-08-19T10:00:00.000Z",
        "completedAt": None,
        "messages": [
            {
                "id": "msg-1",
                "sender": "CUSTOMER",
                "content": "Chào em, bên em có những dòng máy in mã vạch nào giá tốt cho cửa hàng nhỏ không?",
                "createdAt": "2026-08-19T10:00:05.000Z"
            }
        ],
        "runtimeInsight": INSIGHT
    }
}

SALE_FIRST_SESSION = {
    "session": {
        "id": "sess-sf-1",
        "persona": PERSONA,
        "scenario": PERSONA["defaultScenario"],
        "mode": "SALE_FIRST",
        "status": "RUNNING",
        "createdAt": "2026-08-19T10:00:00.000Z",
        "completedAt": None,
        "messages": [],
        "runtimeInsight": INSIGHT
    }
}

SEND_RESPONSE = {
    "saleMessage": {
        "id": "msg-2",
        "sender": "SALE",
        "content": "Dạ em chào anh Quân, bên em có dòng A100 rất phù hợp quy mô cửa hàng của anh ạ.",
        "createdAt": "2026-08-19T10:00:15.000Z"
    },
    "customerMessage": {
        "id": "msg-3",
        "sender": "CUSTOMER",
        "content": "Dòng này in tem nhãn có sắc nét không em? Tốc độ in thế nào?",
        "createdAt": "2026-08-19T10:00:20.000Z"
    },
    "runtimeInsight": INSIGHT,
    "sessionStatus": "RUNNING"
}

STOP_RESPONSE = {
    "session": {
        "id": "sess-cf-1",
        "persona": PERSONA,
        "scenario": PERSONA["defaultScenario"],
        "mode": "CUSTOMER_FIRST",
        "status": "COMPLETED",
        "createdAt": "2026-08-19T10:00:00.000Z",
        "completedAt": "2026-08-19T10:02:00.000Z",
        "messages": CUSTOMER_FIRST_SESSION["session"]["messages"],
        "runtimeInsight": INSIGHT,
        "result": {
            "outcome": "quote_requested",
            "trainingStatus": "completed",
            "turnCount": 2,
            "durationSeconds": 120,
            "resolvedTopics": ["budget_clarified"],
            "missingTopics": ["warranty_terms"],
            "signals": ["signal_price_sensitivity"]
        }
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
        if url.endswith("/api/v3/sessions/sess-cf-1/messages") and method == "POST":
            return fulfill(route, SEND_RESPONSE, 200)
        if url.endswith("/api/v3/sessions/sess-cf-1/stop") and method == "POST":
            return fulfill(route, STOP_RESPONSE, 200)
        if url.endswith("/api/v3/sessions/sess-cf-1"):
            return fulfill(route, CUSTOMER_FIRST_SESSION)
        if url.endswith("/api/v3/sessions/sess-sf-1"):
            return fulfill(route, SALE_FIRST_SESSION)
        return fulfill(route, {"error": {"code": "NOT_FOUND", "message": "Not found"}}, 404)

    page.route("**/api/v3/**", api)

    # 1. Test CUSTOMER_FIRST session
    page.goto(f"{BASE_URL}/practice/sess-cf-1", wait_until="networkidle")
    page.get_by_text("Anh Quân").first.wait_for()
    assert page.get_by_text("Chào em, bên em có những dòng máy in mã vạch nào").is_visible()

    # 2. Test Runtime Insight drawer
    insight_btn = page.get_by_role("button", name="Thông tin phiên")
    insight_btn.click()
    page.get_by_role("dialog", name="Thông tin phiên").wait_for()
    drawer = page.get_by_role("dialog", name="Thông tin phiên")
    assert drawer.get_by_text("Máy in mã vạch A100").is_visible()
    drawer.get_by_label("Đóng").click()
    page.wait_for_timeout(200)

    # 3. Test sending message via composer
    composer = page.get_by_placeholder("Nhập tin nhắn cho khách hàng...")
    composer.fill("Dạ em chào anh Quân, bên em có dòng A100 rất phù hợp quy mô cửa hàng của anh ạ.")
    composer.press("Enter")

    # Verify both Sale and Customer response appear
    page.get_by_text("Dạ em chào anh Quân, bên em có dòng A100").wait_for()
    page.get_by_text("Dòng này in tem nhãn có sắc nét không em?").wait_for()

    # 4. Test Stop Session modal
    stop_btn = page.get_by_role("button", name="Kết thúc phiên")
    stop_btn.click()
    modal = page.get_by_role("dialog", name="Kết thúc phiên luyện tập?")
    modal.wait_for()
    modal_confirm_btn = modal.get_by_role("button", name="Kết thúc phiên")
    modal_confirm_btn.click()
    page.wait_for_url("**/practice/sess-cf-1/result")

    # 5. Test SALE_FIRST session
    page.goto(f"{BASE_URL}/practice/sess-sf-1", wait_until="networkidle")
    page.get_by_text("Bạn là người mở đầu").wait_for()

    # 6. Test mobile viewport
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(f"{BASE_URL}/practice/sess-cf-1", wait_until="networkidle")
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")

    # Verify no accidental evaluation/coaching calls
    assert not any(method == "POST" and ("/evaluation" in url or "/coaching" in url) for method, url in requests)
    assert not console_errors, console_errors

    page.close()
    browser.close()

print("Phase UI-4 Training Chat browser tests: PASS")
