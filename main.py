from browser import document, window
import traceback
import io
from types import SimpleNamespace

EVENTS = (
    ("button", "click"),
    ("input[type=button]", "click"),
    ("input", "change"),
    ("select", "change"),
)

class Popup:
    @classmethod
    def traceback(self):
        return Popup(traceback.format_exc())
    
    def __init__(self, text):
        self.layer = window.document["popup-layer"]
        self.text = text
        
    def show(self):
        self.layer.innerHTML = "<pre></pre>"
        content = self.layer.querySelector("pre")
        content.textContent = self.text
        content.bind("click", self.hide)
        self.layer.setAttribute("class", "")

    def hide(self, *event):
        self.layer.innerHTML = ""
        self.layer.setAttribute("class", "hidden")

def client_stdout():
    page = user_globals["page"]
    element = page.document.getElementById("stdout")
    if element is None:
        element = page.document.createElement("div")
        element.id = "stdout"
        page.root_element.querySelector("body").append(element)
    return element

def client_select(selector, raise_on_fail = True):
    if not isinstance(selector, str): return selector
    page = user_globals["page"]
    element = page.document.getElementById(selector)
    if element is not None: return element
    element = page.root_element.querySelector(selector)      
    if element is not None: return element
    if raise_on_fail: raise RuntimeError(f"No such element as {selector}")
    return None

def client_clear(selector = None):
    element = client_select(selector or client_stdout())
    element.innerHTML = ""

def client_input(selector):
    control = client_select(selector)
    if hasattr(control, "value"): return control.value
    return control.textContent

def client_print(*args, **kwargs):
    output = io.StringIO()
    print(*args, file=output, **kwargs)
    element_id = kwargs.get("to")
    element = client_select(element_id or client_stdout())
    if hasattr(element, "value"): element.value = output.getvalue()
    else: element.innerHTML += output.getvalue()

def client_event_handler(event, g):
    target_id = event.target.id
    method_name = f"{event.type}_{target_id}"
    callback = g.get(method_name)

    if callback is not None:
        try:
            callback()
        except Exception as e:
            popup = Popup.traceback()
            popup.show()

def add_listeners(element, g):
    def callback(event):
        return client_event_handler(event, g)

    for selector, event_name in EVENTS:
        if element.matches(selector):
            element.bind(event_name, callback)
     
def scan_page(g):
    page = SimpleNamespace()
    iframe = window.document.getElementById("user-page")

    if iframe:
        page.document = iframe.contentWindow.document
        page.popup_layer = document["popup-layer"]
    else:
        page.document = window.document

    page.root_element = page.document.documentElement
    for element in page.root_element.querySelectorAll("[id]"):
        setattr(page, element.id, element)
        add_listeners(element, g)
        
    return page

def run_script(text):
    global user_globals
    g = {}
    user_globals = g
    
    g["page"] = scan_page(g)
    g["select"] = client_select
    g["clear"] = client_clear
    g["input"] = client_input
    g["print"] = client_print
        
    try:
        exec(text, g)
    except Exception as e:
        popup = Popup.traceback()
        popup.show()
    
def main():
    page = scan_page(globals())
    window.run_script = run_script
    
main()
