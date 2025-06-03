const r = Events.timer(50) / 100;

const rotation = (id, r, position) => `[id="${id}-win"] {transform: rotate(${r}deg)}`;

const rotations = windows.map((id) => rotation(id, r, positions.map.get(id))).join("\n");

((rotations) => {
    let style = document.head.querySelector("#rotation-css");
    if (!style) {
        style = document.createElement("style");
        style.id = "rotation-css";
        document.head.appendChild(style);
    }
    style.textContent = rotations;
})(rotations);
