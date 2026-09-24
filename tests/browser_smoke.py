"""Offline synthetic-fixture tests. Never logs into or calls live Greenhouse.
Run: uv run --with playwright==1.57.0 python tests/browser_smoke.py
"""
import json
import os
import shutil
import tempfile
import threading
import subprocess
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]

HTML = """<!doctype html><html><body>
<h1>Synthetic Candidate</h1><main><p>Fixture only. No real applicant data.</p>
<input id="notes" aria-label="Recruiter notes"><div id="editable" contenteditable="true">Note</div>
<a href="/people/101?job_application_id=202" aria-label="Next candidate">Next candidate</a>
</main></body></html>"""
GET_ALL = """async (store) => { const d=await new Promise((res,rej)=>{const r=indexedDB.open('cautious-review-private-v2');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});return new Promise((res,rej)=>{const r=d.transaction(store).objectStore(store).getAll();r.onsuccess=()=>{d.close();res(r.result)};r.onerror=()=>rej(r.error)})} """
class FixtureHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/html")
        self.end_headers()
        self.wfile.write(HTML.encode())
    def log_message(self, *_args):
        pass

server = ThreadingHTTPServer(("127.0.0.1", 0), FixtureHandler)
threading.Thread(target=server.serve_forever, daemon=True).start()
APP = f"http://127.0.0.1:{server.server_port}"
(ROOT/'artifacts').mkdir(exist_ok=True)
with sync_playwright() as p, tempfile.TemporaryDirectory() as profile, tempfile.TemporaryDirectory() as test_extension:
    shutil.copytree(ROOT/'dist', test_extension, dirs_exist_ok=True)
    subprocess.run(['node', str(ROOT/'scripts'/'localize-test.mjs'), test_extension, str(server.server_port)], check=True)
    args = [f"--disable-extensions-except={test_extension}", f"--load-extension={test_extension}", "--no-sandbox"]
    binary = os.environ.get("CHROME_BINARY") or shutil.which("chromium")
    options = {"executable_path": binary} if binary else {"channel": "chromium"}
    ctx = p.chromium.launch_persistent_context(profile, headless=True, args=args, **options)
    unexpected = []
    def route(r):
        if r.request.url.startswith(APP + "/"):
            r.fulfill(status=200, content_type="text/html", body=HTML)
        else:
            unexpected.append(r.request.url)
            r.abort()
    ctx.route("**/*", route)
    errors = []
    page = ctx.new_page()
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(APP + "/people/101?job_application_id=201")
    panel = page.locator("#cautious-review")
    panel.get_by_role("heading", name="Cautious Review").wait_for()
    worker = ctx.service_workers[0] if ctx.service_workers else ctx.wait_for_event("serviceworker")
    page.wait_for_function("document.querySelector('#cautious-review').shadowRoot.querySelector('#status').textContent.includes('Application 201')")
    def rows(store): return worker.evaluate(GET_ALL, store)
    def enabled():
        panel.locator("#enabled").check()
        page.locator("h1").click()
    assert rows('documents') == [] and rows('reviews') == [], 'Must not auto-scrape'
    page.locator('h1').click();page.keyboard.press('a');page.wait_for_timeout(100)
    assert rows('reviews') == [], 'Disabled shortcuts must do nothing'
    enabled()
    page.locator('#notes').fill('');page.locator('#notes').press('a')
    page.wait_for_timeout(100);assert rows('reviews') == [], 'Typing must not queue'
    page.locator('#editable').click();page.keyboard.press('r')
    page.wait_for_timeout(100);assert rows('reviews') == [], 'Contenteditable must not queue'
    page.locator('h1').click();page.keyboard.press('Control+a')
    page.wait_for_timeout(100);assert rows('reviews') == [], 'Modified shortcut must not queue'
    page.keyboard.press('Escape');page.locator('h1').click();page.keyboard.press('a')
    page.wait_for_function("document.querySelector('#cautious-review').shadowRoot.querySelector('#status').textContent.includes('ADVANCE queued')")
    assert rows('reviews')[0]['decision']=='advance'
    page.keyboard.press('1')
    page.wait_for_function("document.querySelector('#cautious-review').shadowRoot.querySelector('#status').textContent.includes('REJECT queued')")
    assert rows('reviews')[0]['decision']=='reject'
    page.keyboard.press('u')
    page.wait_for_function("document.querySelector('#cautious-review').shadowRoot.querySelector('#status').textContent.includes('restored')")
    assert rows('reviews')[0]['decision']=='advance', 'Undo must restore previous value'
    panel.locator('summary').click()
    panel.locator('#resume').fill('Owned Kubernetes and Terraform delivery. Literal <img src=x onerror=alert(1)> text.')
    panel.locator('#capture').click()
    page.wait_for_function("document.querySelector('#cautious-review').shadowRoot.querySelector('#status').textContent.includes('indexed locally')")
    assert len(rows('documents'))==1
    assert not any(d['name']=='cautious-review-private-v2' for d in page.evaluate('indexedDB.databases()')), 'DB must be extension-origin'
    panel.locator('#search').fill('Kubernetes Terraform')
    panel.locator('#results article').wait_for()
    assert '2/2 query terms' in panel.locator('#results').inner_text()
    assert panel.locator('#results img').count()==0, 'Evidence must be inert text'
    page.reload()
    panel.locator('#enabled').wait_for()
    assert not panel.locator('#enabled').is_checked(), 'Reload must require opt-in'
    assert len(rows('reviews'))==1, 'Decision survives reload'
    enabled();page.keyboard.press('j')
    page.wait_for_url('**job_application_id=202')
    page.wait_for_function("document.querySelector('#cautious-review').shadowRoot.querySelector('#status').textContent.includes('Application 202')")
    enabled();page.keyboard.press('m')
    page.wait_for_function("document.querySelector('#cautious-review').shadowRoot.querySelector('#status').textContent.includes('MAYBE queued')")
    assert len(rows('reviews'))==2, 'Same candidate/different application must not collide'
    panel.locator('#queue-list').click();page.wait_for_timeout(200)
    assert panel.locator('#results article').count()==2
    page.screenshot(path=str(ROOT/'artifacts'/'browser-preview.png'), full_page=True)
    page.on('dialog', lambda dialog: dialog.accept())
    panel.locator('#clear').click()
    page.wait_for_function("document.querySelector('#cautious-review').shadowRoot.querySelector('#status').textContent.includes('All local data cleared')")
    assert rows('documents')==[] and rows('reviews')==[] and rows('audit')==[]
    assert errors==[],errors
    assert unexpected==[],unexpected
    ctx.close()
    print(json.dumps({'status':'passed','checks':17,'network':'loopback fixture only; production host guard tested separately; no live Greenhouse or inference calls','browser': binary or 'Playwright Chromium'}, indent=2))
