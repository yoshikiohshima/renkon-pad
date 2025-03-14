    const windowDOM = (id, position, zIndex, title, windowContent, type) => {
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
                    if (ref !== windowContent.dom.parentNode) {
                        ref.appendChild(windowContent.dom);
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

    const windowElements = ((windows, positions, zIndex, titles, windowContents, windowTypes) => {
        return h("div", {"class": "owner"}, windows.map((id) => {
            return windowDOM(id, positions.map.get(id), zIndex.map.get(id), titles.map.get(id), windowContents.map.get(id), windowTypes.map.get(id));
        }));
    })(windows, positions, zIndex, titles, windowContents, windowTypes);

    const _windowRender = render(windowElements, document.querySelector("#pad"));
