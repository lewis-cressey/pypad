const EditSession = require("ace/edit_session").EditSession;
ace.config.set("basePath", "https://cdnjs.cloudflare.com/ajax/libs/ace/1.4.13/")
const editor = ace.edit("editor");

function getParameter(name, fallback) {
    let result = null
    const fields = location.search.substr(1).split("&")
    for (let field of fields) {
		const lhsRhs = field.split("=");
		if (lhsRhs.length === 2 && lhsRhs[0] === name) {
			return decodeURIComponent(lhsRhs[1]);
		} else if (lhsRhs.length === 1 && lhsRhs[0] === name) {
			return true
		}
    }
    return fallback;
}

function createSessions(sessionTitles) {
	const sessions = {}

	for (let sessionTitle of Object.keys(sessionTitles)) {
		const session = new EditSession("")
		const lang = sessionTitles[sessionTitle]
		session.setMode(`ace/mode/${lang}`)
		session.setValue(localStorage.getItem(`pypad.${sessionTitle}`) || "")
		sessions[sessionTitle] = session
	}

	return sessions
}

const SESSIONS = createSessions({
	"HTML" : "html",
	"CSS" : "css",
	"Python" : "python",	
})

function saveSessions() {
    const sessions = SESSIONS
	for (let sessionTitle of Object.keys(sessions)) {
		const session = sessions[sessionTitle]
		const text = session.getValue()
		localStorage.setItem(`pypad.${sessionTitle}`, text)
	}
    return sessions
}

function downloadBlob(extension, blob) {
    let filename = document.getElementById("project-name").value.toString().trim()
	if (filename.length == 0) filename = "program"
	filename += extension
	
	const link = document.getElementById("save-link")
    link.href = window.URL.createObjectURL(blob)
    link.download = filename
    link.click()
}

document.querySelector("#file-select").addEventListener("change", event => {
    const sessions = saveSessions()
	const session = sessions[event.target.value]
	editor.setSession(session)
})

document.querySelector("#run-button").addEventListener("click", event => {
	const sessions = saveSessions()
	const iframeElement = document.querySelector("iframe")
	const doc = iframeElement.contentWindow.document
	const css = sessions.CSS.getValue()
	const html = sessions.HTML.getValue()
	const python = sessions.Python.getValue()

	doc.documentElement.innerHTML = `
        <html>
            <head>
                <style>${css}</style>
            </head>
            <body>${html}</body>
        </html>
    `

	window.run_script(python)
})

document.querySelector("#save-button").addEventListener("click", event => {
    const sessions = saveSessions()

    const jobj = {
        css: sessions.CSS.getValue(),
        html: sessions.HTML.getValue(),
        python: sessions.Python.getValue(),
    }

    const json = JSON.stringify(jobj)
    const blob = new Blob([ json ], { type: "text/json" })
	downloadBlob(".pypad", blob)
})

document.querySelector("#load-file").addEventListener("click", event => {
    const sessions = SESSIONS
    const reader = new FileReader()

    reader.onload = function() {
        const jobj = JSON.parse(reader.result)
        sessions.CSS.setValue(jobj.css)
        sessions.HTML.setValue(jobj.html)
        sessions.Python.setValue(jobj.python)
        saveSessions()
    }

    const files = event.target.files
    if (files[0]) reader.readAsText(files[0])
})

document.querySelector("#load-button").addEventListener("click", event => {
    document.querySelector("#load-file").click()
})

document.querySelector("#export-button").addEventListener("click", async event => {
    const sessions = saveSessions()
	const css = sessions.CSS.getValue()
	const html = sessions.HTML.getValue()
	const response = await window.fetch("main.py")
	const pypadCode = await response.text()
	console.log(pypadCode)
	const python = sessions.Python.getValue()
	
	let code = `
        <html>
            <head>
				<meta charset="utf-8" />
                <style>
${css}
				</style>
				<script src="https://cdnjs.cloudflare.com/ajax/libs/brython/3.10.4/brython.min.js" integrity="sha512-Ku0Q6E6RaZsR8UNZKfm4GcC0ZXrDZyzj00pFmzR6YHoR9u1R4YuaM+Ew6hj50wtOr/lFRjTvQ7ZXJfGzbPAMDQ==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
				<script src="https://cdnjs.cloudflare.com/ajax/libs/brython/3.10.4/brython_stdlib.js" integrity="sha512-kMRN6F4Yq4sNLbPG2lH3EO9n776JHHZub+UWogDxVjh9uTnoVo3wtN/rnQD4C4/AZtqI2zQdvdouGAAxOGwNeA==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
				<script type="text/python">
${pypadCode}
${python}
				</script>
            </head>
            <body onload="brython()">
${html}
			</body>
        </html>
    `
	
	const blob = new Blob([ code ], { type: "text/html" })
	downloadBlob(".html", blob)
})

function main() {
	const projectName = document.getElementById("project-name")
	projectName.value = localStorage.getItem("pypad.project-name") || "unnamed-project"
	projectName.addEventListener("change", event => {
		localStorage.setItem("pypad.project-name", projectName.value)
	})
	editor.setSession(SESSIONS.HTML)
}

main()
