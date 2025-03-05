const run = Events.listener("#runButton", "click", (evt) => evt);
const add = Events.listener("#addButton", "click", (evt) => evt);
const save = Events.listener("#saveButton", "click", (evt) => evt);
const load = Events.listener("#loadButton", "click", (evt) => evt);

const _onRun = ((run, codeEditors) => {
    const innerIframe = document.querySelector("#innerWindow");
    const code = [...codeEditors.map.values()].map((editor) => editor.state.doc.toString());
    console.log(code);
    innerIframe.contentWindow.postMessage({code: code});
})(run, codeEditors);

