    // [id]
    const windows = Behaviors.select(
        [],
        loadRequest, (now, data) => {
            console.log("windows loaded");
            return data.windows
        },
        Events.change(newId), (now, id) => [...now, `${id}`],
        remove, (now, removeCommand) => now.filter((e) => e != removeCommand.id),
    );

    // {id, x: number, y: number, width: number, height: number}
    const positions = Behaviors.select(
        {map: new Map()},
        loadRequest, (now, data) => {
            console.log("positions loaded");
            return data.positions
        },
        Events.change(windows), (now, command) => {
            const keys = [...now.map.keys()];
            const news = command.filter((e) => !keys.includes(e));
            const olds = keys.filter((e) => !command.includes(e));

            const newWindow = (id) => ({
                id,
                x: Number.parseInt(id) * 30,
                y:  Number.parseInt(id) * 30,
                width: 300,
                height: 200
            });

            olds.forEach((e) => now.map.delete(`${e}`));
            news.forEach((e) => now.map.set(`${e}`, newWindow(e)));
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

            for (let [id, code] of loaded.code) {
                now.map.set(id, newEditor(id, code));
            }
            return {map: now.map};
        },
        Events.change(windows), (now, command) => {
            const keys = [...now.map.keys()];
            const news = command.filter((e) => !keys.includes(e));
            const olds = keys.filter((e) => !command.includes(e));
            olds.forEach((e) => {
                const editor = now.map.get(`${e}`);
                editor.dom.remove();
                now.map.delete(`${e}`)
            });
            news.forEach((e) => now.map.set(`${e}`, newEditor(e)));
            return {map: now.map};
        }
    );

    const init = Events.change(Behaviors.keep(0));

    const newId = Behaviors.select(
        0,
        loadRequest, (now, request) => {
            return request.windows.length + 1;
        },
        Events.or(add, init), (now) => now + 1
    );

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
    }
