    const addCode = Events.listener("#addCodeButton", "click", () => "code");
    const addRunner = Events.listener("#addRunnerButton", "click", () => "runner");
    const save = Events.listener("#saveButton", "click", (evt) => evt);
    const load = Events.listener("#loadButton", "click", (evt) => evt);

    const _onRun = ((runRequest, codeEditors) => {
        const id = runRequest.id;
        const iframe = codeEditors.map.get(id);
        const code = [...codeEditors.map.values()]
            .filter((obj) => obj.state)
            .map((editor) => editor.state.doc.toString());
        iframe.dom.contentWindow.postMessage({code: code});
    })(runRequest, codeEditors);

