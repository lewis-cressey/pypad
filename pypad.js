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

const pageTitle = getParameter("prj", "unnamed-project")
const EditSession = require("ace/edit_session").EditSession;
ace.config.set("basePath", "https://cdnjs.cloudflare.com/ajax/libs/ace/1.4.13/")
let editor = ace.edit("editor");
document.querySelector("#project-input").value = pageTitle

function createSessions(sessionTitles) {
	const sessions = {}
	
	for (let sessionTitle of Object.keys(sessionTitles)) {
		const session = new EditSession("")
		const lang = sessionTitles[sessionTitle]
		session.setMode(`ace/mode/${lang}`)
		session.setValue(localStorage.getItem(`${pageTitle}.${sessionTitle}`) || "")
		sessions[sessionTitle] = session
	}

	return sessions
}

function saveSessions(sessions) {
	for (let sessionTitle of Object.keys(sessions)) {
		const session = sessions[sessionTitle]
		const text = session.getValue()
		localStorage.setItem(`${pageTitle}.${sessionTitle}`, text)
	}
}

const SESSIONS = createSessions({
	"HTML" : "html",
	"CSS" : "css",
	"Python" : "python",	
})
editor.setSession(SESSIONS.HTML)			

document.querySelector("#file-select").addEventListener("change", event => {
	const session = SESSIONS[event.target.value]
	editor.setSession(session)
})

document.querySelector("#html-button").addEventListener("click", event => {
	saveSessions(SESSIONS)

	const iframeElement = document.querySelector("iframe")
	const doc = iframeElement.contentWindow.document
	
	const css = SESSIONS.CSS.getValue()
	const html = SESSIONS.HTML.getValue()
	
	doc.querySelector("head").innerHTML = `<style>${css}</style>`
	doc.querySelector("body").innerHTML = html
})

document.querySelector("#python-button").addEventListener("click", event => {
	saveSessions(SESSIONS)

	const python = SESSIONS.Python.getValue()
	window.run_script(python)
})
