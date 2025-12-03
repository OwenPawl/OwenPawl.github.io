from playwright.sync_api import sync_playwright
import os
import json
import time
import http.server
import socketserver
import threading
import sys

# Start a simple HTTP server to serve the current directory
PORT = 8001
Handler = http.server.SimpleHTTPRequestHandler

def start_server():
    # Allow reuse of address to avoid "Address already in use" if we restart quickly
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print("serving at port", PORT)
        httpd.serve_forever()

# Start server in a separate thread
thread = threading.Thread(target=start_server)
thread.daemon = True
thread.start()

# Give the server a moment to start
time.sleep(2)

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()

    # Pre-populate localStorage before any script runs
    context.add_init_script("""
        localStorage.setItem('access_token', 'mock_token');
        localStorage.setItem('access_key', 'mock_key');
        localStorage.setItem('staff_id', '123');
        sessionStorage.setItem('token', 'mock_token');
    """)

    page = context.new_page()

    # Enable console logging
    page.on("console", lambda msg: print(f"PAGE LOG: {msg.text}"))
    page.on("pageerror", lambda err: print(f"PAGE ERROR: {err}"))

    # Load index.html via localhost
    page.goto(f"http://localhost:{PORT}/index.html")

    # Wait for the initial data fetch to fail/finish so it doesn't overwrite our mock data later
    try:
        page.wait_for_load_state("networkidle", timeout=5000)
    except:
        print("Network idle timeout, continuing...")

    # Inject mock data into sessionStorage (schedule)
    schedule = [
        [
            12345,
            "visit_123",
            "registered",
            "2023-10-27T10:00:00Z",
            "2023-10-27T10:30:00Z",
            "John Doe",
            "L1",
            False,
            5.5,
            "LEVEL 1 (BEGINNER)"
        ]
    ]
    schedule_json = json.dumps(schedule)

    # Click Attendance button to navigate
    print("Clicking Attendance button...")
    page.wait_for_selector("button[data-target='attendance']")
    page.locator("button[data-target='attendance']").click()

    # Wait for attendance.js to be loaded and updateTable to be defined
    print("Waiting for attendance.js to load...")
    try:
        page.wait_for_function("typeof window.updateTable === 'function'", timeout=5000)
        print("attendance.js loaded.")
    except Exception as e:
        print(f"Timed out waiting for attendance.js: {e}")
        page.screenshot(path="verification/attendance_load_fail.png")

    # Manually trigger the scheduleUpdated event
    print("Dispatching scheduleUpdated event...")
    page.evaluate(f"""
        sessionStorage.setItem('schedule', '{schedule_json}');
        window.dispatchEvent(new CustomEvent('scheduleUpdated', {{ detail: sessionStorage.getItem('schedule')}}));
    """)

    # Wait for the table to populate
    try:
        page.wait_for_selector("button[data-role='note']", timeout=5000)
        print("Table populated.")
    except Exception as e:
        print(f"Table failed to populate: {e}")
        page.screenshot(path="verification/attendance_view.png")
        # Continue

    # Take a screenshot of the attendance view
    page.screenshot(path="verification/attendance_view.png")

    # Click the "Notes" button
    print("Clicking Notes button...")
    page.locator("button[data-role='note']").click()

    # Verify we navigated to notes view
    print("Waiting for note view...")
    page.wait_for_selector("#noteTitle")

    # Verify student name is populated in title
    note_title = page.locator("#noteTitle").inner_text()
    print(f"Note Title: {note_title}")
    assert "John Doe" in note_title

    # Verify skills are populated
    page.wait_for_selector(".skill-item")
    skills_text = page.locator(".checklist-section").inner_text()
    print(f"Skills displayed: {skills_text}")
    assert "Pool safety" in skills_text

    # Test "Worked On" selection
    first_skill_checkbox = page.locator("input.worked-on").first
    first_skill_checkbox.check()

    # Test "Next Time" selection
    first_next_time_checkbox = page.locator("input.next-time").first
    first_next_time_checkbox.check()

    # Submit
    # Mock the fetch call for submission
    def handle_submit(route):
        headers = route.request.headers
        if headers.get("authorization") == "Bearer mock_key":
            print("Auth header correct.")
            route.fulfill(status=201, body='{"id": 999}')
        else:
            print(f"Auth header mismatch: {headers.get('authorization')}")
            route.fulfill(status=401, body='{"error": "Unauthorized"}')

    page.route("**/api/v2/desk/people/12345/notes", handle_submit)

    # Handle the alert
    page.on("dialog", lambda dialog: dialog.accept())

    print("Submitting note...")
    page.locator("#submitNote").click()

    page.wait_for_timeout(1000)

    print("Verification complete!")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
