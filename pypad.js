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

editor.setSession(SESSIONS.HTML)

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
    const link = document.getElementById("save-link")
    const blob = new Blob([ json ], { type: "text/json" })
    link.href = window.URL.createObjectURL(blob)
    const today = new Date()
    const filename = `${today.getDate()}-${today.getMonth() + 1}`
    link.download = `${filename}.pypad`
    link.click()
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
