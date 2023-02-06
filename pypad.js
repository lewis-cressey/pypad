/****************************************************************************
 ** Text templates.                                                        **
 ****************************************************************************/

class Template {
	constructor(text) {
		this.text = text
	}
	
	render(substitutions) {
		let index0 = 0
		let result = []
		while (true) {
			const index1 = this.text.indexOf("#", index0)
			if (index1 < 0) break
			const index2 = this.text.indexOf("#", index1 + 1)
			if (index2 < 0) break
			const tag = this.text.substring(index1 + 1, index2)
			result.push(this.text.substring(index0, index1))
			result.push(substitutions[tag])
			index0 = index2 + 1
		}
		result.push(this.text.substring(index0))
		return result.join("")
	}
}

const TEMPLATES = {
	application: new Template(`
        <html>
            <head>
				<meta charset="utf-8" />
                <style>
					#css#
				</style>
				<script src="https://cdnjs.cloudflare.com/ajax/libs/brython/3.10.4/brython.min.js" integrity="sha512-Ku0Q6E6RaZsR8UNZKfm4GcC0ZXrDZyzj00pFmzR6YHoR9u1R4YuaM+Ew6hj50wtOr/lFRjTvQ7ZXJfGzbPAMDQ==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
				<script src="https://cdnjs.cloudflare.com/ajax/libs/brython/3.10.4/brython_stdlib.js" integrity="sha512-kMRN6F4Yq4sNLbPG2lH3EO9n776JHHZub+UWogDxVjh9uTnoVo3wtN/rnQD4C4/AZtqI2zQdvdouGAAxOGwNeA==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
				<script type="text/python">
					#pypadCode#
				</script>
				<script type="text/python">
					#pyCode#
				</script>
            </head>
            <body onload="brython()">
				#html#
				<pre id="stdout"></pre>
			</body>
			<script>
				#jsCode#
			</script>
        </html>
	`),
	iframe: new Template(`
        <html>
            <head>
                <style>
					#css#
				</style>
            </head>
            <body>
				#html#
				<pre id="stdout"></pre>
			</body>
        </html>
    `)
}

/****************************************************************************
 ** Global constants.                                                      **
 ****************************************************************************/

const EditSession = require("ace/edit_session").EditSession;
var UndoManager = require("ace/undomanager").UndoManager;
ace.config.set("basePath", "https://cdnjs.cloudflare.com/ajax/libs/ace/1.4.13/")
const editor = ace.edit("editor");
const filenameInput = document.getElementById("filename")
const iframeElement = document.querySelector("iframe")

editor.commands.addCommands([
	{
		name : 'undo',
		bindKey : 'Ctrl-Z',
		exec : function() { editor.session.getUndoManager().undo() }
	},
	{
		name : 'redo',
		bindKey : 'Ctrl-Y',
		exec : function(editor){ editor.session.getUndoManager().redo() }
	}
])

/****************************************************************************
 ** Utility functions.                                                     **
 ****************************************************************************/

function getFilename(extension = "") {
	let filename = filenameInput.value.trim()
	if (filename == "") {
		filename = localStorage.getItem("pypad.filename") || "unnamed"
		filenameInput.value = filename
	}
	if (!filename.endsWith(extension)) filename += extension
	return filename
}

function download(filename, text, mimetype = "text/plain") {
	const blob = new Blob([ text ], { type: mimetype })
	const link = document.getElementById("save-link")
    link.href = window.URL.createObjectURL(blob)
    link.download = filename
    link.click()
}

function showPopup(text) {
	const layer = document.querySelector("#popup-layer")
    layer.innerHTML = "<pre></pre>"
    content = layer.querySelector("pre")
    content.textContent = text
    content.addEventListener("click", function() {
        layer.innerHTML = ""
        layer.setAttribute("class", "hidden")
	})
    layer.setAttribute("class", "")
}

/****************************************************************************
 ** Creating edit sessions for supported languages.                        **
 ****************************************************************************/

class Project {
	constructor() {
		this.sessionNames = [ "html", "css", "python", "javascript" ]
		this.sessions = {}
		
		for (let sessionName of this.sessionNames) {
			const session = new EditSession("")
			session.setMode(`ace/mode/${sessionName}`)
			session.setValue(localStorage.getItem(`pypad.${sessionName}`) || "")
			session.setUndoManager(new UndoManager())
			this.sessions[sessionName] = session
		}
	}

	getSession(sessionName) {
		return this.sessions[sessionName]
	}

	getText(sessionName) {
		return this.getSession(sessionName).getValue() || ""
	}

	toJson() {
		let jobj = {}
		for (let sessionName of this.sessionNames) {
			jobj[sessionName] = this.getText(sessionName)
		}
		return JSON.stringify(jobj)
	}

	fromJson(json) {
		let jobj = {}
		
		try {
			jobj = JSON.parse(json)
		} catch {}
		
		for (let sessionName of this.sessionNames) {
			this.getSession(sessionName).setValue(jobj[sessionName] || "")
		}
	}

	reset() {
		for (let sessionName of this.sessionNames) {
			this.getSession(sessionName).setValue("")
		}
	}

	save() {
		localStorage.setItem("pypad.code", this.toJson())
	}

	load() {
		this.fromJson(localStorage.getItem("pypad.code") || "")
	}
}

const PROJECT = new Project()

/****************************************************************************
 ** User interface.                                                        **
 ****************************************************************************/

document.querySelector("#file-select").addEventListener("change", event => {
    PROJECT.save()
	const session = PROJECT.getSession(event.target.value)
	editor.setSession(session)
	editor.focus()
})

document.querySelector("#run-button").addEventListener("click", event => {
	PROJECT.save()
	const doc = iframeElement.contentWindow.document
	const jsCode = PROJECT.getText("javascript")
	
	doc.documentElement.innerHTML = TEMPLATES.iframe.render({
		css: PROJECT.getText("css"),
		html: PROJECT.getText("html")
	})
	
	for (let element of doc.querySelectorAll("a, form")) {
		element.setAttribute("target", "_blank")
	}

	const iframeDoc = iframeElement.contentDocument || iframeElement.contentWindow.document
	const scriptElement = iframeDoc.createElement("script")
	iframeElement.contentWindow.addEventListener("error", function(event) {
		const message = `Javascript error on line ${event.lineno}.\n${event.message}`
		window.parent.postMessage(message)
	})
	scriptElement.textContent = jsCode
	iframeDoc.querySelector("body").append(scriptElement)
	window.run_python(PROJECT.getText("python"))
})

document.querySelector("#save-button").addEventListener("click", event => {
    PROJECT.save()
	const filename = getFilename(".pypad")
	download(filename, PROJECT.toJson(), "application/json")
})

document.querySelector("#load-file").addEventListener("change", event => {
    const reader = new FileReader()

    reader.onload = function() {
        PROJECT.fromJson(reader.result)
		PROJECT.save()
    }

    const files = event.target.files
    if (files[0]) reader.readAsText(files[0])
})

document.querySelector("#load-button").addEventListener("click", event => {
    document.querySelector("#load-file").click()
})

document.querySelector("#export-button").addEventListener("click", async event => {
    PROJECT.save()
	const filename = getFilename(".html")
	const response = await window.fetch("main.py")
	const pypadCode = await response.text()
	const pyCode = PROJECT.getText("python").replace(/["]["]["]/g, "\\x22\\x22\\x22")

	let standalone = TEMPLATES.application.render({
		html: PROJECT.getText("html"),
		css: PROJECT.getText("css"),
		jsCode: PROJECT.getText("javascript"),
		pypadCode: `\n${pypadCode}\n`,
		pyCode: `\nfrom browser import window\nwindow.run_python("""\n${pyCode}\n""")\n`,
	})
		
	download(filename, standalone, "text/html")
})

document.querySelector("#new-button").addEventListener("click", async event => {
	PROJECT.reset()
})

function main() {
	getFilename()
	PROJECT.load()
	editor.setSession(PROJECT.getSession("html"))
	
	window.addEventListener("message", function (event) {
		showPopup(event.data)
	})
}

main()
