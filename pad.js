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
    <div id="iframeHolder">
      <iframe id="innerWindow" src="window.html"></iframe>
    </div>
    <link id="pad-css" rel="stylesheet" href="./pad.css" />
`;
    console.log(div.childNodes);

    const renkon = document.querySelector("#renkon");
    renkon.querySelector("#pad")?.remove();
    renkon.querySelector("#buttonBox")?.remove();
    renkon.querySelector("#iframeHolder")?.remove();
    renkon.querySelector("#codemirror-loader")?.remove();
    renkon.querySelector("#pad-css")?.remove();

    renkon.appendChild(div.querySelector("#pad"));
    renkon.appendChild(div.querySelector("#buttonBox"));
    renkon.appendChild(div.querySelector("#pad-css"));
    //    renkon.appendChild(div.querySelector("#iframeHolder"));

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

    // it has <number>-(code|runner) structure.
    // You might consider having newId for number and newType separate events but make it packed
    // makes the windows and windowTypes access them from one function
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
    }

    // render.js

    const windowDOM = (id, position, title, codeEditor, type) => {
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

    const windowElements = ((windows, positions, titles, codeEditors, windowTypes) => {
        return h("div", {"class": "owner"}, windows.map((id) => {
            return windowDOM(id, positions.map.get(id), titles.map.get(id), codeEditors.map.get(id), windowTypes.map.get(id));
        }));
    })(windows, positions, titles, codeEditors, windowTypes);

    const _myRender = ((windowElements, padElement) => {
        render(windowElements, padElement);
    })(windowElements, document.querySelector("#pad"));

    /// saver.js

    const loadRequest = Events.receiver();

    const _saver = ((windows, positions, titles, codeEditors, windowTypes) => {
        const code = new Map([...codeEditors.map].filter(([_id, editor]) => editor.state).map(([id, editor]) => ([id, editor.state.doc.toString()])));
        const data = stringify({
            version: 1,
            windows,
            positions,
            titles,
            code,
            windowTypes
        });

        const div = document.createElement("a");
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(data);
        div.setAttribute("href", dataStr);
        div.setAttribute("download", `renkon-pad.json`);
        div.click();
    })(windows, positions, titles, codeEditors, windowTypes, save);

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

    // analyzer;
    const analyzed = ((codeEditors) => {
        const programState = new Renkon.constructor(0);

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
            p1 = {x: p1.x + p1.width, y: p1.y};
            p1 = {x: p1.x, y: p1.y + ind * 20 + 10};
            let p2 = positions.map.get(edge.dest);
            p2 = {x: p2.x, y: p2.y + 10};
            return line(p1, p2, "#d88", edge.id);
        });

        const inEdges = edges.edgesIn.map((edge) => {
            const exporter = analyzed.get(edge.origin);
            const ind = exporter.exports.indexOf(edge.id);
            let p1 = positions.map.get(edge.origin);
            p1 = {x: p1.x + p1.width, y: p1.y};
            p1 = {x: p1.x, y: p1.y + ind * 20 + 10};
            let p2 = positions.map.get(hoveredB);
            p2 = {x: p2.x, y: p2.y + 10};
            return line(p1, p2, "#88d", edge.id);
        });

        return html`<svg viewBox="0 0 ${window.innerWidth} ${window.innerHeight}" xmlns="http://www.w3.org/2000/svg">${outEdges}${inEdges}</svg>`;
    })(positions, analyzed, hoveredB, showGraph);

    render(graph, document.querySelector("#overlay"));

    return [];
}

/* globals Events Behaviors Renkon */
