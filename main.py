from browser import document, window
import traceback
import io
from types import SimpleNamespace

class Config:
    document = None
    document_element = None
    user_namespace = None

def show_stacktrace(message = ""):
    trace = traceback.format_exc()
    window.parent.postMessage(f"Python error: {message}\n{trace}")

def string_to_boolean(value):
    value = str(value).lower()
    if value == "false" or value == "": return False
    return True

def string_to_number(value):
    try: return int(value)
    except: pass
    try: return float(value)
    except: pass
    return value

class ElementWrapper:
    events = (
        ("button", "click"),
        ("input[type=button]", "click"),
        ("input", "change"),
        ("select", "change"),
    )

    instances = {}
    
    @classmethod
    def of(self, element):
        instance = self.instances.get(element.id)
        if instance is None:
            instance = ElementWrapper(element)
            self.instances[element.id] = instance
        return instance

    def __init__(self, element):
        self.element = element

        for selector, event_name in self.events:
            if element.matches(selector):
                element.bind(event_name, self.client_event_handler)
    
    def select(self, selector):
        child = self.element.querySelector(selector)
        if child: return ElementWrapper.of(child)
        else: return None
    
    def select_all(self, selector):
        children = self.element.querySelectorAll(selector)
        return [ ElementWrapper.of(child) for child in children ]
    
    def clear(self):
        self.innerHTML = ""
    
    @property
    def value(self):
        if self.element.matches("input[type=checkbox]"):
            value = string_to_boolean(self.element.checked)
        elif self.element.matches("input[type=number]"):
            value = string_to_number(self.element.value)
        elif self.element.matches("textarea, select, input"):
            value = self.element.value
        else:
            value = self.element.textContent
            
        return value
        
    @value.setter
    def value(self, value):
        value = str(value)
        if self.element.matches("input[type=checkbox]"):
            self.element.checked = string_to_boolean(value)
        elif self.element.matches("textarea, select, input"):
            self.element.value = value
        else:
            self.element.textContent = value
    
    @property
    def number(self):
        try: return int(self.value)
        except: return float(self.value)
        
    @number.setter
    def number(self, value):
        self.value = str(value)
    
    def print(self, *args, **kwargs):
        output = io.StringIO()
        print(*args, file=output, **kwargs)
        self.value += output.getvalue()
    
    def client_event_handler(self, event):
        target_id = event.target.id
        method_name = f"{event.type}_{target_id}"
        callback = Config.user_namespace.get(method_name)
        if callback is None: return
        try: callback()
        except Exception as e: show_stacktrace()

def client_get_element(element_id = "stdout"):
    if isinstance(element_id, ElementWrapper): return element_id
    element = Config.document.getElementById(str(element_id))
    if element is not None: return ElementWrapper.of(element)
    return None

def client_input(element_id = None):
    element = client_get_element(element_id)
    if element is None:
        show_stacktrace("Incorrect HTML id given to input.")
        return ""
    else:
        print(f"Value={element.value} Type={type(element.value)}")
        return element.value

def client_print(*args, **kwargs):
    element = client_get_element()
    element.print(*args, **kwargs)

def run_script(text):
    ElementWrapper.instances.clear()

    Config.document_element = Config.document.documentElement
    Config.user_namespace = {}
    Config.user_namespace["input"] = client_input
    Config.user_namespace["print"] = client_print

    for element in Config.document_element.querySelectorAll("[id]"):
        element_wrapper = ElementWrapper.of(element)
        Config.user_namespace[element.id] = element_wrapper
       
    try:
        exec(text, Config.user_namespace)
    except Exception as e:
        show_stacktrace()
    
def main():
    iframe = window.document.getElementById("user-page")

    if iframe:
        Config.document = iframe.contentWindow.document
    else:
        Config.document = window.document

    window.run_python = run_script

main()
