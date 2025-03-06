    // [id:string]
    const windows = Behaviors.select(
        [],
        loadRequest, (now, data) => {
            console.log("windows loaded");
            return data.windows
        },
        newId, (now, id) => [...now, `${Number.parseInt(id)}`],
        remove, (now, removeCommand) => now.filter((e) => e != removeCommand.id),
    );

    // {map: Map<id, type:"code"|"runner">
    const windowTypes = Behaviors.select(
        {map: new Map()},
        loadRequest, (now, data) => {
            console.log("windowTypes loaded");
            return data.windowTypes;
        },
        newId, (now, spec) => {
            const index = spec.indexOf("-");
            const id = Number.parseInt(spec);
            const type = spec.slice(index + 1);
            now.map.set(`${id}`, type);
            return {map: now.map};
        },
        Events.change(windows), (now, windows) => {
            const keys = [...now.map.keys()];
            const news = windows.filter((e) => !keys.includes(e));
            const olds = keys.filter((e) => !windows.includes(e));

            olds.forEach((e) => now.map.delete(`${e}`));
            news.forEach((e) => now.map.set(`${e}`, "code"));
            return {map: now.map};
        }
    );

    // {id, x: number, y: number, width: number, height: number}
    const positions = Behaviors.select(
        {map: new Map()},
        loadRequest, (now, data) => {
            console.log("positions loaded");
            return data.positions
        },
        Events.change(windowTypes), (now, types) => {
            const keys = [...now.map.keys()];
            const typeKeys = [...types.map.keys()];
            const news = typeKeys.filter((e) => !keys.includes(e));
            const olds = keys.filter((e) => !typeKeys.includes(e));

            const newWindow = (id, type) => {
                return {
                    id,
                    x: typeKeys.length * 30,
                    y: typeKeys.length * 30 + 30,
                    width: type === "code" ? 300 : 800,
                    height: type === "code" ? 200 : 400
                }
            };

            olds.forEach((e) => now.map.delete(`${e}`));
            news.forEach((e) => now.map.set(`${e}`, newWindow(e, types.map.get(e))));
            return {map: now.map};
        },
        moveOrResize, (now, command) => {
            if (command.type === "move" || command.type === "resize") {
                const v = {...now.map.get(command.id)};
                if (command.x !== undefined) v.x = command.x;
                if (command.y !== undefined) v.y = command.y;
                if (command.width !== undefined) v.width = command.width;
                if (command.height !== undefined) v.height = command.height;
                now.map.set(command.id, v);
                return {map: now.map};
            }
            return now
        },
    );

    const titles = Behaviors.select(
        {map: new Map()},
        loadRequest, (now, loaded) => {
            console.log("titles loaded");
            return loaded.titles || {map: new Map()};
        },
        Events.change(windows), (now, command) => {
            const keys = [...now.map.keys()];
            const news = command.filter((e) => !keys.includes(e));
            const olds = keys.filter((e) => !command.includes(e));

            olds.forEach((e) => now.map.delete(`${e}`));
            news.forEach((e) => now.map.set(`${e}`, {id: `${e}`, state: false, title: "untitled"}));
            return {map: now.map};
        },
        titleEditChange, (now, change) => {
            const {id, state, title} = change;
            const v = {...now.map.get(id)};
            if (title) v.title = title;
            if (state !== undefined) v.state = state;
            now.map.set(id, v);
            return {map: now.map};
        }
    );

    const codeEditors = Behaviors.select(
        {map: new Map()},
        loadRequest, (now, loaded) => {
            for (let editor of now.map.values()) {
                editor.dom.remove();
            }
            now.map.clear();

            for (let [id, type] of loaded.windowTypes.map) {
                let elem;
                if (type === "code") {
                    elem = newEditor(id, loaded.code.get(id));
                } else {
                    elem = newRunner(id);
                }
                now.map.set(id, elem);
            }
            return {map: now.map};
        },
        Events.change(windowTypes), (now, types) => {
            const keys = [...now.map.keys()];
            const typeKeys = [...types.map.keys()];
            const news = typeKeys.filter((e) => !keys.includes(e));
            const olds = keys.filter((e) => !typeKeys.includes(e));
            olds.forEach((e) => {
                const editor = now.map.get(e);
                editor.dom.remove();
                now.map.delete(e)
            });
            news.forEach((id) => {
                const type = types.map.get(id);
                now.map.set(id, type === "code" ? newEditor(id) : newRunner(id));
            });
            return {map: now.map};
        }
    );

    const init = Events.change(Behaviors.keep("code"));

    const newId = Events.select(
        "0-code",
        loadRequest, (now, request) => {
            return `${request.windows.length + 1}-`;
        },
        Events.or(addCode, addRunner, init), (now, type) => {
            const id = Number.parseInt(now) + 1;
            return `${id}-${type}`;
        }
    );

    console.log("newId", newId);

    const newEditor = (id, doc) => {
        const mirror = window.CodeMirror;
        const editor = new mirror.EditorView({
            doc: doc || "hello",
            extensions: [
                mirror.basicSetup,
                mirror.EditorView.lineWrapping,
                mirror.EditorView.editorAttributes.of({"class": "editor"})
            ],
        });
        editor.dom.id = `${id}-editor`;
        return editor;
    };

    const newRunner = (id) => {
        const runnerIframe = document.createElement("iframe");
        runnerIframe.src = "window.html";
        runnerIframe.classList = "runnerIframe";
        runnerIframe.id = `runner-${id}`;
        return {dom: runnerIframe};
    }
