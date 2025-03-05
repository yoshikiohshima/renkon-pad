const windowDOM = (id, position, codeEditor) => {
    return h("div", {
        key: `${id}`,
        id: `${id}-win`,
        style: {
            position: "absolute",
            left: `${position.x}px`,
            top: `${position.y}px`,
            width: `${position.width}px`,
            height: `${position.height}px`,
            backgroundColor: "#ddd",
        },
        ref: (ref) => {
            if (ref) {
                ref.appendChild(codeEditor.dom);
            }
        }
    }, [
        h("div", {
            id: `${id}-titleBar`,
            "class": "titleBar",
        }, [
            h("div", {
                id: `${id}-title`,
                "class": "title",
            }),
            h("div", {
                id: `${id}-close`,
                "class": "closeButton",
                onClick: (evt) => {
                    console.log(evt);
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

const windowElements = ((windows, positions, codeEditors) => {
    return h("div", {"class": "owner"}, windows.map((id) => {
        return windowDOM(id, positions.map.get(id), codeEditors.map.get(id));
    }));
})(windows, positions, codeEditors);

const _myRender = ((windowElements, padElement) => {
    render(windowElements, padElement);
})(windowElements, document.querySelector("#pad"));


