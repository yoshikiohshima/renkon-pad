    const loadRequest = Events.receiver();

    const _saver = ((windows, positions, zIndex, titles, windowContents, windowTypes) => {
        const code = new Map([...windowContents.map].filter(([_id, editor]) => editor.state).map(([id, editor]) => ([id, editor.state.doc.toString()])));
        const data = stringify({
            version: 1,
            windows,
            positions,
            zIndex,
            titles,
            code,
            windowTypes
        });

        const div = document.createElement("a");
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(data);
        div.setAttribute("href", dataStr);
        div.setAttribute("download", `renkon-pad.json`);
        div.click();
    })(windows, positions, zIndex, titles, windowContents, windowTypes, save);

    const _loader = (() => {
        const input = document.createElement("div");
        input.innerHTML = `<input id="imageinput" type="file" accept="application/json">`;
        const imageInput = input.firstChild;

        imageInput.onchange = () => {
            const file = imageInput.files[0];
            if (!file) {imageInput.remove(); return;}
            new Promise(resolve => {
                let reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.readAsArrayBuffer(file);
            }).then((data) => {
                const result = new TextDecoder("utf-8").decode(data);
                const loaded = parse(result);
                if (loaded.version === 1) {
                    Events.send(loadRequest, loaded);
                }
                imageInput.remove();
            });
            imageInput.value = "";
        };
        imageInput.oncancel = () => imageInput.remove();
        document.body.appendChild(imageInput);
        imageInput.click();
    })(load);

    const nameFromUrl = (() => {
        const maybeUrl = new URL(window.location).searchParams.get("file");
        if (maybeUrl) {
            return maybeUrl;
        }
        return undefined;
    })();

    const _loadFromUrl = fetch(nameFromUrl).then((resp) => resp.text()).then((text) => {
        const data = parse(text);
        Events.send(loadRequest, data);
    });
