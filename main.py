from browser import document, window
import traceback
import io
from types import SimpleNamespace

page = SimpleNamespace()

def show_popup(text):
    page.stderr.textContent = text
    page.popup_layer.setAttribute("class", "")

def hide_popup(*args):
    page.popup_layer.setAttribute("class", "hidden")

def client_select(selector, allow_none = False):
    element = page.inner_document.getElementById(selector)
    if element is not None: return element
    element = page.root_element.querySelector(selector)      
    if element is not None: return element
    if allow_none: return None
    raise RuntimeError(f"No such element as {selector}")

def client_decorator_click(selector):
    def decorator(function):
        client_select(selector).bind("click", function)
        return function
    return decorator

def client_on(selector, event, function):
    element = client_select(selector)
    element.bind(event, function)

def client_input(selector):
    control = client_select(selector)
    return control.value

def client_print(*args, **kwargs):
    output = io.StringIO()
    print(*args, file=output, **kwargs)
    
    element_id = kwargs.get("to", "#stdout")
    element = client_select(element_id, allow_none = True)
    if element is None:
        element = page.inner_document.createElement("div")
        element.id = "stdout"
        page.root_element.querySelector("body").append(element)
    element.textContent += output.getvalue()

def run_script(text):
    global_vars = globals().copy()    
    global_vars["select"] = client_select
    global_vars["input"] = client_input
    global_vars["print"] = client_print
    global_vars["on"] = client_on
    global_vars["click"] = client_decorator_click
    ids = SimpleNamespace()
    global_vars["page"] = ids

    ids.body = page.root_element.querySelector("body")
    for element in page.root_element.querySelectorAll("[id]"):
        setattr(ids, element.id, element)
    
    try:
        exec(text, global_vars)
    except Exception as e:
        text = traceback.format_exc()
        show_popup(text)
    
def main():
    page.inner_document = document["user-page"].contentWindow.document
    page.root_element = page.inner_document.documentElement
    page.stderr = document["stderr"]
    page.popup_layer = document["popup-layer"]
    
    page.popup_layer.addEventListener("click", hide_popup)
    window.run_script = run_script

main()
