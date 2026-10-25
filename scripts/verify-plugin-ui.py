"""Browser-only UI harness. It is not a substitute for the manual Figma check."""
import json
import os
from pathlib import Path
import subprocess
import tempfile
import time
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix='magic-ui-browser-') as directory:
    server = subprocess.Popen(
        ['node', '--import', 'tsx', 'scripts/stdio-test-server.ts', directory],
        cwd=ROOT, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
    )
    try:
        credentials_path = Path(directory) / 'session.json'
        deadline = time.monotonic() + 10
        while not credentials_path.exists():
            if server.poll() is not None or time.monotonic() > deadline:
                raise RuntimeError('Browser harness server failed to start')
            time.sleep(0.05)
        credentials = json.loads(credentials_path.read_text())
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            page = browser.new_page(viewport={'width': 360, 'height': 400})
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            # Emulate only the parent Figma UI messaging surface; use the real bridge socket.
            page.add_init_script("""(({port}) => {
              const NativeSocket = window.WebSocket;
              window.WebSocket = class extends NativeSocket {
                constructor() { super(`ws://127.0.0.1:${port}`); }
              };
              window.addEventListener('message', (event) => {
                const message = event.data?.pluginMessage;
                if (message?.kind === 'initialize' || message?.kind === 'saveToken') {
                  window.postMessage({pluginMessage: {
                    kind: 'settings', correlationId: message.correlationId,
                    token: message.kind === 'saveToken' ? message.token : null,
                    document: {name: 'UI verification file', pageId: '0:1', pageName: 'Page 1'}
                  }}, '*');
                }
                if (message?.kind === 'bridge' && message.message.type === 'command') {
                  const command = message.message;
                  if (command.payload.command === 'ping') window.postMessage({pluginMessage: {
                    kind: 'bridge', message: {...command, type: 'result', payload: {command: 'ping', result: {alive: true}}}
                  }}, '*');
                }
              });
            })(""" + json.dumps({'port': credentials['port']}) + ');')
            page.goto((ROOT / 'packages/plugin/dist/ui.html').as_uri())
            page.wait_for_load_state('networkidle')
            button = page.get_by_role('button', name='Reconnect')
            expect(page.get_by_role('heading', name='Magic UI')).to_be_visible()
            expect(button).to_be_disabled()
            expect(page.get_by_role('status')).to_contain_text('Paste the server token')
            page.get_by_label('Session token').fill('a' * 64)
            expect(button).to_be_enabled()
            button.click()
            expect(page.get_by_role('status')).to_contain_text('token is incorrect')
            page.get_by_label('Session token').fill(credentials['token'])
            button.click()
            expect(page.get_by_role('status')).to_contain_text('Connected. Ready for frame commands.')
            page.get_by_label('Session token').fill('')  # Keep credentials out of captures, even masked.
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
            output = ROOT / '.impeccable/review'
            output.mkdir(parents=True, exist_ok=True)
            page.screenshot(path=str(output / 'plugin-360.png'), full_page=True)
            page.set_viewport_size({'width': 280, 'height': 400})
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
            page.screenshot(path=str(output / 'plugin-280.png'), full_page=True)
            assert not errors, errors
            print('Passed: browser UI load, disabled input state, incorrect-token error, reconnect recovery, no page errors, no horizontal overflow at 360px / 280px.')
            browser.close()
    finally:
        if server.stdin:
            server.stdin.close()
        try:
            server.wait(timeout=5)
        except subprocess.TimeoutExpired:
            server.terminate()
            server.wait(timeout=5)
