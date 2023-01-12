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

real_print = print

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

def stdout():
    element = page.document.getElementById("stdout")
    if element is None:
        element = page.document.createElement("div")
        element.id = "stdout"
        page.root_element.querySelector("body").append(element)
    return element

def select(selector, raise_on_fail = True):
    if not isinstance(selector, str): return selector
    element = page.document.getElementById(selector)
    if element is not None: return element
    element = page.root_element.querySelector(selector)      
    if element is not None: return element
    if raise_on_fail: raise RuntimeError(f"No such element as {selector}")
    return None

def clear(selector = None):
    element = select(selector or stdout())
    element.innerHTML = ""

def input(selector):
    control = client_select(selector)
    if hasattr(control, "value"): return control.value
    return control.textContent

def print(*args, **kwargs):
    output = io.StringIO()
    real_print(*args, file=output, **kwargs)
    element_id = kwargs.get("to")
    element = select(element_id or stdout())
    if hasattr(element, "value"): element.value = output.getvalue()
    else: element.innerHTML += output.getvalue()

def client_event_handler(event):
    target_id = event.target.id
    method_name = f"{event.type}_{target_id}"
    callback = globals().get(method_name)
    if callback is not None:
        try: callback()
        except Exception as e: show_traceback()

def add_listeners(element):
    def callback(event):
        return client_event_handler(event)

    for selector, event_name in EVENTS:
        if element.matches(selector):
            element.bind(event_name, callback)
     
def scan_page():
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
        add_listeners(element)
        
    return page

page = scan_page()
def run_script(text):
    global page
    page = scan_page()
    
    try:
        exec(text)
    except Exception as e:
        popup = Popup.traceback()
        popup.show()
    
def main():
    window.run_script = run_script
    
main()
