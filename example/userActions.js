    const remove = Events.receiver();
    const titleEditChange = Events.receiver();

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

    console.log("newId", newId);

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

