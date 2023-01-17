/****************************************************************************
 ** Text templates.                                                        **
 ****************************************************************************/

const TEMPLATES = {
	application: `
        <html>
            <head>
				<meta charset="utf-8" />
                <style>
					#css#
				</style>
				<script src="https://cdnjs.cloudflare.com/ajax/libs/brython/3.10.4/brython.min.js" integrity="sha512-Ku0Q6E6RaZsR8UNZKfm4GcC0ZXrDZyzj00pFmzR6YHoR9u1R4YuaM+Ew6hj50wtOr/lFRjTvQ7ZXJfGzbPAMDQ==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
				<script src="https://cdnjs.cloudflare.com/ajax/libs/brython/3.10.4/brython_stdlib.js" integrity="sha512-kMRN6F4Yq4sNLbPG2lH3EO9n776JHHZub+UWogDxVjh9uTnoVo3wtN/rnQD4C4/AZtqI2zQdvdouGAAxOGwNeA==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
				<script type="text/python">
					#pyCode#
				</script>
            </head>
            <body onload="brython()">
				#html#
			</div>
			</body>
			<script>
				#jsCode#
			</script>
        </html>
	`,
	iframe: `
        <html>
            <head>
                <style>
					#css#
				</style>
            </head>
            <body>
				#html#
			</body>
			<script>
				window.onload = function() {
					console.log("RUNNING...")
				}
				#jsCode#
			</script>
        </html>
    `
}

/****************************************************************************
 ** Global constants.                                                      **
 ****************************************************************************/

const EditSession = require("ace/edit_session").EditSession;
ace.config.set("basePath", "https://cdnjs.cloudflare.com/ajax/libs/ace/1.4.13/")
const editor = ace.edit("editor");
const filenameInput = document.getElementById("filename")
const iframeElement = document.querySelector("iframe")

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

function renderTemplate(template, substitutions) {
	let index0 = 0
	let result = []
	while (true) {
		const index1 = template.indexOf("#", index0)
		if (index1 < 0) break
		const index2 = template.indexOf("#", index1 + 1)
		if (index2 < 0) break
		const tag = template.substring(index1 + 1, index2)
		result.push(template.substring(index0, index1))
		result.push(substitutions[tag])
		index0 = index2 + 1
	}
	result.push(template.substring(index0))
	return result.join("")
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
    content = self.layer.querySelector("pre")
    content.textContent = text
    content.addEventListener("click", function() {
        layer.innerHTML = ""
        layer.setAttribute("class", "hidden")
	})
    layer.setAttribute("class", "")
}

function runUserJs(code) {
	try {
		const f = new Function(`(function usercode() {\n"use strict;"\n${code}\n}).call()\n`)
		f()
		return null
	} catch (err) {
		const lines = err.stack.split("\n")
		let line = lines[1]
		let lineNumber = 0
		const functionName = "<anonymous>"
		
		for (;;) {
			const index = line.indexOf(functionName)
			if (index < 0) break
			line = line.substring(index + functionName.length)
		}
		
		for (;;) {
			lineNumber = parseInt(line)
			if (lineNumber > 0) break
			line = line.substring(1)
		}
		
		showPopup(`Line ${lineNumber}: ${err}`)
	}
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
			this.sessions[sessionName].setValue(jobj[sessionName] || "")
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
})

document.querySelector("#run-button").addEventListener("click", event => {
	PROJECT.save()
	const doc = iframeElement.contentWindow.document
	doc.documentElement.innerHTML = renderTemplate(TEMPLATES.iframe, {
		css: PROJECT.getText("css"),
		html: PROJECT.getText("html"),
		jsCode: PROJECT.getText("javascript"),
	})
	
	for (let element of doc.querySelectorAll("a, form")) {
		element.setAttribute("target", "_blank")
	}

	window.run_script(PROJECT.getText("python"))
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

	let standalone = renderTemplate(TEMPLATES.application, {
		html: PROJECT.getText("html"),
		css: PROJECT.getText("css"),
		jsCode: PROJECT.getText("javascript"),
		pyCode: pypadCode + PROJECT.getText("python"),
	})
		
	download(filename, standalone, "text/html")
})

function main() {
	getFilename()
	PROJECT.load()
	editor.setSession(PROJECT.getSession("html"))
}

main()
