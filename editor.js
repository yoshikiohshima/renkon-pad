function makeEditor() {
    const editorView = new EditorView({
        doc: renkon.innerHTML.trim(),
        extensions: [basicSetup, EditorView.lineWrapping],
        parent: editor,
    });
    editorView.dom.style.height = "500px";
    editorView.dom.style.width = "60vw";
    return editorView;
}
