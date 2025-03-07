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
