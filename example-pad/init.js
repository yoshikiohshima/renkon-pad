    const {h, html, render} = import("./preact.standalone.module.js");
    const {stringify, parse} = import ("./stable-stringify.js");

    (() => {
        const renkon = document.createElement("div");
        renkon.id = "renkon";
        renkon.innerHTML = `
<div id="buttonBox">
   <button class="menuButton" id="addCodeButton">code</button>
   <button class="menuButton" id="addRunnerButton">runner</button>
   <div class="spacer"></div>
   <button class="menuButton" id="showGraph">show graph</button>
   <button class="menuButton" id="saveButton">save</button>
   <button class="menuButton" id="loadButton">load</button>
</div>
<div id="pad"></div>
<div id="overlay"></div>
`;

        document.body.querySelector("#renkon")?.remove();
        document.body.appendChild(renkon);
    })();

