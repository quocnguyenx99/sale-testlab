import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE_URL = os.getenv("SALES_WEB_URL", "http://localhost:5173")
ARTIFACTS = Path(__file__).parent.parent / "test-artifacts"

USER = {"id": "test-user", "email": "sale@testlab.local", "displayName": "Nguyễn Văn A", "role": "SALE"}
PERSONAS = [
    {
        "id": "persona-1",
        "displayName": "Anh Quân",
        "initials": "AQ",
        "role": "Chủ tiệm bán lẻ",
        "customerType": "Cá nhân kinh doanh",
        "difficulty": "MEDIUM",
        "summary": "Thận trọng, quan tâm đến giá thành và chiết khấu.",
        "interests": ["Giá cả", "Chính sách bảo hành", "Thời gian giao hàng"],
        "scenarioContext": "Khách hàng muốn mở rộng cửa hàng và tìm nguồn hàng ổn định.",
        "defaultScenario": {
            "id": "sc-1",
            "title": "Tư vấn báo giá sỉ",
            "description": "Khách hàng muốn tham khảo giá nhập số lượng lớn.",
            "difficulty": "MEDIUM"
        },
        "color": "#4F46E5"
    },
    {
        "id": "persona-2",
        "displayName": "Chị Mai",
        "initials": "CM",
        "role": "Trưởng phòng thu mua",
        "customerType": "Doanh nghiệp",
        "difficulty": "HARD",
        "summary": "Yêu cầu khắt khe về tiến độ và chứng chỉ chất lượng.",
        "interests": ["Chứng chỉ CO/CQ", "Điều khoản thanh toán"],
        "scenarioContext": "Công ty đang chuẩn bị dự án mới cần nhà cung cấp đạt chuẩn.",
        "defaultScenario": {
            "id": "sc-2",
            "title": "Thương thảo hợp đồng dự án",
            "description": "Đàm phán các điều khoản kỹ thuật và thanh toán.",
            "difficulty": "HARD"
        },
        "color": "#059669"
    }
]

SESSION_CREATED = {
    "session": {
        "id": "sess-new-123",
        "persona": PERSONAS[0],
        "scenario": PERSONAS[0]["defaultScenario"],
        "mode": "CUSTOMER_FIRST",
        "status": "RUNNING",
        "createdAt": "2026-08-19T10:00:00.000Z",
        "completedAt": None,
        "messages": [],
        "runtimeInsight": None
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
        if url.endswith("/api/v3/auth/me"):
            return fulfill(route, {"user": USER})
        if url.endswith("/api/v3/personas/persona-1"):
            return fulfill(route, {"persona": PERSONAS[0]})
        if url.endswith("/api/v3/personas/persona-2"):
            return fulfill(route, {"persona": PERSONAS[1]})
        if url.endswith("/api/v3/personas"):
            return fulfill(route, {"personas": PERSONAS})
        if url.endswith("/api/v3/sessions") and route.request.method == "POST":
            return fulfill(route, SESSION_CREATED, 201)
        if url.endswith("/api/v3/sessions/sess-new-123"):
            return fulfill(route, SESSION_CREATED)
        return fulfill(route, {"error": {"code": "NOT_FOUND", "message": "Not found"}}, 404)

    page.route("**/api/v3/**", api)

    # 1. Test /customers page
    page.goto(f"{BASE_URL}/customers", wait_until="networkidle")
    page.get_by_role("heading", name="Thư viện khách hàng AI").wait_for()
    assert page.get_by_text("Anh Quân").first.is_visible()
    assert page.get_by_text("Chị Mai").first.is_visible()

    # 2. Test search filter
    search_input = page.get_by_placeholder("Tìm theo tên, vai trò...")
    search_input.fill("Quân")
    assert page.get_by_text("Anh Quân").first.is_visible()
    assert not page.get_by_text("Chị Mai").first.is_visible()
    search_input.fill("")

    # 3. Test difficulty filter
    diff_select = page.get_by_label("Lọc độ khó")
    diff_select.select_option("HARD")
    assert page.get_by_text("Chị Mai").first.is_visible()
    assert not page.get_by_text("Anh Quân").first.is_visible()
    diff_select.select_option("ALL")

    # 4. Test Persona Detail modal
    view_btn = page.get_by_label("Xem chi tiết Anh Quân")
    view_btn.click()
    page.get_by_role("heading", name="Chi tiết khách hàng").wait_for()
    modal = page.get_by_label("Chi tiết khách hàng")
    assert modal.get_by_text("Thận trọng, quan tâm đến giá thành và chiết khấu.").is_visible()
    assert modal.get_by_text("Thời gian giao hàng").is_visible()
    page.keyboard.press("Escape")
    page.wait_for_timeout(200)

    # 5. Test Practice CTA navigation
    practice_btn = page.locator("div").filter(has_text="Anh Quân").get_by_role("button", name="Luyện tập").first
    practice_btn.click()
    page.wait_for_url("**/practice/new?personaId=persona-1")
    page.get_by_role("heading", name="Thiết lập phiên luyện tập").wait_for()
    assert page.get_by_text("Tư vấn báo giá sỉ").is_visible()

    # 6. Test Mode selection
    sale_first_btn = page.get_by_role("radio", name="Bạn chủ động mở lời")
    sale_first_btn.click()
    assert sale_first_btn.get_attribute("aria-checked") == "true"

    cust_first_btn = page.get_by_role("radio", name="Khách hàng mở lời")
    cust_first_btn.click()
    assert cust_first_btn.get_attribute("aria-checked") == "true"

    # 7. Test Start Session
    start_btn = page.get_by_role("button", name="Bắt đầu phiên luyện tập")
    start_btn.click()
    page.wait_for_url("**/practice/sess-new-123")

    # 8. Check responsive mobile viewport
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(f"{BASE_URL}/customers", wait_until="networkidle")
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")

    page.goto(f"{BASE_URL}/practice/new?personaId=persona-1", wait_until="networkidle")
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")

    # Assert no unexpected AI requests
    assert not any(method == "POST" and ("/evaluation" in url or "/coaching" in url) for method, url in requests)
    assert not console_errors, console_errors

    page.close()
    browser.close()

print("Phase UI-3 Persona and Practice Setup browser tests: PASS")
