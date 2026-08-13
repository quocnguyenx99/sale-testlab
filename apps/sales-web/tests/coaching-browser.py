import json
from playwright.sync_api import sync_playwright

SESSION_ID = "phase8-browser-safe"
session = {"id": SESSION_ID, "persona": {"id": "safe", "displayName": "Khách hàng mẫu", "initials": "HM", "role": "Quản lý mua hàng", "customerType": "Doanh nghiệp", "difficulty": "MEDIUM", "summary": "Safe", "interests": [], "scenarioContext": "Safe", "defaultScenario": {"id": "safe", "title": "Safe", "description": "Safe", "difficulty": "MEDIUM"}, "color": "#2f6fed"}, "scenario": {"id": "safe", "title": "Safe", "description": "Safe", "difficulty": "MEDIUM"}, "mode": "SALE_FIRST", "status": "COMPLETED", "createdAt": "2026-08-13T01:00:00.000Z", "completedAt": "2026-08-13T02:00:00.000Z", "messages": [], "runtimeInsight": None, "result": {"outcome": "completed", "trainingStatus": "completed", "turnCount": 2, "durationSeconds": 60, "resolvedTopics": ["product_model"], "missingTopics": ["delivery"], "signals": []}}
evaluation = {"id": "eval-safe", "evaluatorVersion": "testlab-evaluator-v1", "status": "COMPLETED", "overallScore": 80, "criteria": [{"key": "COMMUNICATION", "label": "Giao tiếp", "score": 80, "weight": 10, "effectiveWeight": 100, "source": "LLM", "applicability": "APPLICABLE", "summary": "Trao đổi rõ ràng.", "evidenceTurnSequences": []}], "strengths": ["Trao đổi rõ ràng."], "improvementAreas": [], "evaluatedAt": "2026-08-13T02:00:00.000Z"}
coaching = {"id": "coach-safe", "evaluationId": "eval-safe", "evaluatorVersion": "testlab-evaluator-v1", "coachVersion": "testlab-coach-v1", "status": "COMPLETED", "summary": "Bạn đang làm tốt và có thể tinh chỉnh thêm cách xác nhận nhu cầu.", "priorities": [{"criterionKey": "COMMUNICATION", "priorityKind": "REFINEMENT", "title": "Tinh chỉnh phần xác nhận", "whyItMatters": "Giúp khách hàng cảm thấy được lắng nghe.", "observation": "Cách trao đổi hiện đã rõ ràng.", "recommendedAction": "Có thể nâng chất lượng hơn nữa bằng một câu tóm tắt ngắn.", "suggestedPhrasing": "Để em xác nhận lại nhu cầu chính của anh/chị nhé.", "evidenceTurnSequences": []}], "strengthReinforcement": None, "nextPracticeFocus": ["Tập tóm tắt nhu cầu bằng một câu ngắn."], "coachedAt": "2026-08-13T03:00:00.000Z"}

def fulfill(route, body, status=200): route.fulfill(status=status, content_type="application/json", body=json.dumps(body, ensure_ascii=False))

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    for width, height, name in [(1280, 900, "desktop"), (390, 844, "mobile")]:
        page = browser.new_page(viewport={"width": width, "height": height})
        generated = {"value": False}
        def api(route):
            url = route.request.url
            if url.endswith("/api/v3/auth/me"): return fulfill(route, {"user": {"id": "safe-user", "email": "safe@example.test", "displayName": "Safe", "role": "SALE"}})
            if url.endswith(f"/api/v3/sessions/{SESSION_ID}/evaluation"): return fulfill(route, {"state": "COMPLETED", "evaluation": evaluation})
            if url.endswith(f"/api/v3/sessions/{SESSION_ID}/coaching"):
                if route.request.method == "POST": generated["value"] = True
                return fulfill(route, {"state": "COMPLETED", "coaching": coaching} if generated["value"] else {"state": "NOT_GENERATED", "coaching": None})
            if url.endswith(f"/api/v3/sessions/{SESSION_ID}"): return fulfill(route, {"session": session})
            return fulfill(route, {"error": {"code": "NOT_FOUND", "message": "Not found"}}, 404)
        page.route("**/api/v3/**", api)
        page.goto(f"http://localhost:5173/practice/{SESSION_ID}/result", wait_until="networkidle")
        page.get_by_role("button", name="Nhận gợi ý từ AI Coach").wait_for()
        assert page.get_by_text("Tinh chỉnh phần xác nhận", exact=True).count() == 0
        page.get_by_role("button", name="Nhận gợi ý từ AI Coach").click()
        page.get_by_text("Tinh chỉnh phần xác nhận", exact=True).wait_for()
        assert page.get_by_text("Tinh chỉnh thêm", exact=True).is_visible()
        assert page.get_by_text("Cách diễn đạt gợi ý", exact=True).is_visible()
        assert page.get_by_text("Điểm yếu", exact=False).count() == 0
        assert page.screenshot(full_page=True)
        page.close()
    browser.close()
print("Phase 8 desktop/mobile coaching browser acceptance passed")
