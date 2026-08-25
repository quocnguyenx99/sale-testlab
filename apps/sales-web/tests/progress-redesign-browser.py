import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE_URL = os.getenv("SALES_WEB_URL", "http://localhost:5173")
ARTIFACTS = Path("output/playwright/ui-redesign-v3/implementation/ui-v3-5")
ARTIFACTS.mkdir(parents=True, exist_ok=True)

USER = {"id": "progress-user", "email": "sale@testlab.local", "displayName": "Nguyễn Văn A", "role": "SALE"}

PERSONA = {
    "id": "persona-prog",
    "displayName": "Anh Tuấn",
    "initials": "AT",
    "role": "Chủ chuỗi bán lẻ",
    "customerType": "Khách hàng B2B",
    "difficulty": "MEDIUM",
    "summary": "Thận trọng, quan tâm đến giá và công nợ.",
    "interests": ["Báo giá", "Công nợ 30 ngày"],
    "scenarioContext": "Muốn trang bị lô PC cho 5 chi nhánh.",
    "defaultScenario": {
        "id": "sc-prog",
        "title": "Tư vấn báo giá lô 5 chi nhánh",
        "description": "Thương lượng giá và công nợ.",
        "difficulty": "MEDIUM"
    },
    "color": "#1E3A8A"
}

PROGRESS_IMPROVING = {
    "progress": {
        "evaluatorVersion": "testlab-evaluator-v1",
        "summary": {
            "totalSessions": 8,
            "completedSessions": 6,
            "evaluatedSessions": 4,
            "averageOverallScore": 82.5,
            "recentAverageScore": 86.0,
            "trainingFrequency": {
                "windowDays": 28,
                "completedSessions": 6,
                "averagePerWeek": 1.5
            }
        },
        "overallTrend": {
            "state": "IMPROVING",
            "delta": 6.2,
            "sampleCount": 4,
            "comparisonWindowSize": 2,
            "points": [
                {"sessionId": "sess-1", "evaluatedAt": "2026-08-15T08:00:00.000Z", "score": 75},
                {"sessionId": "sess-2", "evaluatedAt": "2026-08-17T09:30:00.000Z", "score": 78},
                {"sessionId": "sess-3", "evaluatedAt": "2026-08-19T14:00:00.000Z", "score": 84},
                {"sessionId": "sess-4", "evaluatedAt": "2026-08-20T10:00:00.000Z", "score": 88}
            ]
        },
        "skills": [
            {
                "criterionKey": "TOPIC_COVERAGE",
                "label": "Độ bao phủ chủ đề",
                "averageScore": 88.0,
                "recentScore": 92.0,
                "sampleCount": 4,
                "trend": {
                    "state": "IMPROVING",
                    "delta": 4.0,
                    "sampleCount": 4,
                    "comparisonWindowSize": 2
                }
            },
            {
                "criterionKey": "NEEDS_DISCOVERY",
                "label": "Khám phá nhu cầu",
                "averageScore": 80.0,
                "recentScore": 85.0,
                "sampleCount": 4,
                "trend": {
                    "state": "IMPROVING",
                    "delta": 5.0,
                    "sampleCount": 4,
                    "comparisonWindowSize": 2
                }
            },
            {
                "criterionKey": "CLOSING",
                "label": "Chốt thỏa thuận",
                "averageScore": None,
                "recentScore": None,
                "sampleCount": 0,
                "trend": {
                    "state": "NO_DATA",
                    "delta": None,
                    "sampleCount": 0,
                    "comparisonWindowSize": 2
                }
            }
        ],
        "highlights": {
            "strongestSkillKey": "TOPIC_COVERAGE",
            "needsAttentionSkillKey": "NEEDS_DISCOVERY"
        },
        "recentEvaluatedSessions": [
            {
                "sessionId": "sess-4",
                "evaluatedAt": "2026-08-20T10:00:00.000Z",
                "persona": {"displayName": "Anh Tuấn"},
                "mode": "CUSTOMER_FIRST",
                "overallScore": 88
            },
            {
                "sessionId": "sess-3",
                "evaluatedAt": "2026-08-19T14:00:00.000Z",
                "persona": {"displayName": "Chị Lan"},
                "mode": "SALE_FIRST",
                "overallScore": 84
            }
        ]
    }
}

PROGRESS_EMPTY = {
    "progress": {
        "evaluatorVersion": "testlab-evaluator-v1",
        "summary": {
            "totalSessions": 0,
            "completedSessions": 0,
            "evaluatedSessions": 0,
            "averageOverallScore": None,
            "recentAverageScore": None,
            "trainingFrequency": {
                "windowDays": 28,
                "completedSessions": 0,
                "averagePerWeek": 0
            }
        },
        "overallTrend": {
            "state": "NO_DATA",
            "delta": None,
            "sampleCount": 0,
            "comparisonWindowSize": 2,
            "points": []
        },
        "skills": [],
        "highlights": {
            "strongestSkillKey": None,
            "needsAttentionSkillKey": None
        },
        "recentEvaluatedSessions": []
    }
}

PROGRESS_NO_EVALUATIONS = {
    "progress": {
        "evaluatorVersion": "testlab-evaluator-v1",
        "summary": {
            "totalSessions": 2,
            "completedSessions": 2,
            "evaluatedSessions": 0,
            "averageOverallScore": None,
            "recentAverageScore": None,
            "trainingFrequency": {
                "windowDays": 28,
                "completedSessions": 2,
                "averagePerWeek": 0.5
            }
        },
        "overallTrend": {
            "state": "NO_DATA",
            "delta": None,
            "sampleCount": 0,
            "comparisonWindowSize": 2,
            "points": []
        },
        "skills": [],
        "highlights": {
            "strongestSkillKey": None,
            "needsAttentionSkillKey": None
        },
        "recentEvaluatedSessions": []
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

    active_progress = PROGRESS_IMPROVING

    def api(route):
        url = route.request.url
        method = route.request.method
        if url.endswith("/api/v3/auth/me"):
            return fulfill(route, {"user": USER})
        if url.endswith("/api/v3/progress"):
            return fulfill(route, active_progress)
        return fulfill(route, {"error": {"code": "NOT_FOUND", "message": "Not found"}}, 404)

    page.route("**/api/v3/**", api)

    # 1. Test Improving progress on Desktop
    page.goto(f"{BASE_URL}/progress", wait_until="networkidle")
    page.get_by_role("heading", name="Tiến độ luyện tập").wait_for()

    # Summary metrics
    summary_sec = page.locator("section[aria-label='Tóm tắt tiến độ']")
    assert summary_sec.get_by_text("8", exact=True).is_visible()
    assert summary_sec.get_by_text("6", exact=True).is_visible()
    assert summary_sec.get_by_text("4", exact=True).is_visible()
    assert summary_sec.get_by_text("82,5", exact=True).is_visible()
    assert page.get_by_text("Gần đây: 86").is_visible()
    assert page.get_by_text("Tần suất luyện tập:").is_visible()
    assert page.get_by_text("6 phiên / 28 ngày").is_visible()

    # Trend Chart
    assert page.get_by_text("Đang cải thiện").first.is_visible()
    assert page.get_by_text("+6,2 điểm so với nhóm phiên trước").is_visible()
    assert page.locator("svg[role='img']").is_visible()

    # Skills
    assert page.get_by_role("heading", name="Độ bao phủ chủ đề").is_visible()
    assert page.get_by_role("heading", name="Khám phá nhu cầu").is_visible()
    assert page.get_by_role("heading", name="Chốt thỏa thuận").is_visible()
    assert page.get_by_text("Chưa có dữ liệu đánh giá áp dụng cho kỹ năng này.").is_visible()

    # Highlights
    assert page.get_by_role("heading", name="Điểm mạnh hiện tại").is_visible()
    assert page.get_by_role("heading", name="Cần chú ý").is_visible()

    # Recent Evaluated Sessions
    assert page.get_by_text("Anh Tuấn").first.is_visible()
    assert page.get_by_text("Chị Lan").first.is_visible()
    assert page.locator("td", has_text="88").is_visible()
    assert page.locator("td", has_text="84").is_visible()

    # Action navigation to result
    res_btn = page.get_by_role("button", name="Xem kết quả").first
    assert res_btn.is_visible()

    page.screenshot(path=ARTIFACTS / "progress-1280.png", full_page=True)

    # 2. Test Tablet Viewport
    page.set_viewport_size({"width": 768, "height": 1024})
    page.goto(f"{BASE_URL}/progress", wait_until="networkidle")
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")

    # 3. Test Mobile Viewport
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(f"{BASE_URL}/progress", wait_until="networkidle")
    page.screenshot(path=ARTIFACTS / "progress-390.png", full_page=True)
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
    assert page.get_by_role("heading", name="Tiến độ luyện tập").is_visible()
    assert page.locator("h3:visible", has_text="Anh Tuấn").is_visible()

    # 4. Test Zero Sessions (Empty State)
    active_progress = PROGRESS_EMPTY
    page.set_viewport_size({"width": 1280, "height": 900})
    page.goto(f"{BASE_URL}/progress", wait_until="networkidle")
    page.get_by_text("Bạn chưa có phiên luyện tập").wait_for()
    assert page.get_by_role("button", name="Bắt đầu luyện tập").is_visible()

    # 5. Test Sessions with No Evaluations
    active_progress = PROGRESS_NO_EVALUATIONS
    page.goto(f"{BASE_URL}/progress", wait_until="networkidle")
    page.get_by_role("heading", name="Chưa có phiên được đánh giá").wait_for()

    # 6. Verify zero unexpected POST/AI requests
    assert not any(method == "POST" for method, url in requests), [r for r in requests if r[0] == "POST"]
    assert not console_errors, console_errors

    page.close()
    browser.close()

print("Phase UI-7 Progress Analytics redesign browser tests: PASS")
