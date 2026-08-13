import json
from pathlib import Path
from playwright.sync_api import sync_playwright

SESSION_ID = "phase7-browser-safe"
session = {
    "id": SESSION_ID,
    "persona": {"id": "safe-persona", "displayName": "Khách hàng mẫu", "initials": "HM", "role": "Quản lý mua hàng", "customerType": "Doanh nghiệp", "difficulty": "MEDIUM", "summary": "Fixture an toàn", "interests": ["laptop"], "scenarioContext": "Tư vấn thiết bị", "defaultScenario": {"id": "safe", "title": "Tư vấn", "description": "Fixture", "difficulty": "MEDIUM"}, "color": "#2f6fed"},
    "scenario": {"id": "safe", "title": "Tư vấn", "description": "Fixture", "difficulty": "MEDIUM"},
    "mode": "SALE_FIRST", "status": "COMPLETED", "createdAt": "2026-08-13T01:00:00.000Z", "completedAt": "2026-08-13T01:05:00.000Z",
    "messages": [], "runtimeInsight": None,
    "result": {"outcome": "quote_requested", "trainingStatus": "completed", "turnCount": 2, "durationSeconds": 300, "resolvedTopics": ["product_model", "price"], "missingTopics": ["delivery"], "signals": ["quote_request_signal"]}
}
evaluation = {
    "id": "evaluation-safe", "evaluatorVersion": "testlab-evaluator-v1", "status": "COMPLETED", "overallScore": 82,
    "criteria": [
        {"key": "TOPIC_COVERAGE", "label": "Độ bao phủ chủ đề", "score": 67, "weight": 25, "effectiveWeight": 25, "source": "DETERMINISTIC", "applicability": "APPLICABLE", "summary": "Đã giải quyết 2/3 chủ đề.", "evidenceTurnSequences": []},
        {"key": "COMMUNICATION", "label": "Giao tiếp", "score": 87, "weight": 10, "effectiveWeight": 10, "source": "LLM", "applicability": "APPLICABLE", "summary": "Trao đổi rõ ràng và phù hợp.", "evidenceTurnSequences": [1]},
        {"key": "OBJECTION_HANDLING", "label": "Xử lý băn khoăn", "score": None, "weight": 15, "effectiveWeight": 0, "source": "LLM", "applicability": "NOT_APPLICABLE", "summary": "Tiêu chí không phát sinh trong phiên này.", "evidenceTurnSequences": []}
    ],
    "strengths": ["Trao đổi rõ ràng và phù hợp."], "improvementAreas": ["Cần bao phủ thêm chủ đề giao hàng."], "evaluatedAt": "2026-08-13T02:00:00.000Z"
}

def fulfill(route, body, status=200):
    route.fulfill(status=status, content_type="application/json", body=json.dumps(body, ensure_ascii=False))

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 390, "height": 844})
    evaluation_created = {"value": False}

    def api(route):
        url = route.request.url
        if url.endswith("/api/v3/auth/me"):
            return fulfill(route, {"user": {"id": "safe-user", "email": "safe@example.test", "displayName": "Safe User", "role": "SALE"}})
        if url.endswith(f"/api/v3/sessions/{SESSION_ID}"):
            return fulfill(route, {"session": session})
        if url.endswith(f"/api/v3/sessions/{SESSION_ID}/evaluation"):
            if route.request.method == "POST": evaluation_created["value"] = True
            return fulfill(route, {"state": "COMPLETED", "evaluation": evaluation} if evaluation_created["value"] else {"state": "NOT_EVALUATED", "evaluation": None})
        return fulfill(route, {"error": {"code": "NOT_FOUND", "message": "Not found"}}, 404)

    page.route("**/api/v3/**", api)
    page.goto(f"http://localhost:5173/practice/{SESSION_ID}/result", wait_until="networkidle")
    page.get_by_role("button", name="Phân tích kết quả").wait_for()
    assert page.locator("text=82/100").count() == 0
    page.get_by_role("button", name="Phân tích kết quả").click()
    page.get_by_text("82", exact=True).wait_for()
    assert page.get_by_text("Kết quả phân tích", exact=True).is_visible()
    assert page.get_by_text("Không áp dụng", exact=True).is_visible()
    page.screenshot(path=str(Path.cwd() / "playground-phase7-evaluation.png"), full_page=True)
    browser.close()

print("Phase 7 deterministic browser acceptance passed")
