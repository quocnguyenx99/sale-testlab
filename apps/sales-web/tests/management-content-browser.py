import json
import os
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE_URL = os.getenv("SALES_WEB_URL", "http://127.0.0.1:5173")
ARTIFACTS = Path("output/playwright/ui-redesign-v3/implementation/ui-v3-6")
ARTIFACTS.mkdir(parents=True, exist_ok=True)
NOW = "2026-08-24T08:00:00.000Z"


def version(identifier, number, status):
    return {
        "id": identifier,
        "version": number,
        "status": status,
        "publishedAt": NOW if status == "PUBLISHED" else None,
        "updatedAt": NOW,
    }


PERSONAS = [
    {
        "id": "persona-doanh-nghiep",
        "origin": "MANAGED",
        "archivedAt": None,
        "latestPublished": version("pv-2", 2, "PUBLISHED"),
        "draft": None,
        "displayName": "Khách hàng doanh nghiệp",
        "linkedScenarioCount": 3,
        "hasUsableScenario": True,
        "updatedAt": NOW,
    },
    {
        "id": "persona-ban-le",
        "origin": "MANAGED",
        "archivedAt": None,
        "latestPublished": None,
        "draft": version("pv-3", 1, "DRAFT"),
        "displayName": "Chủ cửa hàng bán lẻ",
        "linkedScenarioCount": 0,
        "hasUsableScenario": False,
        "updatedAt": NOW,
    },
]

SCENARIOS = [
    {
        "id": "scenario-tu-van-doanh-nghiep",
        "origin": "MANAGED",
        "archivedAt": None,
        "latestPublished": version("sv-1", 3, "PUBLISHED"),
        "draft": None,
        "title": "Tư vấn giải pháp cho doanh nghiệp",
        "linkedPersonaCount": 2,
        "updatedAt": NOW,
    },
    {
        "id": "scenario-xu-ly-phan-doi",
        "origin": "MANAGED",
        "archivedAt": None,
        "latestPublished": None,
        "draft": version("sv-2", 1, "DRAFT"),
        "title": "Xử lý phản đối về giá",
        "linkedPersonaCount": 1,
        "updatedAt": NOW,
    },
]


def fulfill(route, body, status=200):
    route.fulfill(status=status, content_type="application/json", body=json.dumps(body, ensure_ascii=False))


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 900})
    requests = []
    console_errors = []
    page.on("request", lambda request: requests.append((request.method, request.url)))
    page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)

    def api(route):
        url = route.request.url
        if url.endswith("/api/v3/auth/me"):
            return fulfill(route, {"user": {"id": "ui-manager", "email": "manager@example.test", "displayName": "Quản lý nội dung", "role": "MANAGER"}})
        if url.endswith("/api/v3/manage/personas"):
            return fulfill(route, {"personas": PERSONAS})
        if url.endswith("/api/v3/manage/scenarios"):
            return fulfill(route, {"scenarios": SCENARIOS})
        return fulfill(route, {"error": {"code": "NOT_FOUND", "message": "Safe fixture miss"}}, 404)

    page.route("**/api/v3/**", api)
    page.goto(f"{BASE_URL}/manage/personas", wait_until="networkidle")
    page.get_by_role("heading", name="Quản lý Persona").wait_for()
    page.get_by_text("Khách hàng doanh nghiệp", exact=True).wait_for()
    page.get_by_text("Sẵn sàng luyện tập", exact=True).wait_for()
    page.screenshot(path=ARTIFACTS / "persona-management-1280.png", full_page=True)

    page.goto(f"{BASE_URL}/manage/scenarios", wait_until="networkidle")
    page.get_by_role("heading", name="Quản lý tình huống").wait_for()
    page.get_by_text("Tư vấn giải pháp cho doanh nghiệp", exact=True).wait_for()
    page.screenshot(path=ARTIFACTS / "scenario-management-1280.png", full_page=True)

    page.set_viewport_size({"width": 390, "height": 844})
    page.reload(wait_until="networkidle")
    page.get_by_text("Xử lý phản đối về giá", exact=True).wait_for()
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
    page.screenshot(path=ARTIFACTS / "scenario-management-390.png", full_page=True)

    assert not any(method == "POST" for method, _ in requests), requests
    assert console_errors == [], console_errors
    browser.close()

print("UI-V3-6 management content browser acceptance: PASS")
