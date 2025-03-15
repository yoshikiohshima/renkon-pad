    const rotation = (id, r, position) => {
        const s = Math.sin(r);
        const c = Math.cos(r);
        return `[id="${id}-win"] {transform: matrix(${c}, ${s}, ${-s}, ${c}, ${position.x}, ${position.y})}`;
    }

    const r = Events.timer(50) / 500;

    const rotations = windows.map((id) => rotation(id, r, positions.map.get(id)));

    ((rotations) => {
        let style = document.head.querySelector("#rotation-css");
        if (!style) {
            style = document.createElement("style");
            style.id = "rotation-css";
            document.head.appendChild(style);
        }
        style.textContent = rotations;
    })(rotations);
