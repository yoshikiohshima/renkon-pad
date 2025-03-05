const {h, render} = import("./preact.standalone.module.js");
const {stringify, parse} = import ("./stable-stringify.js");

(() => {
    const div = document.createElement("div");
    div.innerHTML = `<div id="pad"></div>
    <div id="buttonBox">
      <button id="runButton">run</button>
      <button id="addButton">add</button>
      <button id="saveButton">save</button>
      <button id="loadButton">load</button>
    </div>
    <div id="iframeHolder">
      <iframe id="innerWindow" src="window.html"></iframe>
    </div>
    <script id="codemirror-loader" type="module">
      import {CodeMirror} from "./renkon-web.js";
debugger;
      window.CodeMirror = CodeMirror;
    </script>
`;
    console.log(div.childNodes);

    const renkon = document.querySelector("#renkon");
    renkon.querySelector("#pad")?.remove();
    renkon.querySelector("#buttonBox")?.remove();
    renkon.querySelector("#iframeHolder")?.remove();
    renkon.querySelector("#codemirror-loader")?.remove();

    renkon.appendChild(div.querySelector("#pad"));
    renkon.appendChild(div.querySelector("#buttonBox"));
    renkon.appendChild(div.querySelector("#codemirror-loader"));
//    renkon.appendChild(div.querySelector("#iframeHolder"));
})();
