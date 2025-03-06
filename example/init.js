const {h, render} = import("./preact.standalone.module.js");
const {stringify, parse} = import("./stable-stringify.js");

(() => {
    const div = document.createElement("div");
    div.innerHTML = `
<div id="buttonBox">
   <button class="menuButton" id="addCodeButton">code</button>
   <button class="menuButton" id="addRunnerButton">runner</button>
   <div class="spacer"></div>
   <button class="menuButton" id="saveButton">save</button>
   <button class="menuButotn" id="loadButton">load</button>
</div>
<div id="pad"></div>
<link id="pad-css" rel="stylesheet" href="./pad.css" />
`.trim();
    console.log(div.childNodes);

    const renkon = document.querySelector("#renkon");
    renkon.querySelector("#pad")?.remove();
    renkon.querySelector("#buttonBox")?.remove();
    renkon.querySelector("#codemirror-loader")?.remove();
    renkon.querySelector("#pad-css")?.remove();

    renkon.appendChild(div.querySelector("#buttonBox"));
    renkon.appendChild(div.querySelector("#pad"));
    renkon.appendChild(div.querySelector("#pad-css"));
    //    renkon.appendChild(div.querySelector("#iframeHolder"));

    const script = document.createElement("script");
    script.id = "codemirror-loader"
    script.type = "module";
    script.innerText = `import {CodeMirror} from "./renkon-web.js";
      window.CodeMirror = CodeMirror;
    `;

    renkon.appendChild(script);

})();
