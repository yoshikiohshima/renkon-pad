export function pad() {
    const {h, html, render} = import("./preact.standalone.module.js");
    const {stringify, parse} = import ("./stable-stringify.js");

    /*
      (() => {
    const div = document.createElement("div");
    div.innerHTML = `<div id="pad"></div>
    <div id="buttonBox">
      <button id="runButton">run</button>
      <button id="addButton">add</button>
      <button id="saveButton">save</button>
      <button id="loadButton">load</button>
    </div>
    <link id="pad-css" rel="stylesheet" href="./pad.css" />
`;
    const renkon = document.querySelector("#renkon");
    renkon.querySelector("#pad")?.remove();
    renkon.querySelector("#buttonBox")?.remove();
    renkon.querySelector("#codemirror-loader")?.remove();

    renkon.appendChild(div.querySelector("#pad"));
    renkon.appendChild(div.querySelector("#buttonBox"));
    renkon.appendChild(div.querySelector("#pad-css"));

    const script = document.createElement("script");
    script.id = "codemirror-loader"
    script.type = "module";
    script.innerText = `import {CodeMirror} from "./renkon-web.js";
      window.CodeMirror = CodeMirror;
    `;

    renkon.appendChild(script);

})();
    */

    // data.js

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

    // userActions.js

    const addCode = Events.listener("#addCodeButton", "click", () => "code");
    const addRunner = Events.listener("#addRunnerButton", "click", () => "runner");
    const save = Events.listener("#saveButton", "click", (evt) => evt);
    const load = Events.listener("#loadButton", "click", (evt) => evt);

    const showGraph = Behaviors.collect(
        true,
        Events.listener("#showGraph", "click", (evt) => evt),
        (now, _click) => !now
    );

    document.querySelector("#showGraph").textContent = showGraph ? "show graph" : "hide graph";

    const _onRun = ((runRequest, codeEditors) => {
        const id = runRequest.id;
        const iframe = codeEditors.map.get(id);
        const code = [...codeEditors.map.values()]
            .filter((obj) => obj.state)
            .map((editor) => editor.state.doc.toString());
        iframe.dom.contentWindow.postMessage({code: code});
    })(runRequest, codeEditors);

    const remove = Events.receiver();
    const titleEditChange = Events.receiver();
    const runRequest = Events.receiver();

    const padDown = Events.listener("#pad", "pointerdown", (evt) => {
        const strId = evt.target.id;
        if (!strId) {return;}
        const id = `${Number.parseInt(strId)}`;
        let type;
        if (strId.endsWith("-win")) {
            type = "moveDown";
        } else if (strId.endsWith("-resize")) {
            type = "windowResizeDown";
        }
        if (type) {
            evt.target.setPointerCapture(evt.pointerId);
            return {id, target: evt.target, type, x: evt.clientX, y: evt.clientY};
        }
    });

    const padUp = Events.listener("#pad", "pointerup", (evt) => {
        evt.target.releasePointerCapture(evt.pointerId);
        return {type: "pointerup", x: evt.clientX, y: evt.clientY};
    });

    const downOrUpOrResize = Events.or(padDown, padUp, windowResize);

    const _padMove = Events.listener("#pad", "pointermove", moveCompute);

    const windowResize = Events.receiver();
    const moveOrResize = Events.receiver();

    const moveCompute = ((downOrUpOrResize, positions) => {
        // console.log("moveCompute", downOrUpOrResize, positions);
        if (downOrUpOrResize.type === "moveDown" || downOrUpOrResize.type === "windowResizeDown") {
            const start = positions.map.get(downOrUpOrResize.id);
            const downPoint = {x: downOrUpOrResize.x, y: downOrUpOrResize.y};
            const type = downOrUpOrResize.type === "moveDown" ? "move" : "resize";
            return (move) => {
                // console.log("pointermove", downOrUpOrResize, start);
                const diffX = move.clientX - downPoint.x;
                const diffY = move.clientY - downPoint.y;
                const result = {id: downOrUpOrResize.id, type};
                if (type === "move") {
                    result.x = start.x + diffX;
                    result.y = start.y + diffY;
                } else {
                    result.width = start.width + diffX;
                    result.height = start.height + diffY;
                }
                Events.send(moveOrResize, result);
            }
        } else if (downOrUpOrResize.type === "pointerup") {
            return null;
        }
    })(downOrUpOrResize, positions);

    const inputHandler = (evt) => {
        if (evt.key === "Enter") {
            evt.preventDefault();
            evt.stopPropagation();
            Events.send(titleEditChange, {
                id: `${Number.parseInt(evt.target.id)}`,
                title: evt.target.textContent,
                state: false
            });
        }
    };

    // render.js

    const windowDOM = (id, position, zIndex, title, codeEditor, type) => {
        // console.log("windowDOM");
        return h("div", {
            key: `${id}`,
            id: `${id}-win`,
            "class": "window",
            style: {
                left: `${position.x}px`,
                top: `${position.y}px`,
                width: `${position.width}px`,
                height: `${position.height}px`,
                zIndex: `${zIndex}`,
            },
            ref: (ref) => {
                if (ref) {
                    if (ref !== codeEditor.dom.parentNode) {
                        ref.appendChild(codeEditor.dom);
                    }
                }
            },
            onPointerEnter: (evt) => Events.send(hovered, `${Number.parseInt(evt.target.id)}`),
            onPointerLeave: (_evt) => Events.send(hovered, null)
        }, [
            h("div", {
                id: `${id}-titleBar`,
                "class": "titleBar",
            }, [
                h("div", {
                    id: `${id}-runButton`,
                    "class": "titlebarButton runButton",
                    type,
                    onClick: (evt) => {
                        //console.log(evt);
                        Events.send(runRequest, {id: `${Number.parseInt(evt.target.id)}`});
                    },
                }),
                h("div", {
                    id: `${id}-title`,
                    "class": "title",
                    contentEditable: `${title.state}`,
                    onKeydown: inputHandler,
                }, title.title),
                h("div", {
                    id: `${id}-edit`,
                    "class": `titlebarButton editButton`,
                    onClick: (evt) => {
                        // console.log(evt);
                        Events.send(titleEditChange, {id: `${Number.parseInt(evt.target.id)}`, state: !title.state});
                    },
                }, []),
                h("div", {
                    id: `${id}-close`,
                    "class": "titlebarButton closeButton",
                    onClick: (evt) => {
                        Events.send(remove, {id: `${Number.parseInt(evt.target.id)}`, type: "remove"})
                    }
                }),
            ]),
            h("div", {
                id: `${id}-resize`,
                "class": "resizeHandler",
            }, [])
        ])
    };

    const windowElements = ((windows, positions, zIndex, titles, codeEditors, windowTypes) => {
        return h("div", {"class": "owner"}, windows.map((id) => {
            return windowDOM(id, positions.map.get(id), zIndex.map.get(id), titles.map.get(id), codeEditors.map.get(id), windowTypes.map.get(id));
        }));
    })(windows, positions, zIndex, titles, codeEditors, windowTypes);

    const _windowRender = render(windowElements, document.querySelector("#pad"));

    /// saver.js

    const loadRequest = Events.receiver();

    const _saver = ((windows, positions, zIndex, titles, codeEditors, windowTypes) => {
        const code = new Map([...codeEditors.map].filter(([_id, editor]) => editor.state).map(([id, editor]) => ([id, editor.state.doc.toString()])));
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
    })(windows, positions, zIndex, titles, codeEditors, windowTypes, save);

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

    // analyzer;
    const analyzed = ((codeEditors) => {
        const programState = new Renkon.constructor(0);
        programState.setLog(() => {});

        const code = [...codeEditors.map].filter(([_id, editor]) => editor.state).map(([id, editor]) => ({blockId: id, code: editor.state.doc.toString()}));
        programState.setupProgram(code);

        const nodes = new Map();
        for (let jsNode of programState.nodes.values()) {
            let ary = nodes.get(jsNode.blockId);
            if (!ary) {
                ary = [];
                nodes.set(jsNode.blockId, ary);
            }
            ary.push({inputs: jsNode.inputs, outputs: jsNode.outputs});
        }

        const exportedNames = new Map();
        const importedNames = new Map();
        for (let [id, subNodes] of nodes) {
            const exSet = new Set();
            exportedNames.set(id, exSet);

            const inSet = new Set();
            importedNames.set(id, inSet);

            for (let subNode of subNodes) {
                let outputs = subNode.outputs;
                if (outputs.length > 0 && !/^_[0-9]/.exec(outputs)) {
                    exSet.add(outputs);
                }
                for (let inString of subNode.inputs) {
                    if (!/^_[0-9]/.exec(inString)) {
                        inSet.add(inString);
                    }
                }
            }
        }

        // {edgesOut: [{id: "defined name", dest: '2'}, ...],
        //  edgesIn: [{id: "defined name", origin: '2'}, ...]}
        const edges = new Map();

        for (let [id, _] of nodes) {
            const exporteds = exportedNames.get(id);
            const importeds = importedNames.get(id);

            const edgesOut = [];
            const edgesIn = [];
            const exports = new Set();

            for (let exported of exporteds) {
                for (let [destId, destSet] of importedNames) {
                    if (destSet.has(exported) && id !== destId) {
                        edgesOut.push({id: exported, dest: destId});
                        exports.add(exported);
                    }
                }
            }
            for (let imported of importeds) {
                for (let [sourceId, sourceSet] of exportedNames) {
                    if (sourceSet.has(imported) && id !== sourceId) {
                        edgesIn.push({id: imported, origin: sourceId});
                    }
                }
            }
            edges.set(id, {edgesOut, edgesIn, exports: [...exports]});
        }

        return edges;
    })(codeEditors, hovered);

    const line = (p1, p2, color, label) => {
        let pl;
        let pr;
        if (p1.x < p2.x) {
            pl = p1;
            pr = p2;
        } else {
            pl = p2;
            pr = p1;
        }
        const c0 = `${pl.x} ${pl.y}`;
        const c1 = `${pl.x + (pr.x - pl.x) * 0.5} ${pl.y + (pr.y - pl.y) * 0.2}`;
        const c2 = `${pr.x - (pr.x - pl.x) * 0.2} ${pl.y + (pr.y - pl.y) * 0.6}`;
        const c3 = `${pr.x} ${pr.y}`;
        return html`<path d="M ${c0} C ${c1} ${c2} ${c3}" stroke="${color}" fill="transparent" stroke-width="2" stroke-linecap="round"></path><text x="${p1.x}" y="${p1.y}">${label}</text>`;
    };

    const hovered = Events.receiver();
    const hoveredB = Behaviors.keep(hovered);

    const graph = ((positions, analyzed, hoveredB, showGraph) => {
        if (hoveredB === null || !showGraph) {
            return [];
        }

        const edges = analyzed.get(hoveredB);

        if (!edges) {return [];} // runner does not have edges

        const outEdges = edges.edgesOut.map((edge) => {
            const ind = edges.exports.indexOf(edge.id);
            let p1 = positions.map.get(hoveredB);
            if (ind < -1 || !p1) {return};
            p1 = {x: p1.x + p1.width, y: p1.y};
            p1 = {x: p1.x, y: p1.y + ind * 20 + 10};
            let p2 = positions.map.get(edge.dest);
            if (!p2) {return};
            p2 = {x: p2.x, y: p2.y + 10};
            return line(p1, p2, "#d88", edge.id);
        });

        const inEdges = edges.edgesIn.map((edge) => {
            const exporter = analyzed.get(edge.origin);
            const ind = exporter.exports.indexOf(edge.id);
            let p1 = positions.map.get(edge.origin);
            if (ind < -1 || !p1) {return};
            p1 = {x: p1.x + p1.width, y: p1.y};
            p1 = {x: p1.x, y: p1.y + ind * 20 + 10};
            let p2 = positions.map.get(hoveredB);
            if (!p2) {return};
            p2 = {x: p2.x, y: p2.y + 10};
            return line(p1, p2, "#88d", edge.id);
        });

        return html`<svg viewBox="0 0 ${window.innerWidth} ${window.innerHeight}" xmlns="http://www.w3.org/2000/svg">${outEdges}${inEdges}</svg>`;
    })(positions, analyzed, hoveredB, showGraph);

    const _graphRender = render(graph, document.querySelector("#overlay"));

    // css.js

    const css = `
html, body, #renkon {
    overflow: hidden;
}

#pad {
    width: 100%;
    height: 0px;
    position: absolute;
    top: 30px;
    left: 0px;
}

.owner {
    width: 100%;
    height: 100%;
}

.editor {
    height: calc(100% - 24px);
    border-radius: 0px 0px 6px 6px;
}

#overlay {
    pointer-events: none;
    height: 100%;
    width: 100%;
    position: absolute;
    top: 30px;
    left: 0px;
    z-index: 10000;
}

.window {
    position: absolute;
    background-color: #eee;
    border-radius: 6px;
    box-shadow: inset 0 2px 2px 0 rgba(255, 255, 255, 0.8), 1px 1px 8px 0 rgba(0, 35, 46, 0.2);
}

#buttonBox {
    display: flex;
    left: 0px;
    top: 0px;
    width: 100%;
    padding-bottom: 4px;
    border-bottom: 1px solid black;
    margin-bottom: 8px;
    margin-top: 8px;
}

.spacer {
    flex-grow: 1;
}

.menuButton {
    margin-left: 4px;
    margin-right: 4px;
    border-radius: 4px;
}
		   

.runnerIframe {
    width: 100%;
    height: calc(100% - 24px);
    border-radius: 0px 0px 6px 6px;
    border: 2px solid black;
    box-sizing: border-box;
    border-radius: 0px 0px 6px 6px;
    background-color: #fff;
    user-select: none;
}

.titleBar {
    background-color: #bbb;
    pointer-events: none;
    width: 100%;
    height: 24px;
    display: flex;
    border: 2px ridge #ccc;
    box-sizing: border-box;
    border-radius: 6px 6px 0px 0px;
}

.title {
    pointer-events: none;
    margin-left: 20px;
    flex-grow: 1;
    margin-right: 20px;
    padding-left: 10px;
    pointer-events: none;
    user-select: none;
}

.title[contentEditable="true"] {
    background-color: #eee;
    pointer-events: all;
}

.titlebarButton {
    height: 17px;
    width: 17px;
    margin: 2px;
    margin-top: 2px;
    pointer-events: all;
    border-radius: 8px;
    background-position: center;
}

.titlebarButton:hover {
    background-color: #eee;
}

.closeButton {
    background-image: url("data:image/svg+xml,%3Csvg%20id%3D%22Layer_1%22%20data-name%3D%22Layer%201%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%3E%3Cpath%20d%3D%22M8.48%2C12.25C6.4%2C10.17%2C4.37%2C8.16%2C2.35%2C6.15c-.34-.34-.68-.69-1-1.05a2.34%2C2.34%2C0%2C0%2C1%2C.17-3.26%2C2.3%2C2.3%2C0%2C0%2C1%2C3.25-.09C7%2C3.93%2C9.23%2C6.14%2C11.45%2C8.34a5.83%2C5.83%2C0%2C0%2C1%2C.43.58c.36-.4.62-.71.9-1%2C2-2%2C4.12-4%2C6.12-6.08a2.51%2C2.51%2C0%2C0%2C1%2C3.41%2C0%2C2.37%2C2.37%2C0%2C0%2C1%2C0%2C3.43c-2.18%2C2.22-4.39%2C4.41-6.58%2C6.62-.11.1-.21.22-.34.35l.44.48L22.09%2C19A2.7%2C2.7%2C0%2C0%2C1%2C23%2C20.56a2.49%2C2.49%2C0%2C0%2C1-1.29%2C2.54A2.36%2C2.36%2C0%2C0%2C1%2C19%2C22.69c-2-2-4-4-6.06-6-.33-.33-.62-.68-1-1.12-1.63%2C1.66-3.17%2C3.25-4.73%2C4.82-.79.8-1.6%2C1.59-2.42%2C2.36a2.32%2C2.32%2C0%2C0%2C1-3.21-.1%2C2.3%2C2.3%2C0%2C0%2C1-.19-3.25c2.14-2.2%2C4.31-4.36%2C6.48-6.54Z%22%20fill%3D%22%234D4D4D%22%2F%3E%3C%2Fsvg%3E");
}

.editButton {
    background-image: url("data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22UTF-8%22%3F%3E%3Csvg%20width%3D%2224px%22%20height%3D%2224px%22%20viewBox%3D%220%200%2024%2024%22%20version%3D%221.1%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20xmlns%3Axlink%3D%22http%3A%2F%2Fwww.w3.org%2F1999%2Fxlink%22%3E%3C!--%20Generator%3A%20Sketch%2064%20(93537)%20-%20https%3A%2F%2Fsketch.com%20--%3E%3Ctitle%3Eicon%2Fmaterial%2Fedit%3C%2Ftitle%3E%3Cdesc%3ECreated%20with%20Sketch.%3C%2Fdesc%3E%3Cg%20id%3D%22icon%2Fmaterial%2Fedit%22%20stroke%3D%22none%22%20stroke-width%3D%221%22%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20id%3D%22ic-round-edit%22%3E%3Cg%20id%3D%22Icon%22%20fill%3D%22%234D4D4D%22%3E%3Cpath%20d%3D%22M3%2C17.46%20L3%2C20.5%20C3%2C20.78%203.22%2C21%203.5%2C21%20L6.54%2C21%20C6.67%2C21%206.8%2C20.95%206.89%2C20.85%20L17.81%2C9.94%20L14.06%2C6.19%20L3.15%2C17.1%20C3.05%2C17.2%203%2C17.32%203%2C17.46%20Z%20M20.71%2C7.04%20C20.8972281%2C6.85315541%2021.002444%2C6.59950947%2021.002444%2C6.335%20C21.002444%2C6.07049053%2020.8972281%2C5.81684459%2020.71%2C5.63%20L18.37%2C3.29%20C18.1831554%2C3.10277191%2017.9295095%2C2.99755597%2017.665%2C2.99755597%20C17.4004905%2C2.99755597%2017.1468446%2C3.10277191%2016.96%2C3.29%20L15.13%2C5.12%20L18.88%2C8.87%20L20.71%2C7.04%20Z%22%20id%3D%22Icon-Shape%22%3E%3C%2Fpath%3E%3C%2Fg%3E%3Crect%20id%3D%22ViewBox%22%20fill-rule%3D%22nonzero%22%20x%3D%220%22%20y%3D%220%22%20width%3D%2224%22%20height%3D%2224%22%3E%3C%2Frect%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E");
}

.runButton {
    background-image: url("data:image/svg+xml,%3Csvg%20id%3D%22Layer_1%22%20data-name%3D%22Layer%201%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%3E%3Cpath%20d%3D%22M12.32%2C19.94c-2.36-.11-4.67-.17-7-.34-1.91-.14-2.65-.91-2.89-2.91a29.26%2C29.26%2C0%2C0%2C1%2C.09-8.2A2.63%2C2.63%2C0%2C0%2C1%2C5.11%2C6.11%2C102.77%2C102.77%2C0%2C0%2C1%2C18.59%2C6a8.52%2C8.52%2C0%2C0%2C1%2C1.12.12C21.15%2C6.38%2C21.88%2C7.2%2C22.1%2C9A29.32%2C29.32%2C0%2C0%2C1%2C22%2C17.19a2.58%2C2.58%2C0%2C0%2C1-2.59%2C2.4C17%2C19.73%2C14.66%2C19.82%2C12.32%2C19.94Zm-2.06-4.05%2C5.29-3-5.29-3Z%22%20fill%3D%22%234D4D4D%22%2F%3E%3C%2Fsvg%3E");
    display: none;
    pointer-events: none;
}

.runButton[type="runner"] {
    display: inherit;
    pointer-events: all;
}

.resizeHandler {
    position: absolute;
    background-color: rgba(0.1, 0.1, 0.1, 0.1);
    width: 20px;
    height: 20px;
    bottom: -10px;
    right: -10px;
    border-radius: 6px;
}

.resizeHandler:hover {
    background-color: rgba(0.1, 0.4, 0.1, 0.3);
}
`;

    ((css) => {
        const renkon = document.querySelector("#renkon");
        const style = document.createElement("style");
        style.id = "pad-css";
        style.textContent = css;
        renkon.querySelector("#pad-css")?.remove();
        renkon.appendChild(style);
    })(css);

    return [];
}

/* globals Events Behaviors Renkon */
