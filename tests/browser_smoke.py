"""Offline synthetic fixtures. Never logs into or calls live Greenhouse.
Run with UV: uv run --with playwright==1.57.0 python tests/browser_smoke.py
"""
import hashlib
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
HTML = '''<!doctype html><html><body><h1>Synthetic Candidate</h1><main>
<p>Fixture only. No real applicant data.</p><input id="notes" aria-label="Recruiter notes">
<div id="editable" contenteditable="true">Note</div>
<a href="/people/101?job_application_id=202" aria-label="Next candidate">Next candidate</a>
</main></body></html>'''
GET_ALL = """async store => {const d=await new Promise((res,rej)=>{const r=indexedDB.open('cautious-review-private-v2');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});return new Promise((res,rej)=>{const r=d.transaction(store).objectStore(store).getAll();r.onsuccess=()=>{d.close();res(r.result)};r.onerror=()=>rej(r.error)})}"""
class FixtureHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200); self.send_header('Content-Type','text/html'); self.end_headers(); self.wfile.write(HTML.encode())
    def log_message(self, *_args): pass
server=ThreadingHTTPServer(('127.0.0.1',0),FixtureHandler)
threading.Thread(target=server.serve_forever,daemon=True).start()
APP=f'http://127.0.0.1:{server.server_port}'
(ROOT/'artifacts').mkdir(exist_ok=True)
with sync_playwright() as p, tempfile.TemporaryDirectory() as profile, tempfile.TemporaryDirectory() as extension:
    shutil.copytree(ROOT/'dist',extension,dirs_exist_ok=True)
    subprocess.run(['node',str(ROOT/'scripts/localize-test.mjs'),extension,str(server.server_port)],check=True)
    binary=os.environ.get('CHROME_BINARY') or shutil.which('chromium')
    options={'executable_path':binary} if binary else {'channel':'chromium'}
    ctx=p.chromium.launch_persistent_context(profile,headless=True,accept_downloads=True,viewport={'width':1280,'height':1100},args=[f'--disable-extensions-except={extension}',f'--load-extension={extension}','--no-sandbox'],**options)
    unexpected=[];errors=[]; checks=[]
    def route(r):
        if r.request.url.startswith(APP+'/'): r.fulfill(status=200,content_type='text/html',body=HTML)
        else: unexpected.append(r.request.url); r.abort()
    ctx.route('**/*',route)
    page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(APP+'/people/101?job_application_id=201')
    panel=page.locator('#cautious-review')
    panel.get_by_role('heading',name='Cautious Review').wait_for()
    worker=ctx.service_workers[0] if ctx.service_workers else ctx.wait_for_event('serviceworker')
    def status(s): page.wait_for_function("s=>document.querySelector('#cautious-review').shadowRoot.querySelector('#status').textContent.includes(s)",arg=s)
    def rows(store): return worker.evaluate(GET_ALL,store)
    def check(condition,name):
        assert condition,name
        checks.append(name)
    def enable(): panel.locator('#enabled').check();page.locator('h1').click()
    status('Application 201')
    check(rows('documents')==[] and rows('reviews')==[],'No automatic scraping')
    page.locator('h1').click();page.keyboard.press('a');page.wait_for_timeout(100)
    check(rows('reviews')==[],'Shortcuts disabled initially')
    enable();page.locator('#notes').fill('');page.locator('#notes').press('Alt+a');page.wait_for_timeout(100)
    check(rows('reviews')==[],'Typing in input is safe')
    page.locator('#editable').click();page.keyboard.press('Alt+r');page.wait_for_timeout(100)
    check(rows('reviews')==[],'Contenteditable is safe')
    page.locator('h1').click();page.keyboard.press('Control+a');page.wait_for_timeout(100)
    check(rows('reviews')==[],'Non-Alt modified keys are safe')
    page.locator('h1').click()
    for key in ['r','m','1','ArrowRight','ArrowLeft']:
        page.keyboard.press(key);page.wait_for_timeout(50)
    check(rows('reviews')==[],'Greenhouse native unmodified shortcuts are not shadowed')
    page.keyboard.press('Alt+a');status('ADVANCE queued')
    check(rows('reviews')[0]['decision']=='advance','Alt+A queues advance locally')
    page.keyboard.press('Alt+1');status('REJECT queued');check(rows('reviews')[0]['decision']=='reject','Alt+reason shortcut works')
    page.keyboard.press('Alt+u');status('restored');check(rows('reviews')[0]['decision']=='advance','Alt+U restores prior decision')
    panel.get_by_text('Index résumé text locally',exact=True).click()
    resume='Owned Kubernetes and Terraform delivery. Literal <img src=x onerror=alert(1)> text.'
    panel.locator('#resume').fill(resume);panel.locator('#capture').click();status('indexed locally')
    check(len(rows('documents'))==1,'Manual indexing persists')
    check(not any(d['name']=='cautious-review-private-v2' for d in page.evaluate('indexedDB.databases()')),'IndexedDB is extension-origin')
    panel.locator('#search').fill('Kubernetes Terraform');panel.locator('#results article').wait_for()
    check('2/2 query terms' in panel.locator('#results').inner_text(),'Search shows coverage')
    check(panel.locator('#results img').count()==0,'Applicant HTML remains inert')
    panel.get_by_text('Evidence, clean reading & bulk import',exact=True).click()
    panel.locator('#cr-criteria').fill('Kubernetes\nPython');panel.locator('#cr-analyze').click();status('Evidence ready')
    check('Self-reported work claim' in panel.locator('#cr-evidence').inner_text(),'Work claims distinguished from proof')
    check('Not established in this text' in panel.locator('#cr-evidence').inner_text(),'Missing criterion remains unknown')
    with page.expect_download() as dl: panel.locator('#cr-report').click()
    report=json.loads(Path(dl.value.path()).read_text())
    check(report['sourceSha256']==hashlib.sha256(resume.encode()).hexdigest(),'Evidence report hashes exact source')
    check(report['criteria'][0]['passages'][0]['quote'] in resume,'Evidence report quotes source')
    panel.locator('#cr-clean').click();status('Normalized reading view')
    check(panel.locator('#cr-evidence pre').inner_text()==resume,'Clean reading preserves text')
    panel.get_by_text('Import résumé text in bulk',exact=True).click()
    batch=[{'url':APP+'/applications/301','name':'Synthetic EKS','text':'Built EKS clusters and Terraform modules.'},{'url':APP+'/applications/302','name':'Synthetic Python','text':'Implemented Python processing systems.'}]
    import_file=Path(profile)/'synthetic.json';import_file.write_text(json.dumps(batch))
    panel.locator('#cr-import').set_input_files(str(import_file));status('Imported 2')
    check(len(rows('documents'))==3,'Bulk import persisted all records')
    check(len(rows('reviews'))==1,'Import did not queue decisions')
    bad=[{'url':APP+'/applications/303','text':'This should never be committed.'},{'url':'https://evil.test/applications/304','text':'Invalid origin in batch.'}]
    invalid_file=Path(profile)/'invalid.json';invalid_file.write_text(json.dumps(bad))
    panel.locator('#cr-import').set_input_files(str(invalid_file));status('current Greenhouse origin')
    check(len(rows('documents'))==3,'Invalid import cannot partially commit')
    panel.locator('#search').fill('EKS');page.wait_for_timeout(300)
    check('Synthetic EKS' in panel.locator('#results').inner_text(),'Imported records are searchable')
    with page.expect_download() as dl: panel.locator('#cr-export').click()
    exported=json.loads(Path(dl.value.path()).read_text())
    check(exported['greenhouseWrites']==0 and len(exported['reviews'])==1,'Queue export is explicitly not execution')
    check(resume not in json.dumps(exported),'Queue export excludes full résumé text')
    page.reload();panel.locator('#enabled').wait_for();status('Application 201')
    check(not panel.locator('#enabled').is_checked(),'Reload requires opt-in')
    check(len(rows('reviews'))==1,'Decisions survive reload')
    enable();page.keyboard.press('Alt+j');page.wait_for_url('**job_application_id=202');status('Application 202')
    enable();page.keyboard.press('Alt+m');status('MAYBE queued')
    check(len(rows('reviews'))==2,'Same candidate in distinct applications cannot collide')
    panel.locator('#queue-list').click();page.wait_for_timeout(200)
    check(panel.locator('#results article').count()==2,'Queue lists both applications')
    page.screenshot(path=str(ROOT/'artifacts/browser-preview.png'),full_page=True)
    page.on('dialog',lambda dialog:dialog.accept());panel.locator('#clear').click();status('All local data cleared')
    check(rows('documents')==[] and rows('reviews')==[] and rows('audit')==[],'Clear removes all local stores')
    check(errors==[],f'No renderer errors: {errors}')
    check(unexpected==[],f'No outbound page requests: {unexpected}')
    ctx.close()
    print(json.dumps({'status':'passed','checks':len(checks),'assertions':checks,'network':'loopback fixture only; no live Greenhouse certification','browser':binary or 'Playwright Chromium'},indent=2))
server.shutdown()
