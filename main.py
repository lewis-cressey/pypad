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

def run_script(text):
    root_element = document["user-page"].contentWindow.document.documentElement
    
    def select(selector):
        return root_element.querySelector(selector)

    local_vars = {
        "select" : select
    }
    try:
        exec(text, globals(), dict(local_vars))
    except Exception as e:
        text = traceback.format_exc()
        show_popup(text)
    
def main():
    page.stderr = document["stderr"]
    page.popup_layer = document["popup-layer"]
    
    page.popup_layer.addEventListener("click", hide_popup)
    window.run_script = run_script

main()
