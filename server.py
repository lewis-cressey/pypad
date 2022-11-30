from http.server import HTTPServer
from http.server import CGIHTTPRequestHandler

def run():
    server_address = ('', 8000)
    httpd = HTTPServer(server_address, CGIHTTPRequestHandler)
    httpd.serve_forever()

run()
