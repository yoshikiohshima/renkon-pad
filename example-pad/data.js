    // [id:string]
    const windows = Behaviors.select(
        [],
        loadRequest, (now, data) => {
            console.log("windows loaded");
            return data.windows
        },
        newWindowRequest, (now, spec) => [...now, `${spec.id}`],
        remove, (now, removeCommand) => now.filter((e) => e != removeCommand.id),
    );

    // {map: Map<id, type:"code"|"runner">
    const windowTypes = Behaviors.select(
        {map: new Map()},
        loadRequest, (now, data) => {
            console.log("windowTypes loaded");
            return data.windowTypes;
        },
        newWindowRequest, (now, spec) => {
            now.map.set(`${spec.id}`, spec.type);
            return {map: now.map};
        },
        Events.change(windows), (now, windows) => {
            const keys = [...now.map.keys()];
            const news = windows.filter((e) => !keys.includes(e));
            const olds = keys.filter((e) => !windows.includes(e));

            olds.forEach((id) => now.map.delete(`${id}`));
            news.forEach((id) => now.map.set(`${id}`, "code"));
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
            olds.forEach((id) => now.map.delete(`${id}`));
            news.forEach((id) => now.map.set(`${id}`, newWindow(id, types.map.get(id))));
            return {map: now.map};
        },
        moveOrResize, (now, command) => {
            if (command.type === "move" || command.type === "resize") {
                const v = {...now.map.get(command.id), ...command};
                v.width = Math.max(120, v.width);
                v.height = Math.max(120, v.height);
                now.map.set(command.id, v);
                return {map: now.map};
            }
            return now;
        },
    );

    const findMax = (map)  => {
        let maxId = -1;
        let max = -1;
        for (let [id, value] of map) {
            if (value > max) {
                maxId = id;
                max = value;
            }
        }
        return {maxId, max};
    };

    const zIndex = Behaviors.select(
        {map: new Map()},
        loadRequest, (now, data) => {
            console.log("zIndex loaded");
            if (data.zIndex) return data.zIndex;
            return {map: new Map(data.windows.map((w, i) => [w, i + 100]))};
        },
        Events.change(windows), (now, command) => {
            const keys = [...now.map.keys()];
            const news = command.filter((e) => !keys.includes(e));
            const olds = keys.filter((e) => !command.includes(e));

            const {maxId:_maxId, max} = findMax(now.map);
            let z = max < 0 ? 100 : max + 1;
            olds.forEach((id) => now.map.delete(id));
            news.forEach((id) => now.map.set(id, z++));
            return {map: now.map};
        },
        moveOrResize, (now, command) => {
            if (command.type === "move") {
                const z = now.map.get(command.id);

                const {maxId, max} = findMax(now.map);
                if (maxId !== command.id) {
                    now.map.set(maxId, z);
                    now.map.set(command.id, max);
                }
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

            olds.forEach((id) => now.map.delete(id));
            news.forEach((id) => now.map.set(id, {id, state: false, title: "untitled"}));
            return {map: now.map};
        },
        titleEditChange, (now, change) => {
            const id = change.id;
            const v = {...now.map.get(id), ...change};
            now.map.set(id, v);
            return {map: now.map};
        }
    );

    const windowContents = Behaviors.select(
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
            olds.forEach((id) => {
                const editor = now.map.get(id);
                editor.dom.remove();
                now.map.delete(id)
            });
            news.forEach((id) => {
                const type = types.map.get(id);
                now.map.set(id, type === "code" ? newEditor(id) : newRunner(id));
            });
            return {map: now.map};
        }
    );

    const init = Events.once("code");

    const newId = Events.select(
        0,
        loadRequest, (now, request) => {
            const max = Math.max(...request.windows.map((w) => Number.parseInt(w)));
            return max;
        },
        Events.or(addCode, addRunner, init), (now, _type) => now + 1
    );

    const newWindowRequest = Events.change({id: newId, type: Events.or(addCode, addRunner, init)});

    const newEditor = (id, doc) => {
        const mirror = window.CodeMirror;
        const editor = new mirror.EditorView({
            doc: doc || `console.log("hello")`,
            extensions: [
                mirror.basicSetup,
                mirror.EditorView.lineWrapping,
                mirror.EditorView.editorAttributes.of({"class": "editor"}),
                mirror.keymap.of([mirror.indentWithTab])
            ],
        });
        editor.dom.id = `${id}-editor`;
        return editor;
    };

    const newRunner = (id) => {
        const runnerIframe = document.createElement("iframe");
        runnerIframe.srcdoc = `
<!DOCTYPE html>
<html>
    <head>
        <meta charset="utf-8">
    </head>
    <body>
        <div id="renkon">
        </div>
        <script type="module">
            import {ProgramState, CodeMirror} from "./renkon-web.js";
            window.thisProgramState = new ProgramState(0);
            window.CodeMirror = CodeMirror;

            window.onmessage = (evt) => {
                if (evt.data && Array.isArray(evt.data.code)) {
                    window.thisProgramState.updateProgram(evt.data.code, evt.data.path);
                    if (window.thisProgramState.evaluatorRunning === 0) {
                        window.thisProgramState.evaluator();
                    }
                }
            };
        </script>
    </body>
</html>`;
        runnerIframe.classList = "runnerIframe";
        runnerIframe.id = `runner-${id}`;
        return {dom: runnerIframe};
    };
