from browser import document, window
import traceback
import io
from types import SimpleNamespace

page = SimpleNamespace()

def show_popup(text):
    page.stderr.textContent = text
    page.popup_layer.setAttribute("class", "")

def show_traceback():
    show_popup(traceback.format_exc())
    
def hide_popup(*args):
    page.popup_layer.setAttribute("class", "hidden")

def get_stdout():
    element = page.inner_document.getElementById("stdout")
    if element is None:
        element = page.inner_document.createElement("div")
        element.id = "stdout"
        page.root_element.querySelector("body").append(element)
    return element

def client_select(selector, raise_on_fail = True):
    if not isinstance(selector, str): return selector
    element = page.inner_document.getElementById(selector)
    if element is not None: return element
    element = page.root_element.querySelector(selector)      
    if element is not None: return element
    if raise_on_fail: raise RuntimeError(f"No such element as {selector}")
    return None

def client_clear(selector = None):
    element = client_select(selector or get_stdout())
    element.innerHTML = ""

def client_input(selector):
    control = client_select(selector)
    if hasattr(control, "value"): return control.value
    return control.textContent

def client_print(*args, **kwargs):
    output = io.StringIO()
    print(*args, file=output, **kwargs)
    
    element_id = kwargs.get("to")
    element = client_select(element_id or get_stdout())
    if hasattr(element, "value"): element.value = output.getvalue()
    else: element.innerHTML += output.getvalue()

def client_button_click(event, global_vars):
    button_id = event.target.id
    method_name = f"click_{button_id}"
    callback = global_vars.get(method_name)
    if callback is not None:
        try: callback()
        except Exception as e: show_traceback()

def run_script(text):
    global_vars = globals().copy()    
    global_vars["select"] = client_select
    global_vars["clear"] = client_clear
    global_vars["input"] = client_input
    global_vars["print"] = client_print
    ids = SimpleNamespace()
    global_vars["page"] = ids

    ids.body = page.root_element.querySelector("body")
    for element in page.root_element.querySelectorAll("[id]"):
        setattr(ids, element.id, element)
        if element.tagName == "BUTTON":
            def callback(event): return client_button_click(event, global_vars)
            element.bind("click", callback)
    
    try:
        exec(text, global_vars)
    except Exception as e:
        show_traceback()
    
def main():
    page.inner_document = document["user-page"].contentWindow.document
    page.root_element = page.inner_document.documentElement
    page.stderr = document["stderr"]
    page.popup_layer = document["popup-layer"]
    
    page.popup_layer.addEventListener("click", hide_popup)
    window.run_script = run_script

main()
