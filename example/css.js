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
