import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE_URL = os.getenv("SALES_WEB_URL", "http://localhost:5173")
ARTIFACTS = Path("output/playwright/ui-redesign-v3/implementation/ui-v3-4")
ARTIFACTS.mkdir(parents=True, exist_ok=True)

USER = {"id": "result-user", "email": "sale@testlab.local", "displayName": "Nguyễn Văn A", "role": "SALE"}
PERSONA = {
    "id": "persona-res",
    "displayName": "Anh Quân",
    "initials": "AQ",
    "role": "Chủ tiệm bán lẻ",
    "customerType": "Cá nhân kinh doanh",
    "difficulty": "MEDIUM",
    "summary": "Thận trọng, quan tâm đến giá thành.",
    "interests": ["Báo giá", "Chiết khấu"],
    "scenarioContext": "Muốn tìm nhà cung cấp thiết bị tin cậy.",
    "defaultScenario": {
        "id": "sc-res",
        "title": "Tư vấn báo giá sỉ",
        "description": "Tham khảo giá nhập số lượng lớn.",
        "difficulty": "MEDIUM"
    },
    "color": "#4F46E5"
}

RESULT = {
    "outcome": "quote_requested",
    "trainingStatus": "completed",
    "turnCount": 4,
    "durationSeconds": 145,
    "resolvedTopics": ["budget_clarified", "product_model_selected"],
    "missingTopics": ["warranty_terms"],
    "signals": ["signal_price_sensitivity", "signal_timeline_urgent"]
}

SESSION_COMPLETED = {
    "session": {
        "id": "sess-res-1",
        "persona": PERSONA,
        "scenario": PERSONA["defaultScenario"],
        "mode": "CUSTOMER_FIRST",
        "status": "COMPLETED",
        "createdAt": "2026-08-20T08:00:00.000Z",
        "completedAt": "2026-08-20T08:02:25.000Z",
        "messages": [],
        "runtimeInsight": None,
        "result": RESULT
    }
}

EVALUATION_NOT_EVALUATED = {
    "state": "NOT_EVALUATED",
    "evaluation": None
}

EVALUATION_COMPLETED = {
    "state": "COMPLETED",
    "evaluation": {
        "id": "eval-1",
        "evaluatorVersion": "testlab-evaluator-v1",
        "status": "COMPLETED",
        "overallScore": 82,
        "criteria": [
            {
                "key": "TOPIC_COVERAGE",
                "label": "Độ bao phủ chủ đề",
                "score": 85,
                "weight": 0.2,
                "effectiveWeight": 0.2,
                "source": "DETERMINISTIC",
                "applicability": "APPLICABLE",
                "summary": "Khám phá được 2/3 chủ đề cốt lõi của khách hàng.",
                "evidenceTurnSequences": [1, 2]
            },
            {
                "key": "NEEDS_DISCOVERY",
                "label": "Khám phá nhu cầu",
                "score": 80,
                "weight": 0.25,
                "effectiveWeight": 0.25,
                "source": "LLM",
                "applicability": "APPLICABLE",
                "summary": "Đặt câu hỏi mở tốt về quy mô và ngân sách cửa hàng.",
                "evidenceTurnSequences": [2]
            },
            {
                "key": "CLOSING",
                "label": "Chốt thỏa thuận",
                "score": None,
                "weight": 0.15,
                "effectiveWeight": 0,
                "source": "LLM",
                "applicability": "NOT_APPLICABLE",
                "summary": "Khách hàng chưa chuyển sang giai đoạn chốt hợp đồng trong phiên này.",
                "evidenceTurnSequences": []
            }
        ],
        "strengths": [
            "Chào hỏi đúng bối cảnh và nắm bắt nhanh mối quan tâm về giá.",
            "Giới thiệu đúng model sản phẩm phù hợp với quy mô cửa hàng nhỏ."
        ],
        "improvementAreas": [
            "Cần chủ động giải thích chính sách bảo hành trước khi khách hỏi lại."
        ],
        "evaluatedAt": "2026-08-20T08:03:00.000Z"
    }
}

COACHING_NOT_GENERATED = {
    "state": "NOT_GENERATED",
    "coaching": None
}

COACHING_COMPLETED = {
    "state": "COMPLETED",
    "coaching": {
        "id": "coach-1",
        "evaluationId": "eval-1",
        "evaluatorVersion": "testlab-evaluator-v1",
        "coachVersion": "testlab-coach-v1",
        "status": "COMPLETED",
        "summary": "Bạn đã làm tốt phần nắm bắt nhu cầu thiết bị nhưng cần chủ động hơn ở điều khoản bảo hành.",
        "priorities": [
            {
                "criterionKey": "TOPIC_COVERAGE",
                "priorityKind": "IMPROVEMENT",
                "title": "Chủ động đề cập thời hạn và điều kiện bảo hành",
                "whyItMatters": "Khách hàng kinh doanh bán lẻ rất quan tâm đến độ bền và rủi ro gián đoạn thiết bị.",
                "observation": "Phiên kết thúc khi chưa làm rõ thời hạn bảo hành 12 tháng.",
                "recommendedAction": "Sau khi báo giá, hãy gắn kèm cam kết hỗ trợ kỹ thuật và bảo hành đổi mới.",
                "suggestedPhrasing": "Dạ máy in A100 bên em được bảo hành chính hãng 12 tháng và đổi mới trong 30 ngày nếu có lỗi kỹ thuật anh nhé.",
                "evidenceTurnSequences": [3]
            }
        ],
        "strengthReinforcement": {
            "criterionKey": "NEEDS_DISCOVERY",
            "message": "Kỹ năng lắng nghe và đồng cảm với ngân sách của chủ tiệm nhỏ rất tự nhiên."
        },
        "nextPracticeFocus": [
            "Thực hành xử lý phản đối về thời gian bảo hành",
            "Chủ động đưa ra cam kết chất lượng"
        ],
        "coachedAt": "2026-08-20T08:03:30.000Z"
    }
}

def fulfill(route, body, status=200):
    route.fulfill(status=status, content_type="application/json", body=json.dumps(body, ensure_ascii=False))

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    console_errors = []
    requests = []
    page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
    page.on("request", lambda req: requests.append((req.method, req.url)))

    def api(route):
        url = route.request.url
        method = route.request.method
        if url.endswith("/api/v3/auth/me"):
            return fulfill(route, {"user": USER})
        if url.endswith("/api/v3/sessions/sess-res-1/evaluation") and method == "POST":
            return fulfill(route, EVALUATION_COMPLETED, 200)
        if url.endswith("/api/v3/sessions/sess-res-1/evaluation") and method == "GET":
            return fulfill(route, EVALUATION_NOT_EVALUATED, 200)
        if url.endswith("/api/v3/sessions/sess-res-1/coaching") and method == "POST":
            return fulfill(route, COACHING_COMPLETED, 200)
        if url.endswith("/api/v3/sessions/sess-res-1/coaching") and method == "GET":
            return fulfill(route, COACHING_NOT_GENERATED, 200)
        if url.endswith("/api/v3/sessions/sess-res-1"):
            return fulfill(route, SESSION_COMPLETED)
        return fulfill(route, {"error": {"code": "NOT_FOUND", "message": "Not found"}}, 404)

    page.route("**/api/v3/**", api)

    # 1. Load Session Result page
    page.goto(f"{BASE_URL}/practice/sess-res-1/result", wait_until="networkidle")
    page.screenshot(path=ARTIFACTS / "result-before-evaluation-1440.png", full_page=True)
    page.get_by_role("heading", name="Tổng kết phiên luyện tập").wait_for()

    # Verify initial summary details
    assert page.get_by_text("Anh Quân").first.is_visible()
    assert page.get_by_text("4 lượt").is_visible()

    # 2. Check that Evaluation is NOT auto-posted
    assert not any(method == "POST" and url.endswith("/evaluation") for method, url in requests)

    # 3. Check Evaluation CTA button
    eval_btn = page.get_by_role("button", name="Đánh giá phiên luyện tập")
    assert eval_btn.is_visible()
    eval_btn.click()

    # Verify Evaluation results appear
    page.get_by_text("82").first.wait_for()
    assert page.get_by_text("Độ bao phủ chủ đề").is_visible()
    assert page.get_by_text("85/100").is_visible()
    assert page.get_by_text("Không áp dụng").is_visible()
    assert page.get_by_text("Điểm làm tốt").is_visible()
    assert page.get_by_text("Cần cải thiện").is_visible()

    # 4. Check Coaching CTA button
    coach_btn = page.get_by_role("button", name="Nhận gợi ý từ AI Coach")
    assert coach_btn.is_visible()

    # Check Coaching is NOT auto-posted
    assert not any(method == "POST" and url.endswith("/coaching") for method, url in requests)
    coach_btn.click()

    # Verify Coaching results appear
    page.get_by_text("Chủ động đề cập thời hạn và điều kiện bảo hành").wait_for()
    assert page.get_by_text("Dạ máy in A100 bên em được bảo hành chính hãng 12 tháng").is_visible()
    assert page.get_by_text("Tiếp tục duy trì").is_visible()
    assert page.get_by_text("Thực hành xử lý phản đối về thời gian bảo hành").is_visible()

    page.screenshot(path=ARTIFACTS / "result-evaluation-coach-1440.png", full_page=True)

    # 5. Check Navigation Actions
    assert page.get_by_role("button", name="Luyện tập lại").is_visible()
    assert page.get_by_role("button", name="Chọn khách hàng khác").is_visible()
    assert page.get_by_role("button", name="Về lịch sử").is_visible()
    assert page.get_by_role("button", name="Về trang chủ").is_visible()

    # 6. Test mobile viewport
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(f"{BASE_URL}/practice/sess-res-1/result", wait_until="networkidle")
    page.screenshot(path=ARTIFACTS / "result-390.png", full_page=True)
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")

    # Assert no console errors
    assert not console_errors, console_errors

    page.close()
    browser.close()

print("Phase UI-5 Session Result, Evaluation, and Coaching browser tests: PASS")
