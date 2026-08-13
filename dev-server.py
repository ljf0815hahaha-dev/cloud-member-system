from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import os

ROOT = Path(__file__).resolve().parent / "staff-h5"
os.chdir(ROOT)

class Utf8Handler(SimpleHTTPRequestHandler):
    def guess_type(self, path):
        content_type = super().guess_type(path)
        if content_type.startswith("text/") or content_type in {"application/javascript", "application/json"}:
            return f"{content_type}; charset=UTF-8"
        return content_type

if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", 8765), Utf8Handler)
    print("Staff H5: http://127.0.0.1:8765/")
    server.serve_forever()
