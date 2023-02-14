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

const PAGE = {
	filenameInput: document.getElementById("filename"),
	fileSelect: document.getElementById("file-select"),
	popupLayer: document.getElementById("popup-layer"),
	newButton: document.getElementById("new-button"),
	runButton: document.getElementById("run-button"),
	saveLink: document.getElementById("save-link"),
	exportButton: document.getElementById("export-button"),
	loadButton: document.getElementById("load-button"),
	saveButton: document.getElementById("save-button"),
	loadFile: document.getElementById("load-file"),
}

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
	let filename = PAGE.filenameInput.value.trim()
	if (filename == "") {
		filename = localStorage.getItem("pypad.filename") || "unnamed"
		PAGE.filenameInput.value = filename
	}
	if (!filename.endsWith(extension)) filename += extension
	return filename
}

function download(filename, text, mimetype = "text/plain") {
	const blob = new Blob([ text ], { type: mimetype })
    PAGE.saveLink.href = window.URL.createObjectURL(blob)
    PAGE.saveLink.download = filename
    PAGE.saveLink.click()
}

function showPopup(text) {
	const pre = document.createElement("pre")
	pre.textContent = text
	PAGE.popupLayer.append(pre)
    PAGE.popupLayer.classList.remove("hidden")
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

function recreateIframe() {
	let iframeElement = document.querySelector("iframe")
	if (iframeElement) iframeElement.remove()
	iframeElement = document.createElement("iframe")
	document.getElementById("iframe-container").append(iframeElement)
	return iframeElement
}

PAGE.fileSelect.addEventListener("change", event => {
    PROJECT.save()
	const session = PROJECT.getSession(event.target.value)
	editor.setSession(session)
	editor.focus()
})

PAGE.runButton.addEventListener("click", event => {
	PROJECT.save()
	const iframeElement = recreateIframe()
	const doc = iframeElement.contentWindow.document
	
	const fillIframe = function() {
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
			window.parent.postMessage({ type: "error", message: message })
		})
		scriptElement.textContent = jsCode
		
		iframeDoc.querySelector("body").append(scriptElement)
		window.run_python(PROJECT.getText("python"))
	}
	
	let onReadyStateChange = function() {
		if (doc.readyState === "complete") {
			fillIframe()
		} else {
			setTimeout(onReadyStateChange, 10)
		}
	}
	
	onReadyStateChange()	
})

PAGE.saveButton.addEventListener("click", event => {
    PROJECT.save()
	const filename = getFilename(".pypad")
	download(filename, PROJECT.toJson(), "application/json")
})

PAGE.loadFile.addEventListener("change", event => {
    const reader = new FileReader()

    reader.onload = function() {
        PROJECT.fromJson(reader.result)
		PROJECT.save()
    }

    const files = event.target.files
    if (files[0]) reader.readAsText(files[0])
})

PAGE.loadButton.addEventListener("click", event => {
    PAGE.loadFile.click()
})

PAGE.exportButton.addEventListener("click", async event => {
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

PAGE.newButton.addEventListener("click", async event => {
	PROJECT.reset()
})

PAGE.popupLayer.addEventListener("click", event => {
	PAGE.popupLayer.innerHTML = ""
    PAGE.popupLayer.classList.add("hidden")
})

function main() {
	getFilename()
	PROJECT.load()
	
	PAGE.fileSelect.selectedIndex = 0
	editor.setSession(PROJECT.getSession("html"))
	
	window.addEventListener("message", function (event) {
		const data = event.data
		if (data.type === "error") {
			showPopup(data.message)
		}
	})
}

main()
