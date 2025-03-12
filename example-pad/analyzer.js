    const analyzed = ((codeEditors, trigger) => {
        if (trigger === null) {return new Map();}
        if (typeof trigger === "object" && trigger.id) {return new Map();}
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
    })(codeEditors, Events.or(remove, hovered));

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
        return html`<path d="M ${c0} C ${c1} ${c2} ${c3}" stroke="${color}" fill="transparent" stroke-width="2" stroke-linecap="round"></path><text x="${p1.x + 5}" y="${p1.y}">${label}</text>`;
    };

    const hovered = Events.receiver();
    const hoveredB = Behaviors.keep(hovered);

    const graph = ((positions, analyzed, hoveredB, showGraph) => {
        if (hoveredB === null || !showGraph) {return [];}
        if (analyzed.size === 0) {return [];}

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

    const _graphRender = render(graph, document.querySelector("#overlay"));
