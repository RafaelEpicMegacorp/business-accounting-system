#!/usr/bin/env python3
"""
Simple HTTP proxy to intercept and log ALL webhook requests.
This will show us EXACTLY what Wise is sending.
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import requests
from datetime import datetime

TARGET_URL = "https://business-accounting-system-production.up.railway.app/api/wise/webhook"

class WebhookInterceptor(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass  # Suppress default logging

    def do_POST(self):
        print("\n" + "="*80)
        print(f"🔔 WEBHOOK INTERCEPTED at {datetime.now().isoformat()}")
        print("="*80)

        # Log request line
        print(f"📍 Method: {self.command}")
        print(f"🔗 Path: {self.path}")
        print(f"🌐 HTTP Version: {self.request_version}")

        # Log all headers
        print("\n📋 HEADERS:")
        for header, value in self.headers.items():
            print(f"  {header}: {value}")

        # Read and log body
        content_length = int(self.headers.get('Content-Length', 0))
        body_bytes = self.rfile.read(content_length)
        body_text = body_bytes.decode('utf-8')

        print(f"\n📦 BODY ({len(body_bytes)} bytes):")
        print(body_text)

        # Try to parse as JSON for pretty printing
        try:
            body_json = json.loads(body_text)
            print("\n📝 PARSED JSON:")
            print(json.dumps(body_json, indent=2))
        except:
            print("\n⚠️  Body is not valid JSON")

        print("\n🚀 FORWARDING TO TARGET...")

        # Forward to actual endpoint
        try:
            headers = dict(self.headers)
            response = requests.post(
                TARGET_URL,
                data=body_bytes,
                headers=headers,
                timeout=10
            )

            print(f"✅ Response Status: {response.status_code}")
            print(f"📥 Response Body: {response.text[:500]}")

            # Send response back to Wise
            self.send_response(response.status_code)
            for header, value in response.headers.items():
                if header.lower() not in ['transfer-encoding', 'connection']:
                    self.send_header(header, value)
            self.end_headers()
            self.wfile.write(response.content)

        except Exception as e:
            print(f"❌ Error forwarding: {e}")
            self.send_response(500)
            self.end_headers()
            self.wfile.write(b'{"error": "Proxy error"}')

        print("="*80)
        print()

def run(port=8888):
    server = HTTPServer(('0.0.0.0', port), WebhookInterceptor)
    print(f"""
╔══════════════════════════════════════════════════════════════════════╗
║                   WEBHOOK INTERCEPTOR RUNNING                        ║
╚══════════════════════════════════════════════════════════════════════╝

📡 Listening on: http://localhost:{port}
🎯 Forwarding to: {TARGET_URL}

👉 UPDATE YOUR WISE WEBHOOK URL TO:
   http://YOUR_PUBLIC_IP:{port}/

   Or use ngrok:
   ngrok http {port}
   Then use the ngrok URL in Wise

🔍 This will show EXACTLY what Wise is sending...
""")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n\n👋 Shutting down interceptor...")
        server.shutdown()

if __name__ == '__main__':
    run()
