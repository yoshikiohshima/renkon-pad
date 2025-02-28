export function pad() {
    // [id]
    const windows = Behaviors.collect([], Events.or(Events.change(newId), remove), (now, command) => {
        if (typeof command === "number") {
            return [...now, `${command}`];
        }
        return now;
    });

    // {id, x: number, y: number, width: number, height: number}
    const positions = Behaviors.collect({map: new Map()}, Events.or(Events.change(newId), moveOrResize), (now, command) => {
        if (typeof command === "number") {
            const newWindow = (id) => ({
                id,
                x: Number.parseInt(id) * 100,
                y:  Number.parseInt(id) * 100,
                width: 200,
                height: 200
            });
            now.map.set(`${command}`, newWindow(command));
            return {map: now.map};
        } else if (command.type === "move") {
            const v = {...now.map.get(command.id)};
            v.x = command.x;
            v.y = command.y;
            now.map.set(command.id, v);
            return {map: now.map};
        }
        return now
    });

    const {h, render} = import("./preact.standalone.module.js");

    const add = Events.listener("#addButton", "click", (evt) => evt);
    const remove = Events.listener("#removeButton", "click", (evt) => evt);
    const downOrUp = Events.receiver();

    const _padDown = Events.listener("#pad", "pointerdown", (evt) => {
        if (evt.target.id) {
            const id = `${Number.parseInt(evt.target.id)}`;
            Events.send(downOrUp, {id, target: evt.target, type: "pointerdown", x: evt.clientX, y: evt.clientY});
        }
    });

    const _padUp = Events.listener("#pad", "pointerup", (evt) => {
        Events.send(downOrUp, {type: "pointerup", x: evt.clientX, y: evt.clientY});
    });

    const _padMove = Events.listener("#pad", "pointermove", moveCompute);
    const moveOrResize = Events.receiver();

    console.log("down", downOrUp);

    const init = Events.change(Behaviors.keep(0));

    const newId = Behaviors.collect(0, Events.or(add, init), (now) => now + 1);

    console.log("newId", newId);

    const moveCompute = ((downOrUp, positions) => {
        console.log("moveCompute", downOrUp, positions);
        if (downOrUp.type === "pointerdown") {
            console.log("pointerdown", downOrUp, positions);
            const start = positions.map.get(downOrUp.id);
            const downPoint = {x: downOrUp.x, y: downOrUp.y};
            return (move) => {
                // console.log("pointermove", downOrUp, start);
                Events.send(moveOrResize, {
                    id: downOrUp.id,
                    type: "move",
                    x: start.x + (move.clientX - downPoint.x),
                    y: start.y + (move.clientY - downPoint.y),
                });
            }
        }
        return null;
    })(downOrUp, $positions);

    const windowDOM = (id, position) => {
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
        },[]);
    };

    const windowElements = ((windows, positions) => {
        return h("div", {"class": "owner"}, windows.map((id) => {
            return windowDOM(id, positions.map.get(id));
        }));
    })(windows, positions);

    render(windowElements, document.querySelector("#pad"));

    return [];
}

/* globals Events Behaviors */
