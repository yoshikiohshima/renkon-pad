// -*- mode: javascript; js-indent-level: 2 ; -*-
export function pad() {
// Initialization

const {h, html, render} = import("./preact.standalone.module.js");

const renkon = (() => {
  const renkon = document.createElement("div");
  renkon.id = "renkon";
  renkon.innerHTML = `
<div id="buttonBox">
  <input class="menuButton" id="padTitle"></input>
  <button class="menuButton" id="addCodeButton">code</button>
  <button class="menuButton" id="addDocButton">doc</button>
  <button class="menuButton" id="addRunnerButton">runner</button>
  <div class="spacer"></div>
  <button class="menuButton" id="searchButton">search</button>
  <button class="menuButton" id="showGraph">show graph</button>
  <button class="menuButton" id="saveButton">save</button>
  <button class="menuButton" id="loadButton">load</button>
</div>
<div id="pad"><div id="mover"></div></div>
<div id="overlay"></div>
<div id="navigationBox">
  <div class="navigationButton"><div id="homeButton" class="navigationButtonImage"></div></div>
  <div class="navigationButton with-border"><div id="zoomInButton" class="navigationButtonImage"></div></div>
  <div class="navigationButton with-border"><div id="zoomOutButton" class="navigationButtonImage"></div></div>
</div>

`.trim();

  document.body.querySelector("#renkon")?.remove();
  document.body.appendChild(renkon);
  return renkon;
})();

const searchPanel = ((renkon) => {
  let search = renkon.querySelector("#search");
  search?.remove();
  const div = document.createElement("div");
  div.innerHTML = `
<div class="search-panels search-panels-bottom" style="bottom: 0px;">
  <div class="search-search search-panel">
    <input value="" placeholder="Find" aria-label="Find" class="search-textfield" name="search" form="" main-field="true">
    <button class="search-button" name="next" type="button">next</button>
    <!-- <button class="search-button" name="prev" type="button">previous</button>
    <button class="search-button" name="select" type="button">all</button> -->
    <label><input type="checkbox" name="case" form="">match case</label>
    <label><input type="checkbox" name="re" form="">regexp</label>
    <label><input type="checkbox" name="word" form="">by word</label>
    <!-- <input value="" placeholder="Replace" aria-label="Replace" class="search-textfield" name="replace" form="">
    <button class="search-button" name="replace" type="button">replace</button>
    <button class="search-button" name="replaceAll" type="button">replace all</button> -->
    <button name="close" aria-label="close" type="button">×</button>
  </div>
</div>
`.trim();
  search = div.childNodes[0];
  search.id = "search";
  renkon.appendChild(search);
  return search;
})(renkon);

// Runner

const newRunner = (id) => {
  const runnerIframe = document.createElement("iframe");
  runnerIframe.srcdoc = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <style>
      .dock {
        position: fixed;
        top: 0px;
        right: 0px;
        width: 35%;
        height: 80%;
        display: flex;
        box-shadow: 10px 10px 5px #4d4d4d, -10px -10px 5px #dddddd;
        transition: left 0.5s;
        background-color: white;
        z-index: 1000000;
        overflow-y: scroll;
      }

      .dock #inspector {
        flex-grow: 1;
        margin: 0px 20px 0px 20px;
        background-color: #ffffff;
        border: 1px solid black;
      }
    </style>
    <script type="module">
      import {ProgramState, CodeMirror, newInspector} from "./renkon-web.js";
      window.thisProgramState = new ProgramState(Date.now());
      window.CodeMirror = CodeMirror;
      window.newInspector = newInspector;

      window.onmessage = (evt) => {
        if (evt.data && Array.isArray(evt.data.code)) {
          window.thisProgramState.updateProgram(evt.data.code, evt.data.path);
        }
        if (evt.data && typeof evt.data.inspector === "boolean") {
          if (window.thisProgramState) {
            if (document.body.querySelector(".dock")) {
              document.body.querySelector(".dock").remove();
              return;
            }
            const dock = document.createElement("div");
            dock.classList.add("dock");
            const dom = document.createElement("div");
            dom.id = "renkonInspector";

            dock.appendChild(dom);
            document.body.appendChild(dock);
            const result = thisProgramState.order.map((id) => [
                id + " (" + thisProgramState.types.get(id) + ")",
                thisProgramState.resolved.get(id)]);
            dom.addEventListener('contextmenu', event => {
              event.preventDefault(); event.stopPropagation();}, {capture: true});
            dom.addEventListener('pointerup', event => {
              if (event.button !== 0) {
                function findFieldElem(elem) {
                  while (elem) {
                    if (elem.classList?.contains("observablehq--field")) {return elem;}
                    elem = elem.parentNode;
                  }
                }
                const fieldElem = findFieldElem(event.target);
                if (!fieldElem) {return;}
                const key = fieldElem.querySelector(".observablehq--key");
                if (!key) {return;}
                const text = key.textContent;
                const match = /(.*)\\W(Behavior|Event)\\W/.exec(text);
                if (!match) {return;}
                const keyName = match[1].trim();
                console.log(window.thisProgramState.resolved.get(keyName)?.value);
              }
            });
            newInspector(Object.fromEntries(result), dom);
          }
        }
      };

      window.parent.postMessage({ready: "renkon-ready", type: "runner", id: "${id}"});
    </script>
  </head>
  <body></body>
</html>`.trim();
  runnerIframe.classList = "runnerIframe";
  runnerIframe.id = `runner-${id}`;
  return {dom: runnerIframe};
};

// Code Mirror Editor

const goToVarName = Events.receiver();

const gotoDef = ((varName, windowContents) => {
  const editorsPair = [...windowContents.map].filter(([_id, content]) => content.state);

  for (const [id, content] of editorsPair) {
    try {
      const decls = Renkon.findDecls(content.state.doc.toString());
      for (const decl of decls) {
        if (decl.decls.includes(varName)) {
          return {id, range: {from: decl.start, to: decl.end}, shown: true};
        }
      }
    } catch(e) {
      console.log("Dependency analyzer encountered an error in source code:");
    }
  }
  return undefined;
})(goToVarName, windowContents);

const gotoTarget = Events.or(gotoDef, updateEditorSelection);

const allUseOf = (varName) => {
  const programState = new Renkon.constructor(0);
  programState.setLog(() => {});

  // There should be a better way... But this function is used in the function that computes
  // windowContents so there is a cyclic dependency
  const windowContents = Renkon.resolved.get("windowContents").value.map;

  const editorsPair = [...windowContents].filter(([_id, content]) => content.state);
  const uses = [];
  for (const [_id, content] of editorsPair) {
    try {
      const doc = content.state.doc.toString();
      const decls = programState.findDecls([doc]);
      for (const decl of decls) {
        programState.setupProgram([doc.slice(decl.start, decl.end)]);
        for (const jsNode of programState.nodes.values()) {
          for (const input of jsNode.inputs) {
            if (/^_[0-9]/.test(input)) {continue;}
            if (input === varName) {
              uses.push(...decl.decls);
            }
          }
        }
      }
    } catch (e) {
      console.log("Dependency analyzer encountered an error in source code:");
      return [];
    }
  }
  return uses;
};

const newEditor = (id, doc) => {
  const mirror = window.CodeMirror;

  const config = {
    // eslint configuration
    languageOptions: {
      globals: mirror.globals,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
      },
    },
    rules: {
    },
  };

  const getDecl = (state, pos) => {
    const showDependency = Renkon.resolved.get("showGraph")?.value;
    if (!showDependency || showDependency !== "showDeps") {return;}
    let decls;
    try {
      decls = Renkon.findDecls(state.doc.toString());
    } catch(e) {
      console.log("Dependency analyzer encountered an error in source code:");
      return;
    }
    const head = pos !== undefined ? pos : state.selection.ranges[0]?.head;
    if (typeof head !== "number") {return;}
    const decl = decls.find((d) => d.start <= head && head < d.end);
    if (!decl) {return;}
    const programState = new Renkon.constructor(0);
    programState.setLog(() => {});
    try {
      programState.setupProgram([decl.code]);
    } catch (e) {
      console.log("could not find the declarations as there is a syntax error");
      return;
    }
    const keys = [...programState.nodes.keys()];
    const last = keys[keys.length - 1];
    const deps = [];
    for (const k of keys) {
      const is = programState.nodes.get(k).inputs;
      deps.push(...is.filter((n) => !/_[0-9]/.exec(n)));
    }

    return {deps, name: last}
  }
  const wordHover = hoverTooltip((view, pos, _side) => {
    let node = getDecl(view.state, pos);
    if (!node) return null;
    const {deps, name} = node;
    const uses = allUseOf(name);
    return {
      pos,
      above: true,
      create() {
        let dom = document.createElement("div");
        let children = deps.map((d) => {
          const c = document.createElement("span");
          c.textContent = d;
          c.onclick = (_evt) => Events.send(goToVarName, c.textContent);
          c.style.width = "fitContent";
          c.style.height = "fitContent";
          c.classList.add("dependency-link");
          return c;
        });
        children.forEach((c, i) => {
          dom.appendChild(c);
          if (i !== children.length - 1) {
            const comma = document.createElement("span");
            comma.textContent = ", ";
            dom.appendChild(comma);
          }
        });
        let tail = document.createElement("span");
        tail.textContent = ` -> ${name} -> `;
        dom.appendChild(tail);

        children = uses.map((d) => {
          const c = document.createElement("span");
          c.textContent = d;
          c.onclick = (_evt) => Events.send(goToVarName, c.textContent);
          c.style.width = "fitContent";
          c.style.height = "fitContent";
          c.classList.add("dependency-link");
          return c;
        });
        children.forEach((c, i) => {
          dom.appendChild(c);
          if (i !== children.length - 1) {
            const comma = document.createElement("span");
            comma.textContent = ", ";
            dom.appendChild(comma);
          }
        });

        dom.className = "cm-tooltip-dependency cm-tooltip-cursor-wide";
        return {dom};
      }
    };
  }, {hoverTime: 1000, hideOnChange: true});

  const openSearch = ({_state, _dispatch }) => {
    Events.send(toggleSearchPanel, true);
    return true;
  };

  const search = {key: "Mod-f", run: openSearch, shift: openSearch};

  const cursorChange = mirror.view.ViewPlugin.fromClass(class {
    update(update) {
      if (update.selectionSet || update.docChanged) {
        this.reportCursor(update.view);
      }
    }

    reportCursor(view) {
      const pos = view.state.selection.main.head;
      Events.send(cursorChanged, {id: id, position: pos});
    }
  });

  const editor = new mirror.EditorView({
    doc: doc || `console.log("hello")`,
    extensions: [
      mirror.view.keymap.of([search]),
      mirror.basicSetup,
      mirror["lang-javascript"].javascript({typescript: true}),
      mirror.EditorView.lineWrapping,
      mirror.EditorView.editorAttributes.of({"class": "editor"}),
      mirror.view.keymap.of([mirror.commands.indentWithTab]),
      mirror.lint.linter(
        mirror["lang-javascript"]
          .esLint(new mirror["eslint-linter-browserify"].Linter(), config)),
      wordHover,
      cursorChange,
    ],
  });
  editor.dom.id = `${id}-editor`;
  return editor;
};

// CodeMirror HoverPlugin

function hoverTooltip(source, options = {}) {
  let setHover = window.CodeMirror.state.StateEffect.define();
  let hoverState = window.CodeMirror.state.StateField.define({
    create() {
      return null;
    },
    update(value, tr) {
      for (let effect of tr.effects) {
        if (effect.is(setHover)) {
          // console.log("effect", effect)
          return effect.value;
        }
      }
    }
  })
  return {
    hoverState: hoverState,
    extension: [
      hoverState,
      window.CodeMirror.view.ViewPlugin.define(view => new DependencyPlugin(view, source, setHover, hoverState, {hoverTime: options.hoverTime || 300})),
    ]
  }
}

class DependencyPlugin {
  constructor(view, source, setHover, hoverState, options) {
    this.view = view;
    this.source = source;
    this.setHover = setHover;
    this.hoverState = hoverState;
    this.options = options;
    this.lastMove = {x: 0, y: 0, target: view.dom, time: 0};
    view.dom.addEventListener("mouseleave", this.mouseleave = this.mouseleave.bind(this));
    view.dom.addEventListener("mousemove", this.mousemove = this.mousemove.bind(this));
    this.hoverTimeout = -1;
    this.hoverTime = options.hoverTime;
  }

  checkHover() {
    this.hoverTimeout = -1;
    if (this.tooltip) return;
    let hovered = Date.now() - this.lastMove.time;
    if (hovered < this.hoverTime) {
      this.hoverTimeout = setTimeout(() => this.checkHover(), this.hoverTime - hovered);
    } else {
      this.startHover();
    }
  }

  startHover() {
    clearTimeout(this.restartTimeout);
    let {view, lastMove} = this;
    let desc = view.docView.nearest(lastMove.target);
    if (!desc) return;
    let pos = view.posAtCoords(lastMove);

    if (pos === null) return;
    const posCoords = view.coordsAtPos(pos);
    if (!posCoords ||
      lastMove.y < posCoords.top || lastMove.y > posCoords.bottom ||
      lastMove.x < posCoords.left - view.defaultCharacterWidth ||
      lastMove.x > posCoords.right + view.defaultCharacterWidth) return;

    const line = view.state.doc.lineAt(pos);

    if (!this.tooltip) {
      const rect = view.dom.getBoundingClientRect();
      let scaleX = rect.width / view.dom.offsetWidth;
      let scaleY = rect.height / view.dom.offsetHeight;
      const tip = this.source(view, pos, 1);
      if (!tip) {return;}
      this.tooltip = tip.create();
      this.tooltip.dom.style.position = "absolute";
      this.tooltip.dom.classList.add("cm-tooltip-hover");
      this.tooltip.dom.classList.add("cm-tooltip-above");
      this.tooltip.dom.style.left = `${(posCoords.left - rect.left) / scaleX}px`;
      this.tooltip.dom.style.top = `${(posCoords.top - rect.top) / scaleY}px`;
      view.dom.appendChild(this.tooltip.dom);
      this.tooltipPos = {pos, posCoords, line};
      view.dispatch({effects: this.setHover.of({tooltip: this.tooltip, tooltipPos: this.tooltipPos})});
    }
  }

  endHover() {
    this.hoverTimeout = -1;
    if (this.tooltip) {
      this.tooltip.dom?.remove();
      this.tooltip = null;
      this.tooltipPos = null;
      // this.view.dispatch({effects: this.setHover.of(null)});
    }
  }

  update(update) {
    if (update.docChanged) {
      this.endHover();
    }
  }

  isInTooltip(tooltip, event) {
    const tooltipMargin = 4;
    let { left, right, top: top2, bottom } = tooltip.getBoundingClientRect();
    return event.clientX >= left - tooltipMargin &&
      event.clientX <= right + tooltipMargin &&
      event.clientY >= top2 - tooltipMargin &&
      event.clientY <= bottom + tooltipMargin;
  }

  distance(pos, move) {
    return Math.sqrt((pos.left - move.x) ** 2 + (pos.top - move.y) ** 2);
  }

  mousemove(event) {
    this.lastMove = {x: event.clientX, y: event.clientY, target: event.target, time: Date.now()};
    const view = this.view;
    if (this.hoverTimeout < 0) {
      this.hoverTimeout = setTimeout(() => this.checkHover(), this.hoverTime)
    }
    if (this.tooltip && !this.isInTooltip(this.tooltip.dom, event)) {
      const pos = view.posAtCoords(this.lastMove);
      if (pos) {
        const lastPos = this.tooltipPos;
        const line = view.state.doc.lineAt(pos);
        if (this.distance(lastPos.posCoords, this.lastMove) > 30 || lastPos.line.number !== line.number) {
          this.endHover();
        }
      }
    }
  }

  mouseleave(event) {
    clearTimeout(this.hoverTimeout);
    this.hoverTimeout = -1;
    let inTooltip = this.tooltip && this.tooltip.dom.contains(event.relatedTarget);
    if (!inTooltip) {
      this.endHover();
    } else {
      this.watchTooltipLeave(this.tooltip.dom);
    }
  }

  watchTooltipLeave(tooltip) {
    let watch = (event) => {
      tooltip.removeEventListener("mouseleave", watch);
    }
    tooltip.addEventListener("mouseleave", watch);
  }

  destroy() {
    this.endHover();
    clearTimeout(this.hoverTimeout);
    this.view.dom.removeEventListener("mouseleave", this.mouseleave);
    this.view.dom.removeEventListener("mousemove", this.mousemove);
  }
}

// Data Structure

// [id:string]
const windows = Behaviors.select(
  [`${initialData.id}`],
  loadRequest, (_prev, data) => {
    return data.windows
  },
  newWindowRequest, (prev, spec) => [...prev, `${spec.id}`],
  remove, (prev, removeCommand) => prev.filter((e) => e != removeCommand.id),
);

// {map: Map<id, type:"code"|"doc"|"runner">
const windowTypes = Behaviors.select(
  {map: new Map()},
  loadRequest, (_prev, data) => {
    return data.windowTypes;
  },
  newWindowRequest, (prev, spec) => {
    prev.map.set(`${spec.id}`, spec.type);
    return {map: prev.map};
  },
  windows, (prev, windows) => {
    const keys = [...prev.map.keys()];
    const news = windows.filter((e) => !keys.includes(e));
    const olds = keys.filter((e) => !windows.includes(e));

    olds.forEach((id) => prev.map.delete(`${id}`));
    news.forEach((id) => prev.map.set(`${id}`, "code"));
    return {map: prev.map};
  }
);

// [id, {id, x: number, y: number, width: number, height: number}]
const positions = Behaviors.select(
  {map: new Map()},
  loadRequest, (_prev, data) => {
    return data.positions;
  },
  windowTypes, (prev, types) => {
    const keys = [...prev.map.keys()];
    const typeKeys = [...types.map.keys()];
    const news = typeKeys.filter((e) => !keys.includes(e));
    const olds = keys.filter((e) => !typeKeys.includes(e));

    const newX = (typeKeys.length * 5 + 40) / padView.scale - padView.x;
    const newY = (typeKeys.length * 5 + 45) / padView.scale - padView.y;

    const newWindow = (id, type) => {
      return {
        id,
        x: newX,
        y: newY,
        width: type === "code" ? 300 : 800,
        height: type === "code" ? 200 : 400
      }
    };
    olds.forEach((id) => prev.map.delete(`${id}`));
    news.forEach((id) => prev.map.set(`${id}`, newWindow(id, types.map.get(id))));
    return {map: prev.map};
  },
  moveOrResize, (prev, command) => {
    const v = {...prev.map.get(command.id), ...command};
    prev.map.set(command.id, v);
    return {map: prev.map};
  }
);

const pinnedPositions = Behaviors.select(
  {map: new Map()},
  loadRequest, (_prev, _data) => {
    return {map: new Map()}
  },
  pinRequest, (prev, pinRequest) => {
    const {id} = pinRequest;
    if (prev.map.get(id)) {
      prev.map.delete(id);
      return {map: prev.map};
    }

    const position = positions.map.get(id);
    const screenRect = {
      height: position.height * padView.scale,
      width: position.width * padView.scale,
      x: (position.x + padView.x) * padView.scale,
      y: (position.y + padView.y) * padView.scale,
      scale: padView.scale
    };
    prev.map.set(id, screenRect);
    return {map: prev.map};
  },
  windowTypes, (prev, types) => {
    const keys = [...prev.map.keys()];
    const typeKeys = [...types.map.keys()];
    const olds = keys.filter((e) => !typeKeys.includes(e));
    olds.forEach((id) => prev.map.delete(`${id}`));
    return {map: prev.map};
  },
  home, (_prev, _home) => {
    return {map: new Map()}
  }
)

const findMax = (map)  => {
  let maxId = -1;
  let max = -1;
  for (let [id, value] of map) {
    if (value > max) {
      maxId = id;
      max = value;
    }
  }
  return {maxId, max};
};

const zIndex = Behaviors.select(
  {map: new Map()},
  loadRequest, (_prev, data) => {
    if (data.zIndex) return data.zIndex;
    return {map: new Map(data.windows.map((w, i) => [w, i + 100]))};
  },
  windows, (prev, command) => {
    const keys = [...prev.map.keys()];
    const news = command.filter((e) => !keys.includes(e));
    const olds = keys.filter((e) => !command.includes(e));

    const {maxId:_maxId, max} = findMax(prev.map);
    let z = max < 0 ? 100 : max + 1;
    olds.forEach((id) => prev.map.delete(id));
    news.forEach((id) => prev.map.set(id, z++));
    return {map: prev.map};
  },
  moveOrResize, (prev, command) => {
    if (command.type === "move") {
      const z = prev.map.get(command.id);

      const {maxId, max} = findMax(prev.map);
      if (maxId !== command.id) {
        prev.map.set(maxId, z);
        prev.map.set(command.id, max);
      }
      return {map: prev.map};
    }
    return prev;
  },
);

const titles = Behaviors.select(
  {map: new Map()},
  loadRequest, (_prev, loaded) => {
    return loaded.titles || {map: new Map()};
  },
  windows, (prev, command) => {
    const keys = [...prev.map.keys()];
    const news = command.filter((e) => !keys.includes(e));
    const olds = keys.filter((e) => !command.includes(e));

    olds.forEach((id) => prev.map.delete(id));
    news.forEach((id) => prev.map.set(id, {id, state: false, title: "untitled"}));
    return {map: prev.map};
  },
  titleEditChange, (prev, change) => {
    const id = change.id;
    const v = {...prev.map.get(id), ...change};
    prev.map.set(id, v);
    return {map: prev.map};
  }
);

const windowEnabled = Behaviors.select(
  {map: new Map()},
  loadRequest, (_prev, loaded) => {
    return loaded.windowEnabled || {map: new Map()};
  },
  windows, (prev, command) => {
    const keys = [...prev.map.keys()];
    const news = command.filter((e) => !keys.includes(e));
    const olds = keys.filter((e) => !command.includes(e));

    olds.forEach((id) => prev.map.delete(id));
    news.forEach((id) => prev.map.set(id, {id, enabled: true}));
    return {map: prev.map};
  },
  enabledChange, (prev, change) => {
    const id = change.id;
    const v = {...prev.map.get(id), ...change};
    prev.map.set(id, v);
    return {map: prev.map};
  }
);

const windowContents = Behaviors.select(
  {map: new Map()},
  loadRequest, (prev, loaded) => {
    for (let editor of prev.map.values()) {
      editor.dom.remove();
    }
    prev.map.clear();

    for (let [id, type] of loaded.windowTypes.map) {
      let elem;
      if (type === "runner") {
        elem = newRunner(id)
      } else if (type === "doc") {
        elem = newDocPane(id, loaded.code.get(id));
      } else {
        elem = newEditor(id, loaded.code.get(id));
      }
      prev.map.set(id, elem);
    }
    return {map: prev.map};
  },
  windowTypes, (prev, types) => {
    const keys = [...prev.map.keys()];
    const typeKeys = [...types.map.keys()];
    const news = typeKeys.filter((e) => !keys.includes(e));
    const olds = keys.filter((e) => !typeKeys.includes(e));
    olds.forEach((id) => {
      const editor = prev.map.get(id);
      editor.dom.remove();
      prev.map.delete(id)
    });
    news.forEach((id) => {
      const type = types.map.get(id);
      let elem;
      if (type === "runner") {
        elem = newRunner(id);
      } else if (type === "doc") {
        elem = newDocPane(id ,"");
      } else {
        elem = newEditor(id);
      }
      prev.map.set(id, elem);
    });
    return {map: prev.map};
  },
  docUpdate, (prev, docUpdate) => {
    const {id, code} = docUpdate;
    let elem = prev.map.get(id);
    if (!elem) {return prev;}
    elem.doc = code;
    return {map: prev.map};
  },
  resetRequest, (prev, resetRequest) => {
    const id = resetRequest.id;
    prev.map.set(id, newRunner(id));
    return {map: prev.map};
  }
);

const initialData = {id: 0, type: "code"};

const newId = Behaviors.select(
  0,
  loadRequest, (_prev, request) => {
    if (request.windows.length === 0) {return 1;}
    const max = Math.max(...request.windows.map((w) => Number.parseInt(w)));
    return max;
  },
  Events.or(addCode, addRunner, addDoc), (prev, _type) => prev + 1
);

const newWindowRequest = {id: newId, type: Events.or(addCode, addRunner, addDoc)};

const modifierState = Behaviors.select(
  {shiftKey: false, ctrlKey: false, metaKey: false, scrollDirection: null},
  // scrollDirection: null|"vertical"|"horizontal"
  queuedKeydown, (prev, keydown) => {
    const ret = {...prev};
    keydown.forEach((key) => {
      ret.shiftKey = ret.shiftKey || key.key === "Shift";
      ret.ctrlKey = ret.ctrlKey || key.key === "Control";
      ret.metaKey = ret.metaKey || key.key === "Meta";
    });
    return ret;
  },
  queuedKeyup, (prev, keyup) => {
    const ret = {...prev};
    let reset = false;
    keyup.forEach((key) => {
      reset = reset || ["Shift", "Control", "Meta"].includes(key.key);
      if (key.key === "Shift") {ret.shiftKey = false;}
      if (key.key === "Control") {ret.ctrlKey = false;}
      if (key.key === "Meta") {ret.metaKey = false;}
    });
    if (reset) {ret.scrollDirection = null;}
    return ret;
  },
  wheeling, (prev, wheeling) => {
    if (prev.scrollDirection === null && wheeling.scrollDirection) {
      const ret = {...prev};
      ret.scrollDirection = wheeling.scrollDirection;
      return ret;
    }
    return prev;
  }
);

const padView = Behaviors.select(
  {x: 0, y: 0, scale: 1},
  padViewChange, (prev, view) => {
    let {x, y, scale, force} = view;
    if (!force) {
      if (scale < 0.1) {
        x = prev.x;
        y = prev.y;
        scale = 0.1;
      }
      if (scale > 20) {
        x = prev.x;
        y = prev.y;
        scale = 20;
      }
    }
    return {...prev, ...{x, y, scale}};
  }
);

const padTitle = Behaviors.select(
  "untitled",
  loadRequest, (_prev, data) => {
    return data.padTitle || "untitled"
  },
  titleChange, (_prev, request) => request
);

const titleChange = Events.observe((notify) => {
  const change = (evt) => {
    notify(evt.target.value);
  };

  renkon.querySelector("#padTitle").addEventListener("input", change);
  return () => {renkon.querySelector("#padTitle").removeEventListener("change", change);}
});

const _padTitleUpdater = ((padTitle) => {
  if (renkon.querySelector("#padTitle").value !== padTitle) {
    renkon.querySelector("#padTitle").value = padTitle;
  }
})(padTitle);

const _focus = ((renkon) => {
  renkon.querySelector("#padTitle").focus();
  renkon.querySelector("#padTitle").blur();
})(renkon);

const readyMessages = Events.listener(
  window,
  "message",
  evt => {
    if (typeof evt.data.ready === "string" && evt.data.ready.startsWith("renkon-ready")) {
      return evt;
    }
  }, {queued: true});

// User Interaction

const addCode = Events.listener(renkon.querySelector("#addCodeButton"), "click", () => "code");
const addRunner = Events.listener(renkon.querySelector("#addRunnerButton"), "click", () => "runner");
const addDoc = Events.listener(renkon.querySelector("#addDocButton"), "click", () => "doc");
const save = Events.listener(renkon.querySelector("#saveButton"), "click", (evt) => evt);
const load = Events.listener(renkon.querySelector("#loadButton"), "click", (evt) => evt);
const search = Events.listener(renkon.querySelector("#searchButton"), "click", (evt) => evt);

const home = Events.listener(renkon.querySelector("#homeButton"), "click", () => "home");
const zoomIn = Events.listener(renkon.querySelector("#zoomInButton"), "click", () => "zoomIn");
const zoomOut = Events.listener(renkon.querySelector("#zoomOutButton"), "click", () => "zoomOut");

const homeUponLoad = ((_positions, _loadRequest) => "home")(positions, loadRequest);

const navigationAction = Events.or(home, zoomIn, zoomOut, homeUponLoad);

const padViewChange = Events.receiver();
const wheeling = Events.receiver();

const queuedKeydown = Events.listener(document.body, "keydown", evt => evt, {queued: true});
const queuedKeyup = Events.listener(document.body, "keyup", evt => evt, {queued: true});

const _padViewUpdate = ((padView) => {
  const mover = document.querySelector("#mover");
  const pad = document.querySelector("#pad");
  mover.style.setProperty("transform", `scale(${padView.scale}) translate(${padView.x}px, ${padView.y}px)`);

  pad.style.setProperty("background-position", `${padView.x * padView.scale}px ${padView.y * padView.scale}px`);
  pad.style.setProperty("background-size", `${64 * padView.scale}px ${64 * padView.scale}px`);
})(padView);

const wheel = Events.listener(renkon.querySelector("#pad"), "wheel", (evt) => {
  let pinch;
  if (isSafari) {
    pinch = (Number.isInteger(evt.deltaX) && !Number.isInteger(evt.deltaY)) || evt.metaKey;
  } else {
    pinch = evt.ctrlKey || evt.metaKey;
  }
  const strId = evt.target.id;
  if (pinch) {
    evt.preventDefault();
    if (strId === "pad") {
      evt.stopPropagation();
    }
  }
  return evt;
});

const _handleWheel = ((wheel, padView, modifierState) => {
  let pinch;
  if (isSafari) {
    pinch = (Number.isInteger(wheel.deltaX) && !Number.isInteger(wheel.deltaY)) || wheel.metaKey;
  } else {
    pinch = wheel.ctrlKey || wheel.metaKey;
  }

  const shiftKey = modifierState.shiftKey;
  const scrollDirection = modifierState.scrollDirection;
  const strId = wheel.target.id;

  let deltaX = wheel.deltaX;
  let deltaY = wheel.deltaY;
  let zoom = padView.scale;

  let absDeltaY = Math.min(30, Math.abs(deltaY));
  let diff = Math.sign(deltaY) * absDeltaY;

  let desiredZoom = zoom * (1 - diff / 50);

  const xInMover = (wheel.clientX / padView.scale) - padView.x;
  const newX = wheel.clientX / desiredZoom - xInMover;

  const yInMover = (wheel.clientY / padView.scale) - padView.y;
  const newY = wheel.clientY / desiredZoom - yInMover;

  if (scrollDirection === null && shiftKey) {
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      Events.send(wheeling, {scrollDirection: "horizontal"});
      deltaY = 0;
    } else {
      Events.send(wheeling, {scrollDirection: "vertical"});
      deltaX = 0;
    }
  } else if (scrollDirection !== null && shiftKey) {
    if (scrollDirection === "vertical") {
      deltaX = 0;
    }
    if (scrollDirection === "horizontal") {
      deltaY = 0;
    }
  }

  if (pinch) {
    Events.send(padViewChange, {x: newX, y: newY, scale: desiredZoom});
  } else {
    if (strId === "pad") {
      Events.send(padViewChange, {x: padView.x - deltaX / padView.scale,
                                  y: padView.y - deltaY / padView.scale, scale: padView.scale});
    }
  }
})(wheel, padView, modifierState);

Events.listener(renkon.querySelector("#buttonBox"), "wheel", preventDefault);
Events.listener(renkon.querySelector("#navigationBox"), "wheel", preventDefault);

Events.listener(document.body, "gesturestart", preventDefaultSafari);
Events.listener(document.body, "gesturechange", preventDefaultSafari);
Events.listener(document.body, "gestureend", preventDefaultSafari);

const isSafari = window.navigator.userAgent.includes("Safari") && !window.navigator.userAgent.includes("Chrome");
const isMobile = !!("ontouchstart" in window);

const pointercancel = Events.listener(renkon.querySelector("#pad"), "pointercancel", pointerLost);
const lostpointercapture = Events.listener(renkon.querySelector("#pad"), "lostpointercapture", pointerLost);

const preventDefault = (evt) => {
  evt.preventDefault();
  return evt;
};

const preventDefaultSafari = (evt) => {
  if (!isSafari || isMobile) {
    evt.preventDefault();
  }
  return evt;
};

const pointerLost = (evt) => {
  evCache.clear();
  evt.preventDefault();
  return {type: "lost"};
};

const _handleNavigationAction = ((navigationAction, positions, padView) => {
  if (navigationAction === "zoomIn" || navigationAction === "zoomOut") {
    const pad = document.body.querySelector("#pad").getBoundingClientRect();
    const newScale = padView.scale * ( navigationAction === "zoomIn" ? 1.1 : 0.9);
    const centerX = pad.width / 2 / padView.scale - padView.x;
    const centerY = pad.height / 2 / padView.scale - padView.y;
    const newX = pad.width / 2 / newScale - centerX;
    const newY = pad.height / 2 / newScale - centerY;
    // const newX = (padView.x - (pad.width / 2)) * (newScale / padView.scale) + pad.width / 2;
    // const newY = (padView.y - (pad.height / 2)) * (newScale / padView.scale) + pad.height / 2;
    Events.send(padViewChange, {x: newX, y: newY, scale: newScale});
  } else if (navigationAction === "home") {
    let minLeft = Number.MAX_VALUE;
    let minTop = Number.MAX_VALUE;
    let maxRight = Number.MIN_VALUE;
    let maxBottom = Number.MIN_VALUE;

    if (positions.map.size === 0) {
      Events.send(padViewChange, {x: 0, y: 0, scale: 1});
      return;
    }
    for (let [_, position] of positions.map) {
      minLeft = Math.min(position.x, minLeft);
      minTop = Math.min(position.y, minTop);
      maxRight = Math.max(position.x + position.width, maxRight);
      maxBottom = Math.max(position.y + position.height, maxBottom);
    }

    const pad = document.body.querySelector("#pad").getBoundingClientRect();

    const scaleX = pad.width / (maxRight - minLeft);
    const scaleY = pad.height / (maxBottom - minTop);
    const scale = Math.min(1, scaleX, scaleY) * 0.9;

    const centerX = (maxRight + minLeft) / 2;
    const centerY = (maxBottom + minTop) / 2;
    let x = (pad.width / 2 / scale - centerX);
    let y = (pad.height / 2 / scale - centerY);
    Events.send(padViewChange, {x, y, scale, force: true});
  }
})(navigationAction, positions, padView);

const showGraph = Behaviors.collect(
  "showDeps",
  Events.listener(renkon.querySelector("#showGraph"), "click", (evt) => evt),
  (now, _click) => {
    if (now === "showGraph") {return "hide";}
    if (now === "showDeps") {return "showGraph";}
    if (now === "hide") {return "showDeps"}
    return now;
  }
);

((showGraph) => {
  let str;
  if (showGraph === "showGraph") {str = "show graph";}
  if (showGraph === "showDeps") {str = "show deps";}
  if (showGraph === "hide") {str = "hide graph"}
  document.querySelector("#showGraph").textContent = str;
})(showGraph);

const _onRun = ((runRequest, windowContents, windowEnabled) => {
  const id = runRequest.id;
  const iframe = windowContents.map.get(id);
  const code = [...windowContents.map]
    .filter(([id, obj]) => obj.state && windowEnabled.map.get(id).enabled)
    .map(([_id, editor]) => editor.state.doc.toString());
  iframe.dom.contentWindow.postMessage({code: code, path: id});
})(runRequest, windowContents, windowEnabled);

const resetHandler = Events.select(
  {},
  resetRequest, (prev, reset) => {
    if (prev.ready) {
      if (prev.ready.includes(reset.id)) {
        Events.send(doReset, reset);
        return {};
      }
    }
    return {resetRequest: reset};
  },
  readyMessages, (prev, ready) => {
    const readyIds = ready.map((r) => r.data.id);
    if (prev.resetRequest) {
      if (readyIds.includes(prev.resetRequest.id)) {
        Events.send(doReset, prev.resetRequest);
      }
    }
    return {};
  },
  windowContents, (_prev, _win) => ({})
);

const doReset = Events.receiver();

const _onReset = Events.send(runRequest, doReset);

const _onInspect = ((inspectRequest) => {
  const id = inspectRequest.id;
  const iframe = windowContents.map.get(id);
  iframe.dom.contentWindow.postMessage({inspector: true, path: id});
})(inspectRequest);

const remove = Events.receiver();
const titleEditChange = Events.receiver();
const enabledChange = Events.receiver();
const pinRequest = Events.receiver();
const runRequest = Events.receiver();
const resetRequest = Events.receiver();
const inspectRequest = Events.receiver();

const _goTo = ((padView, positions, dblClick) => {
  const strId = dblClick.target.id;
  if (!strId.endsWith("-titleBar")) {return;}
  const id = Number.parseInt(strId);
  const position = positions.map.get(`${id}`);

  const pad = document.body.querySelector("#pad").getBoundingClientRect();

  const scaleX = pad.width / position.width;
  const scaleY = pad.height / position.height;
  const scale = Math.min(scaleX, scaleY) * 0.95;

  const centerX = position.x + position.width / 2;
  const centerY = position.y + position.height / 2;

  const x = pad.width / 2 / scale - centerX;
  const y = pad.height / 2 / scale - centerY;

  Events.send(padViewChange, {x, y, scale});
})(padView, positions, dblClick);

// Pointer Handling

const dblClick = Events.listener(renkon.querySelector("#pad"), "dblclick", (evt) => evt);

const rawPadDown = Events.listener(renkon.querySelector("#pad"), "pointerdown", (evt) => {
  const strId = evt.target.id;
  if (strId.endsWith("-title") && (evt.target.getAttribute("contenteditable") === "true")) {
    return evt;
  }
  if (strId) {
    evt.preventDefault();
    evt.stopPropagation();
  }
  return evt;
}, {queued: true});

// this is an odd ball that gets mutated by padDownState and padUp
const evCache = new Map();

const padDown = Events.collect(undefined, rawPadDown, (old, evts) => {
  let type;
  let id;
  let corner;
  if (evts.length <= 2 && evts[0].isPrimary) {
    let primary = evts[0];
    const strId = primary.target.id;
    if (!strId) {return {...old, type: ""};}
    let x = primary.clientX;
    let y = primary.clientY;
    if (strId === "pad") {
      type = "padDragDown";
      id = strId;
    } else {
      id = `${Number.parseInt(strId)}`;
      if (strId.endsWith("-titleBar")) {
        type = "moveDown";
      } else if (strId.endsWith("-resize")) {
        corner = (/[0-9]+-(.*)-resize/.exec(strId))[1];
        type = "windowResizeDown";
      }
    }
    if (type) {
      primary.target.setPointerCapture(primary.pointerId);
      if (strId === "pad") {
        evCache.set("primary", {x, y});
      }
      if (evts.length === 1) {
        return {
          id, target: primary.target, type, x: primary.clientX, y: primary.clientY, corner
        };
      }
    } else {
      return {...old, type: ""};
    }
  }

  let secondary;
  if (evCache.get("primary")) {
    if (evts.length === 1 && evCache.size === 1 && !evts[0].isPrimary) {
      secondary = evts[0];
    }
    if (evts.length === 2 && evCache.size === 1 && !evts[1].isPrimary) {
      secondary = evts[1];
    }
  }
  if (!secondary) {return old;}

  const strId = secondary.target.id;
  if (strId !== "pad") {return {type: "stuck", secondary: secondary.pointerId};}
  let primary =  evCache.get("primary");
  let x = secondary.clientX;
  let y = secondary.clientY;
  let dx = primary.x - secondary.clientX;
  let dy = primary.y - secondary.clientY;
  let origDiff = Math.sqrt(dx * dx + dy * dy);
  evCache.set(secondary.pointerId, {origDiff, origScale: padView.scale, x, y});
  return {type: "pinch", secondary: secondary.pointerId};
});

const padUp = Events.listener(renkon.querySelector("#pad"), "pointerup", (evt) => {
  // console.log("ev1", evCache);
  evt.target.releasePointerCapture(evt.pointerId);
  evCache.clear();
  // console.log("ev2", evCache);
  return {type: "pointerup", x: evt.clientX, y: evt.clientY};
});

const downOrUpOrResize = Events.or(padDown, padUp, pointercancel, lostpointercapture, windowResize);

const _padMove = Events.listener("#pad", "pointermove", moveCompute);

const windowResize = Events.receiver();
const moveOrResize = Events.receiver();

const moveCompute = ((downOrUpOrResize, positions, padView) => {
  if (downOrUpOrResize.type === "moveDown" || downOrUpOrResize.type === "windowResizeDown") {
    const start = positions.map.get(downOrUpOrResize.id);
    const scale = padView.scale;
    const downPoint = {x: downOrUpOrResize.x, y: downOrUpOrResize.y};
    const type = downOrUpOrResize.type === "moveDown" ? "move" : "resize";
    return (move) => {
      const diffX = (move.clientX - downPoint.x) / scale;
      const diffY = (move.clientY - downPoint.y) / scale;
      const result = {id: downOrUpOrResize.id, type};
      // const position = positions.map.get(downOrUpOrResize.id);
      if (type === "move") {
        if (pinnedPositions.map.get(downOrUpOrResize.id)) {return move;}
        result.x = start.x + diffX;
        result.y = start.y + diffY;
      } else {
        if (downOrUpOrResize.corner === "bottomRight") {
          const realDiffX = start.width + diffX < 120 ? 120 - start.width : diffX;
          const realDiffY = start.height + diffY < 70 ? 70 - start.height : diffY;
          result.width = start.width + realDiffX;
          result.height = start.height + realDiffY;
        } else if (downOrUpOrResize.corner === "topLeft") {
          const realDiffX = start.width - diffX < 120 ? start.width - 120 : diffX;
          const realDiffY = start.height - diffY < 70 ? start.height - 70 : diffY;
          result.width = start.width - realDiffX;
          result.height = start.height - realDiffY;
          result.x = start.x + realDiffX;
          result.y = start.y + realDiffY;
        } else if (downOrUpOrResize.corner === "topRight") {
          const realDiffX = start.width + diffX < 120 ? 120 - start.width : diffX;
          const realDiffY = start.height - diffY < 70 ? start.height - 70 : diffY;
          result.width = start.width + realDiffX;
          result.height = start.height - realDiffY;
          result.y = start.y + realDiffY;
        } else if (downOrUpOrResize.corner === "bottomLeft") {
          const realDiffX = start.width - diffX < 120 ? start.width - 120 : diffX;
          const realDiffY = start.height + diffY < 70 ? 70 - start.height : diffY;
          result.width = start.width - realDiffX;
          result.height = start.height + realDiffY;
          result.x = start.x + realDiffX;
        }
      }
      Events.send(moveOrResize, result);
      return move;
    }
  } else if (downOrUpOrResize.type === "padDragDown") {
    const start = padView;
    const scale = start.scale;
    const downPoint = {x: downOrUpOrResize.x, y: downOrUpOrResize.y};
    const type = "padDrag";
    return (move) => {
      const diffX = move.clientX - downPoint.x;
      const diffY = move.clientY - downPoint.y;
      const result = {id: downOrUpOrResize.id, type, scale};
      result.x = start.x + (diffX / scale);
      result.y = start.y + (diffY / scale);
      Events.send(padViewChange, result);
      return move;
    };
  } else if (downOrUpOrResize.type === "pinch") {
    return (move) => {
      const keys = [...evCache.keys()];
      const primary = evCache.get("primary");
      if (!primary) {
        // the first finger has been lifted
        return move;
      }
      const otherKey = keys.find((k) => k !== "primary");
      const secondary = evCache.get(otherKey);
      const isPrimary = move.isPrimary;

      if (isPrimary) {
        const newRecord = {...primary};
        newRecord.x = move.clientX;
        newRecord.y = move.clientY;
        evCache.set("primary", newRecord);
      } else {
        const newRecord = {...secondary};
        newRecord.x = move.clientX;
        newRecord.y = move.clientY;
        evCache.set(otherKey, newRecord);
      }

      const origDiff = secondary.origDiff;
      const origScale = secondary.origScale;

      const pX = isPrimary ? move.clientX : primary.x;
      const pY = isPrimary ? move.clientY : primary.y;

      const sX = isPrimary ? secondary.x : move.clientX;
      const sY = isPrimary ? secondary.y : move.clientY;

      const newDiff = Math.sqrt((pX - sX) ** 2 + (pY - sY) ** 2);

      const newScale = (newDiff / origDiff) * origScale;

      const newCenterX = (pX - sX) / 2 + sX;
      const newCenterY = (pY - sY) / 2 + sY;

      const xInMover = (newCenterX / padView.scale) - padView.x;
      const newX = newCenterX / newScale - xInMover;

      const yInMover = (newCenterY / padView.scale) - padView.y;
      const newY = newCenterY / newScale - yInMover;

      Events.send(padViewChange, {x: newX, y: newY, scale: newScale});
      return move;
    }
  } else if (["pointerup", "lost", "stuck"].includes(downOrUpOrResize.type)) {
    return (move) => move;
  }
})(downOrUpOrResize, positions, padView);

// Search

const searchRequest = Events.receiver();
const searchUpdate = Events.receiver();
const toggleSearchPanel = Events.receiver();
const cursorChanged = Events.receiver();

const cursorState = Behaviors.select(
  {map: new Map()},
  cursorChanged, (prev, cursorChanged) => {
    const id = cursorChanged.id;
    const entry = prev.map.get(id);
    if (!entry || entry.position !== cursorChanged.position) {
      prev.map.set(id, cursorChanged);
      return {map: prev.map, change: id};
    }
    return prev;
  }
);

const searchState = Behaviors.select(
  {id: null, range: null, shown: false}, // id: string, editor: EditorView, range: {from: number, to: number}
  search, (prev, _search) => ({id: prev.id, editor: prev.editor, range: prev.range, shown: !prev.shown}),
  toggleSearchPanel, (prev, panelState) => ({id: prev.id, editor: prev.editor, range: prev.range, shown: panelState}),
  searchUpdate, (prev, searchUpdate) => searchUpdate,
  cursorState, (prev, cursorState) => {
    if (cursorState.change) {
      const cursor = cursorState.map.get(cursorState.change);
      return {
        id: cursorState.change,
        range: {from: cursor.position, to: cursor.position},
        shown: prev.shown}
    }
    return prev;
  }
);

const _searchHandler = Events.listener(searchPanel.querySelector(`input[name="search"]`), "keydown", searchInputHandler);
const _searchNext = Events.listener(searchPanel.querySelector(`button[name="next"]`), "click", searchNextHandler);
const _searchClose = Events.listener(searchPanel.querySelector(`button[name="close"]`), "click", searchCloseHandler);

const searchInputHandler = (evt) => {
  if (evt.key === "Enter") {
    evt.preventDefault();
    evt.stopPropagation();
    const searchRequest = getSearchRequest(evt.target.parentNode);
    if (searchRequest) {
      Events.send(searchRequest, searchRequest);
    }
  }
};

const searchNextHandler = (evt) => {
  const searchRequest = getSearchRequest(evt.target.parentNode);
  if (searchRequest) {
    Events.send(searchRequest, searchRequest);
  }
};

const searchCloseHandler = (_evt) => {
  Events.send(toggleSearchPanel, false);
};

const getSearchRequest = (searchPanel) => {
  const field = searchPanel.querySelector(`input[name="search"]`);
  const search = field?.value;
  const caseSensitive = searchPanel.querySelector(`input[name="case"]`)?.checked;
  const regexp = searchPanel.querySelector(`input[name="re"]`)?.checked;
  const wholeWord = searchPanel.querySelector(`input[name="word"]`)?.checked;
  if (search) {
    return {search, caseSensitive, regexp, wholeWord};
  }
  return null;
}

const _searchFieldUpdate = ((searchState) => {
  const searchField = renkon.querySelector("#search");
  if (!searchField) {return;}
  const oldStyle = searchField.style.display;
  const newStyle = searchState.shown ? "inherit" : "none";
  searchField.style.display = newStyle;
  if (newStyle !== oldStyle && newStyle === "inherit") {
    searchField.querySelector(`input[name="search"]`).focus();
  }
})(searchState);

renkon.querySelector("#search") && (renkon.querySelector("#search").style.display = searchState.shown ? "inherit" : "none");

((searchRequest, windowContents, searchState) => {
  const mirror = window.CodeMirror;
  const editorsPair = [...windowContents.map].filter(([_id, content]) => content.state)
  const query = new mirror.search.SearchQuery(searchRequest);
  const startEditorIndex = editorsPair.findIndex((e) => e[0] === searchState.id);
  let found = null;

  for (let i = startEditorIndex <= 0 ? 0 : startEditorIndex; i < editorsPair.length; i++) {
    const myRangeStart = startEditorIndex >= 0 && i === startEditorIndex ? searchState.range.to : 0;
    const targetPair = editorsPair[i];
    const cursor = query.getCursor(targetPair[1].state, myRangeStart);
    cursor.next();
    if (!cursor.done) {
      found = {id: targetPair[0], range: {from: cursor.value.from, to: cursor.value.to}, shown: true};
      break;
    }
  }
  if (found) {
    Events.send(searchUpdate, found);
  } else {
    Events.send(searchUpdate, {id: null, range: null, shown: true});
  }
})(searchRequest, windowContents, searchState)

const updateEditorSelection = ((searchUpdate, windowContents) => {
  if (!searchUpdate.id || !searchUpdate.range) {return;}
  const editor = windowContents.map.get(searchUpdate.id);
  const scrollIntoView = editor.scrollDOM.scrollHeight > editor.scrollDOM.clientHeight;
  editor.dispatch({
    changes: [], // no text change
    selection: {anchor: searchUpdate.range.from, head: searchUpdate.range.to},
    scrollIntoView: scrollIntoView,
  });
  editor.focus();
  return searchUpdate;
})(searchUpdate, windowContents);

const _scrollToEditorPosition = ((padView, positions, gotoTarget, windowContents) => {
  const pad = document.body.querySelector("#pad").getBoundingClientRect();

  const visiblePad = {
    x: -padView.x,
    y: -padView.y,
    width: pad.width / padView.scale,
    height: pad.height / padView.scale
  };
  const position = positions.map.get(`${gotoTarget.id}`);

  const allVisible = position.x >= visiblePad.x && position.y >= visiblePad.y &&
        position.width + position.x <= visiblePad.x + visiblePad.width &&
        position.height + position.y <= visiblePad.y + visiblePad.height;

  if (allVisible) {return;}
  const editor = windowContents.map.get(gotoTarget.id);

  const textPos = editor.coordsAtPos(gotoTarget.range.from);
  if (!textPos) {return;}
  const scrollRect = editor.scrollDOM.getBoundingClientRect();
  const top = textPos.top - scrollRect.top + editor.scrollDOM.scrollTop;
  const targetY = position.y + top / padView.scale;
  let x = -position.x + 30;
  let y = padView.y;
  if (targetY < visiblePad.y) {
    y = -targetY + 50 / padView.scale;
  } else if (targetY - 50 > visiblePad.y + visiblePad.height) {
    y = -targetY + visiblePad.height / 2 / padView.scale;
  }

  Events.send(padViewChange, {x: x, y: y, scale: padView.scale})
})(padView, positions, gotoTarget, windowContents);

const searchCSS = `
.search-panels {
  position: absolute;
  top: 40px;
  right: 10px;
  background-color: #f5f5f5;
  color: black;
  display: none;
  max-height: 30px;
}
    
.search-panels[open="true"] {
  display: inherit;
}
    
.search-panels-bottom {
  border-top: 1px solid #ddd;
}
    
.search-search {
  padding: 2px 6px 4px;
}
    
.search-search input, .search-search button, .search-search label {
  margin: .2em .6em .2em 0;
}

.search-textfield {
  background-color: white;
}

.search-textfield {
  vertical-align: middle;
  color: inherit;
  font-size: 70%;
  border: 1px solid silver;
  padding: .2em .5em;
}
    
.search-button {
  background-image: linear-gradient(#eff1f5, #d9d9df);
  border: 1px solid #888;
}

.search-button {
  vertical-align: middle;
  color: inherit;
  font-size: 70%;
  padding: .2em 1em;
  border-radius: 1px;
}
    
.search-search label {
  font-size: 80%;
  white-space: pre;
}
    
.search-search button[name="close"] {
  background-color: inherit;
  border: none;
  font: inherit;
  padding: 0;
  margin: 0;
}
    
.search-search button[name="close"]:hover {
  background-color: #eee;
}
`.trim();

((css, renkon) => {
  const style = document.createElement("style");
  style.id = "search-css";
  style.textContent = css;
  renkon.querySelector("#search-css")?.remove();
  renkon.appendChild(style);
})(searchCSS, renkon);

// Rendering

const inputHandler = (evt) => {
  if (evt.key === "Enter") {
    evt.preventDefault();
    evt.stopPropagation();
    Events.send(titleEditChange, {
      id: `${Number.parseInt(evt.target.id)}`,
      title: evt.target.textContent,
      state: false
    });
    evt.target.textContent = "";
  }
};

const playDown = Events.receiver();
const dismissDelayedButton = Events.receiver();
const playLeave = Events.receiver();
const playUp = Events.receiver();

const playClickHandler = (evt, delayed) => {
  if (delayed) {
    return;
  }
  Events.send(runRequest, {id: `${Number.parseInt(evt.target.id)}`});
}

const playDownHandler = (evt) => {
  evt.stopPropagation();
  if (evt.isPrimary) {
    evt.target.setPointerCapture(evt.pointerId);
  }
  Events.send(playDown, evt);
};


const playUpHandler = (evt) => {
  evt.target.releasePointerCapture(evt.pointerId);
  // console.log(evt.target.id, evt.currentTarget.id)
  Events.send(playUp, evt);
};

const playLeaveHandler = (evt) => {
  // console.log("leave");
  // evt.target.releasePointerCapture(evt.pointerId);
  Events.send(playLeave, evt);
};

const resetRunnerHandler = (evt) => {
  // console.log("reset")
  Events.send(dismissDelayedButton, evt.target.id);
  Events.send(resetRequest, {id: `${Number.parseInt(evt.target.id)}`});
}

const delayedPlayDown = Events.delay(playDown, 500);

const delayedButtonJudge = Events.select(
  {result: null, queue: []},
  playDown, (_prev, down) => ({result: null, queue: [down]}),
  playUp, (prev, up) => ({result: prev.result, queue: [up]}),
  playLeave, (prev, leave) => ({result: prev.result, queue: [...prev.queue, leave]}),
  delayedPlayDown, (prev, down) => {
    if (prev.queue.length === 0) return [];
    if (prev.queue.length === 1) {
      if (prev.queue[0] === down) {return {result: down, queue: [down]};}
      return {result: null, queue: []}
    }
    if ([prev.length - 1].type === "pointerup") {return {result: null, queue: []};}
    if ([prev.length - 1].type === "pointerleave") {return prev;}
  },
  dismissDelayedButton, (_prev, _dismiss) => ({result: null, queue: []})
);

const delayed = Behaviors.select(
  null,
  Events.or(delayedButtonJudge), (_prev, judge) => {
    const evt = judge.result;
    if (evt && evt.type === "pointerdown") {
      evt.target.releasePointerCapture(evt.pointerId);
      return `${Number.parseInt(evt.target.id)}`;
    }
    return null;
  },
  playUp, (prev, _evt) => {return prev},
  playLeave, (prev, _evt) => {return prev}
)

const _positionsCss = ((positions, zIndex, pinnedPositions, padView) => {
  let style = document.body.querySelector("#positions-css");
  if (!style) {
    style = document.createElement("style");
    style.id = "positions-css";
    document.body.appendChild(style);
  }

  const css = [...positions.map].map(([id, rect]) => {
    let x;
    let y;
    let scale;
    const pinned = pinnedPositions.map.get(id);
    if (!pinned) {
      x = rect.x;
      y = rect.y;
      scale = 1;
    } else {
      // t(x) = pinned.x
      // t(a) = a * padView.scale + padView.x;
      // x * padView.scale + padView.x = pinned.x;
      // x = pinned.x / padView.scale - padView.x;
      scale = pinned.scale / padView.scale;
      x = pinned.x / padView.scale - padView.x;
      y = pinned.y / padView.scale - padView.y;
      // console.log(pinned.x, scale, x, padView.x);
    }
    return `
[id="${id}-win"] {
    transform: translate(${x}px, ${y}px) scale(${scale});
    width: ${rect.width}px;
    height: ${rect.height}px;
    z-index: ${zIndex.map.get(id)};
}`.trim();
  }).join("\n");
  style.textContent = css;
})(positions, zIndex, pinnedPositions, padView);

const windowDOM = (id, title, windowContent, type, windowEnabled, pinnedPosition, delayed) => {
  return h("div", {
    key: `${id}`,
    id: `${id}-win`,
    "class": "window",
    pinned: !!pinnedPosition,
    ref: (ref) => {
      if (ref) {
        const holder = ref.querySelector(".windowHolder");
        if (holder.firstChild && holder.firstChild !== windowContent.dom) {
          holder.firstChild.remove();
        }
        if (holder !== windowContent.dom.parentNode) {
          holder.appendChild(windowContent.dom);
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
        id: `${id}-enabledButton`,
        disabled: !!(windowEnabled && !windowEnabled.enabled),
        style: {
          display: `${type !== "code" ? "none" : "inheirt"}`
        },
        "class": "titlebarButton enabledButton",
        onClick: (evt) => {
          Events.send(enabledChange, {
            id: `${Number.parseInt(evt.target.id)}`,
            enabled: !windowEnabled || !windowEnabled.enabled});
        },
      }),
      h("div", {
        id: `${id}-runButtonContainer`,
        "class": "runButtonContainer",
      }, [
        h("div", {
          id: `${id}-runButton`,
          "class": "titlebarButton runButtonBackground runButton",
          type,
          onClick: (evt) => playClickHandler(evt, delayed),
          onPointerDown: playDownHandler,
          onPointerUp: playUpHandler,
          onPointerLeave: playLeaveHandler,
        }),
        h("div", {
          id: `${id}-runButton2`,
          "class": "titlebarButton resetButton runButton2",
          type,
          delayed: delayed === id,
          onPoionterUp: resetRunnerHandler,
          onClick: resetRunnerHandler,
        })
      ]),
      h("div", {
        id: `${id}-inspectorButton`,
        "class": "titlebarButton inspectorButton",
        type,
        onClick: (evt) => {
          Events.send(inspectRequest, {id: `${Number.parseInt(evt.target.id)}`});
        },
      }),
      h("div", {
        id: `${id}-title`,
        "class": "title",
        contentEditable: `${title.state}`,
        onKeydown: inputHandler,
      }, title.title),
      h("div", {
        id: `${id}-titleSpacer`,
        "class": "titleSpacer",
      }),
      h("div", {
        id: `${id}-edit`,
        "class": `titlebarButton editButton`,
        onClick: (evt) => {
          // console.log(evt);
          Events.send(titleEditChange, {id: `${Number.parseInt(evt.target.id)}`, state: !title.state});
        },
      }, []),
      h("div", {
        id: `${id}-pin`,
        "class": "titlebarButton pinButton",
        state: pinnedPosition ? "off" : "on",
        onClick: (evt) => {
          Events.send(pinRequest, {id: `${Number.parseInt(evt.target.id)}`})
        }
      }),
      h("div", {
        id: `${id}-close`,
        "class": "titlebarButton closeButton",
        onClick: (evt) => {
          Events.send(remove, {id: `${Number.parseInt(evt.target.id)}`, type: "remove"})
        }
      }),
    ]),
    h("div", {
      id: `${id}-bottomRight-resize`,
      corner: "bottomRight",
      "class": "resizeHandler",
    }, []),
    h("div", {
      id: `${id}-topLeft-resize`,
      corner: "topLeft",
      "class": "resizeHandler",
    }, []),
    h("div", {
      id: `${id}-bottomLeft-resize`,
      corner: "bottomLeft",
      "class": "resizeHandler",
    }, []),
    h("div", {
      id: `${id}-topRight-resize`,
      corner: "topRight",
      "class": "resizeHandler",
    }, []),
    h("div", {
      id: `${id}-windowHolder`,
      blurred: `${type !== "code" ? false : (windowEnabled ? !windowEnabled.enabled : false)}`,
      "class": "windowHolder",
    }, [])
  ])
};

const windowElements = ((windows, titles, windowContents, windowTypes, windowEnabled, pinnedPositions, delayed) => {
  return h("div", {id: "owner", "class": "owner"}, windows.map((id) => {
    return windowDOM(
      id,
      titles.map.get(id), windowContents.map.get(id),
      windowTypes.map.get(id), windowEnabled.map.get(id),
      pinnedPositions.map.get(id), delayed)
  }));
})(windows, titles, windowContents, windowTypes, windowEnabled, pinnedPositions, delayed);

const _windowRender = render(windowElements, document.querySelector("#mover"));

// Graph Visualization

const analyzed = ((windowContents, windowEnabled, trigger, showGraph) => {
  if (!showGraph) {return new Map()}
  if (trigger === null) {return new Map()}
  if (typeof trigger === "object" && trigger.id) {return new Map();}
  const programState = new Renkon.constructor(0);
  programState.setLog(() => {});

  const blockMap = new Map() // name -> blockId
  const nodes = new Map(); // blockId -> {exports:Set, imports: Set}
  const edges = new Map(); // blockId -> {edgesOut: [{id, dest}], edgesIn: [{id, origin}], exports: [id]}

  const code = [...windowContents.map].filter(
    ([id, editor]) => editor.state && windowEnabled.map.get(id)?.enabled)
    .map(([id, editor]) => ({blockId: id, code: editor.state.doc.toString()}));
  try {
    code.forEach(info => {
      const blockId = info.blockId;
      programState.setupProgram([info.code]);
      nodes.set(blockId, {exports: new Set(), imports: new Set()});
      edges.set(blockId, {edgesOut: [], edgesIn: [], exports: []});
      const obj = nodes.get(blockId);
      for (const jsNode of programState.nodes.values()) {
        for (const input of jsNode.inputs) {
          if (/^_[0-9]/.test(input)) {continue;}
          obj.imports.add(input)
        }
        if (jsNode.outputs === "") {continue;}
        if (/^_[0-9]/.test(jsNode.outputs)) {continue;}
        blockMap.set(jsNode.outputs, blockId)
        obj.exports.add(jsNode.outputs);
      }
    });
  } catch(e) {
    console.log("Graph analyzer encountered an error in source code:");
    return new Map();
  }

  for (let [id, obj] of nodes) {
    for (const exported of obj.exports) {//exported:string
      const edgesOut = edges.get(id).edgesOut;
      const exports = edges.get(id).exports;
      for (let [importId, importObj] of nodes) {
        if (importId === id) {continue;}
        const edgesIn = edges.get(importId).edgesIn;
        if (importObj.imports.has(exported)) {
          if (edgesOut.findIndex((already) => already.id === exported && already.dest === importId) < 0) {
            edgesOut.push({id: exported, dest: importId});
            if (exports.indexOf(exported) < 0) {
              exports.push(exported);
            }
          }
          if (edgesIn.findIndex((already) => already.id === exported && already.origin === id) < 0) {
            edgesIn.push({id: exported, origin: id});
          }
        }
      }
    }
  }
  return edges;
})(windowContents, windowEnabled, Events.or(remove, hovered), showGraph === "showGraph");

const line = (p1, p2, color, label) => {
  let pl;
  let pr;
  if (p1.x < p2.x) {
    pl = p1;
    pr = p2;
  } else {
    pl = p2;
    pr = p1;
  }
  const c0 = `${pl.x} ${pl.y}`;
  const c1 = `${pl.x + (pr.x - pl.x) * 0.5} ${pl.y + (pr.y - pl.y) * 0.2}`;
  const c2 = `${pr.x - (pr.x - pl.x) * 0.2} ${pl.y + (pr.y - pl.y) * 0.6}`;
  const c3 = `${pr.x} ${pr.y}`;
  return html`<path d="M ${c0} C ${c1} ${c2} ${c3}" stroke="${color}"
    fill="transparent" stroke-width="2" stroke-linecap="round"></path><text
    x="${p1.x + 5}" y="${p1.y}">${label}</text>`;
};

const hovered = Events.receiver();
const hoveredB = Behaviors.keep(hovered);

const graph = ((positions, padView, analyzed, hoveredB, showGraph) => {
  if (hoveredB === null) {return [];}
  if (!showGraph) {return [];}

  const edges = analyzed.get(hoveredB);

  if (!edges) {return [];} // runner does not have edges

  const exportEdges = new Set();
  const importEdges = new Set();

  const outEdges = edges.edgesOut.map((edge) => {
    const ind = edges.exports.indexOf(edge.id);
    let p1 = positions.map.get(hoveredB);
    p1 = {x: p1.x + p1.width, y: p1.y};
    // p1 = {x: p1.x * padView.scale + padView.x, y: p1.y * padView.scale + padView.y};
    p1 = {x: (p1.x + padView.x) * padView.scale, y: (p1.y + padView.y) * padView.scale};
    p1 = {x: p1.x, y: p1.y + ind * 20 + 10};
    let p2 = positions.map.get(edge.dest);
    p2 = {x: (p2.x + padView.x) * padView.scale, y: (p2.y + padView.y) * padView.scale};
    p2 = {x: p2.x, y: p2.y + 10};
    let e = "";
    if (!exportEdges.has(edge.id)) {
      exportEdges.add(edge.id);
      e = edge.id;
    }
    return line(p1, p2, "#d88", e);
  });

  const inEdges = edges.edgesIn.map((edge) => {
    const exporter = analyzed.get(edge.origin);
    const ind = exporter.exports.indexOf(edge.id);
    let p1 = positions.map.get(edge.origin);
    p1 = {x: p1.x + p1.width, y: p1.y};
    p1 = {x: (p1.x + padView.x) * padView.scale , y: (p1.y + padView.y) * padView.scale};
    p1 = {x: p1.x, y: p1.y + ind * 20 + 10};
    let p2 = positions.map.get(hoveredB);
    p2 = {x: (p2.x + padView.x) * padView.scale, y: (p2.y + padView.y) * padView.scale};
    p2 = {x: p2.x, y: p2.y + 10};
    let e = "";
    if (!importEdges.has(edge.id)) {
      importEdges.add(edge.id);
      e = edge.id;
    }
    return line(p1, p2, "#88d", e);
  });

  return html`<svg viewBox="0 0 ${window.innerWidth} ${window.innerHeight}"
                     xmlns="http://www.w3.org/2000/svg">${outEdges}${inEdges}</svg>`;
})(positions, padView, Behaviors.keep(analyzed), hoveredB, showGraph === "showGraph");

const _graphRender = render(graph, document.querySelector("#overlay"));

/// Save and Load

const loadRequest = Events.receiver();

const saveData = (windows, positions, zIndex, titles, windowContents, windowTypes, padTitle, windowEnabled) => {
  const code = new Map(
    [...windowContents.map].map(([id, content]) => {
      if (content.state) {
        return [id, content.state.doc.toString()];
      } else if (content.doc) {
        return [id, content.doc];
      } else {
        return null;
      }
    }).filter(item => item !== null));
  const myTitles = new Map([...titles.map].map(([id, obj]) => ([id, {...obj, state: false}])));
  const data1 = stringify({
    version: 3,
    windows,
    positions,
    zIndex,
    titles: {map: myTitles},
    windowTypes,
    padTitle,
    windowEnabled
  });

  const data2 = stringifyCodeMap(code);

  return encodeURIComponent(data1) + encodeURIComponent(data2);
};

const _saver2 = ((windows, positions, zIndex, titles, windowContents, windowTypes, padTitle, windowEnabled) => {
  const data = saveData(windows, positions, zIndex, titles, windowContents, windowTypes, padTitle, windowEnabled);

  const dataStr = "data:text/plain;charset=utf-8," + data;
  const div = document.createElement("a");
  div.setAttribute("href", dataStr);
  div.setAttribute("download", `${padTitle}.renkon`);
  div.click();
})(windows, positions, zIndex, titles, windowContents, windowTypes, padTitle, windowEnabled, save);

const _loader = (() => {
  const input = document.createElement("div");
  input.innerHTML = `<input id="imageinput" type="file" accept=".json,.renkon">`;
  const imageInput = input.firstChild;

  imageInput.onchange = () => {
    const file = imageInput.files[0];
    if (!file) {imageInput.remove(); return;}
    new Promise(resolve => {
      let reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsArrayBuffer(file);
    }).then((data) => {
      const result = new TextDecoder("utf-8").decode(data);
      loadData(result, imageInput);
    });
    imageInput.value = "";
  };
  imageInput.oncancel = () => imageInput.remove();
  document.body.appendChild(imageInput);
  imageInput.click();
})(load);

const nameFromUrl = (() => {
  const maybeUrl = new URL(window.location).searchParams.get("file");
  if (maybeUrl) {
    return maybeUrl;
  }
  return undefined;
})();

const loadData = (result, maybeImageInput) => {
  const index = result.indexOf("{__codeMap: true, value:");
  if (index < 0) {
    const loaded = parse(result);
    if (loaded.version === 1) {
      Events.send(loadRequest, loaded);
      maybeImageInput?.remove();
      return;
    }
    console.log("unknown type of data");
    maybeImageInput?.remove();
    return;
  }

  const data1 = result.slice(0, index);
  const data2 = result.slice(index);

  const loaded = parse(data1);

  if (loaded.version === 2 || loaded.version === 3) {
    const code = parseCodeMap(data2);
    loaded.code = code;
    Events.send(loadRequest, loaded);
    maybeImageInput?.remove();
    return;
  }
  console.log("unknown type of data");
  maybeImageInput.remove();
}

const _loadFromUrl = fetch(nameFromUrl).then((resp) => resp.text()).then((result) => {
  loadData(result, null);
});

const stringifyInner = (node, seen) => {
  if (node === undefined) return undefined;
  if (typeof node === 'number') return Number.isFinite(node) ? `${node}` : 'null';
  if (typeof node !== 'object') return JSON.stringify(node, null, 4);

  let out;
  if (Array.isArray(node)) {
    out = '[';
    for (let i = 0; i < node.length; i++) {
      if (i > 0) out += ',';
      out += stringifyInner(node[i], seen) || 'null';
    }
    return out + ']';
  }

  if (node === null) return 'null';

  if (seen.has(node)) {
    throw new TypeError('Converting circular structure to JSON');
  }

  seen.add(node);

  if (node.constructor === window.Map) {
    let replacement = {__map: true, values: [...node]};
    return stringifyInner(replacement, seen);
  }

  if (node.constructor === window.Set) {
    let replacement = {__set: true, values: [...node]};
    return stringifyInner(replacement, seen);
  }

  let keys = Object.keys(node).sort();
  out = '';
  for (let i = 0; i < keys.length; i++) {
    let key = keys[i];
    let value = stringifyInner(node[key], seen, out);
    if (!value) continue;
    if (out !== '') out += ',\n';
    out += JSON.stringify(key) + ':' + value;
  }
  seen.delete(node);
  return '{' + out + '}';
}

const stringify = (obj) => {
  let seen = new Set();
  return stringifyInner(obj, seen);
}

const parse = (string) => {
  return JSON.parse(string, (_key, value) => {
    if (typeof value === "object" && value !== null && value.__map) {
      return new Map(value.values);
    } else if (typeof value === "object" && value !== null && value.__set) {
      return new Set(value.values);
    }
    return value;
  });
}

const stringifyCodeMap = (map) => {
  const replace = (str) => {
    return str.replaceAll("\\", "\\\\").replaceAll("`", "\\`").replaceAll("$", "\\$");
  }

  return "\n{__codeMap: true, value: " + "[" +
    [...map].map(([key, value]) => ("[" + "`" + replace(key) + "`" + ", " + "`" +
                                    replace(value) + "`" + "]")).join(",\n") + "]" + "}"
}

const parseCodeMap = (string) => {
  const array = eval("(" + string + ")");
  return new Map(array.value);
}

// Doc Window

function doc(id) {
  const init = (() => {
    const script = document.createElement("script");
    script.id = "markdownit";
    script.src = "./markdown-it.min.js";
    const promise = new Promise((resolve) => {
      script.onload = () => {
         resolve(window.markdownit);
      };
    });

    document.head.querySelector("#markdownit")?.remove();
    document.head.appendChild(script);

    const container = document.createElement("div");
    container.id = "container";
    document.body.querySelector("#container")?.remove();
    document.body.appendChild(container);
    container.innerHTML = `
   <div id="result"></div>
   <div id="separator"></div>
   <div id="editorContainer"></div>
`.trim();
    return {markdownit: promise, container};
  })();

  const resolved = Behaviors.resolvePart(init);
  const md = resolved.markdownit({html: true});
  const container = resolved.container;
  const separator = container.querySelector("#separator");

  const docString = Events.receiver();

  const _update = ((docString, container) => {
    const result = md.render(docString);
    const div = document.createElement("div");
    div.id = "renkon";
    container.querySelector("#renkon")?.remove();
    container.querySelector("#result").appendChild(div);
    div.innerHTML = result;
    return div;
  })(docString, container);

  const docEditor = ((id, doc) => {
    const mirror = window.CodeMirror;
    const callback = (id, viewUpdate) => {
      if (viewUpdate.docChanged) {
        const  str = viewUpdate.state.doc.toString();
        Events.send(docString, str);
        window.parent.postMessage({type: "renkon-doc-updated", id, code: str});
      }
    };
    const editor = new mirror.EditorView({
        doc: doc || "",
        extensions: [
            mirror.basicSetup,
            mirror.EditorView.lineWrapping,
            mirror.EditorView.updateListener.of((viewUpdate) => callback(id, viewUpdate)),
            mirror.EditorView.editorAttributes.of({"class": "editor"}),
            mirror.view.keymap.of([mirror.commands.indentWithTab])
        ],
    });
    editor.dom.id = `${id}-docEditor`;
    return editor;
  })(id);

  const contentsEvent = Events.listener(window, "message", evt => {
    if (evt.data.type === "renkon-doc" && typeof evt.data.doc === "string") {
      const isEmpty = evt.data.doc === "";
      const doc = isEmpty ? "# Hello, Renkon-pad" : evt.data.doc;
      docEditor.dispatch({
        changes: {
          from: 0,
          to: docEditor.state.doc.length,
          insert: doc
        }
      });
      if (!isEmpty) {
        return {type: "resize"};
      }
    }
  });

  const _init = ((container, docEditor) => {
    container.querySelector("#editorContainer").appendChild(docEditor.dom);
    window.parent.postMessage({ready: "renkon-ready", type: "doc", id});
  })(container, docEditor);

  const sepDown = Events.listener(
     separator,
     "pointerdown",
     evt => evt);

  const down = Events.collect(undefined, sepDown, (old, evt) => {
    if (evt.isPrimary) {
      evt.target.setPointerCapture(evt.pointerId);
    }
    return {type: "sepDown", x: evt.clientX};
  });

  const up = Events.listener(
    separator,
    "pointerup",
    (evt) => {
      if (evt.isPrimary) {
        evt.target.releasePointerCapture(evt.pointerId);
      }
      return {type: "sepUp"}
    }
  );

  const _sepMove = Events.listener(separator, "pointermove", moveCompute);

  const moveCompute = Behaviors.select(
    evt => evt,
    down, (_old, down) => {
      return (move) => {
        const newX = move.clientX;
        const newRenkonWidth = Math.min(window.innerWidth - 8, Math.max(newX - 8, 0));
        const newEditorWidth = Math.max(window.innerWidth - 22 - newRenkonWidth, 60);
        const right = newEditorWidth === 60 ? -60 - 16 + (window.innerWidth - newX) : 0;

        document.head.querySelector("#separator-style").textContent = `
  #result {
    width: ${newRenkonWidth}px;
  }
  #editorContainer {
    width: ${newEditorWidth}px;
    right: ${right}px;
  }
  `.trim();
        return move;
      }
    },
    up, (_old, _up) => (move) => move,
    Events.or(resize, contentsEvent), (old, resize) => {
      const newX = window.innerWidth - 22;
      const newEditorWidth = 60;
      const right = -60;
        document.head.querySelector("#separator-style").textContent = `
  #result {
    width: ${newX}px;
  }
  #editorContainer {
    width: ${newEditorWidth}px;
    right: ${right}px;
  }
  `.trim();
      return old;
    }
  );

  const resize = Events.listener(window, "resize", (evt) => ({type: "resize"}));

  Events.listener(document.body, "gesturestart", preventDefaultSafari);
  Events.listener(document.body, "gesturechange", preventDefaultSafari);
  Events.listener(document.body, "gestureend", preventDefaultSafari);

  const isSafari = window.navigator.userAgent.includes("Safari") && !window.navigator.userAgent.includes("Chrome");
  const isMobile = !!("ontouchstart" in window);

  const preventDefault = (evt) => {
    evt.preventDefault();
    return evt;
  };

  const preventDefaultSafari = (evt) => {
    if (!isSafari || isMobile) {
      evt.preventDefault();
    }
    return evt;
  };

  const wheel = Events.listener(container, "wheel", (evt) => {
    let pinch;
    if (isSafari) {
      pinch = (Number.isInteger(evt.deltaX) && !Number.isInteger(evt.deltaY)) || evt.metaKey;
    } else {
      pinch = evt.ctrlKey || evt.metaKey;
    }
    if (pinch) {
      evt.preventDefault();
      evt.stopPropagation();
    }
    return evt;
  });

  const css = `
#container, html, body {
  width: 100%;
  height: 100%;
  margin: 0px;
}

#container {
  display: flex;
}

#result {
  height: 100%;
  width: calc(100% - 220px);
  overflow: scroll;
  scroll-behavior: smooth;
  font-size: 13px;
}

#renkon {
  height: 100%;
}

#separator {
   width: 8px;
   min-width: 8px;
   height: 100%;
   background-color: #f8f8f8;
}

#separator:hover {
   background-color: #e8e8e8;
   cursor: ew-resize;
}

#editorContainer {
  position: fixed;
  right: 0px;
  min-height: 100%;
  height: 100%;
  width: 200px;
  border: 1px solid black;
  padding: 6px;
  min-width: 0px;
  background-color: white;
  white-space: pre-wrap;
  overflow: scroll;
}

`;

  ((css) => {
    document.head.querySelector("#presenter-style")?.remove();
    const style = document.createElement("style");
    style.id = "presenter-style";
    style.textContent = css;
    document.head.appendChild(style);

    document.head.querySelector("#separator-style")?.remove();
    const sepStyle = document.createElement("style");
    sepStyle.id = "separator-style";
    document.head.appendChild(sepStyle);
  })(css, container);

  return {};
}

const newDocPane = (id, doc) => {
  const runner = newRunner(id);
  return {dom: runner.dom, doc: doc};
}

const _handleDocReady = ((readyMessages, windowContents, windowTypes) => {
  for (const ready of readyMessages) {
    const id = ready.data.id;
    const type = windowTypes.map.get(id);
    const content = windowContents.map.get(id);
    if (ready.data.type === "runner" && type === "doc") {
      if (content) {
        if (type) {
          const {output:code} = Renkon.getFunctionBody(Renkon.findDecl(type));
          content.dom.contentWindow.postMessage({code: [code, `const id = "${id}"`]});
        }
      }
    } else if (ready.data.type === "doc") {
      content.dom.contentWindow.postMessage({type: "renkon-doc", doc: content.doc});
    }
  }
})(readyMessages, windowContents, windowTypes);

const docUpdate = Events.listener(window, "message", evt => {
  if (evt.data.type === "renkon-doc-updated") {return evt.data;}
});

// CSS

const css = `
@font-face {
  font-family: "OpenSans-Regular";
  src: url("./assets/fonts/open-sans-v17-latin-ext_latin-regular.woff2") format("woff2");
}

@font-face {
  font-family: 'OpenSans-SemiBold';
  src: url("./assets/fonts/open-sans-v17-latin-ext_latin-600.woff2") format('woff2');
}

html, body, #renkon {
  overflow: hidden;
  height: 100%;
  margin: 0px;
}

html, body {
  overscroll-behavior-x: none;
  touch-action: none;
}

#pad {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0px;
  left: 0px;
  background-image: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAjElEQVR4XuXQAQ0AAAgCQfoHpYbOGt5vEODSdgovd3I+gA/gA/gAPoAP4AP4AD6AD+AD+AA+gA/gA/gAPoAP4AP4AD6AD+AD+AA+gA/gA/gAPoAP4AP4AD6AD+AD+AA+gA/gA/gAPoAP4AP4AD6AD+AD+AA+gA/gA/gAPoAP4AP4AD6AD+AD+AA+wIcWxEeefYmM2dAAAAAASUVORK5CYII=);
}

#mover {
  pointer-events: none;
  position:absolute;
  transform-origin: 0px 0px;
}

#owner {
  position: absolute;
  pointer-events: initial;
}

.editor {
  height: 100%;
  border-radius: 0px 0px 6px 6px;
}

#overlay {
  pointer-events: none;
  height: 100%;
  width: 100%;
  position: absolute;
  top: 0px;
  left: 0px;
  z-index: 10000;
}

.window {
  position: absolute;
  transform-origin: 0px 0px;
  background-color: #eee;
  border-radius: 6px;
  box-shadow: inset 0 2px 2px 0 rgba(255, 255, 255, 0.8), 1px 1px 8px 0 rgba(0, 35, 46, 0.2);
}

.window[pinned="true"] {
  box-shadow: inset 0 4px 4px 0 rgba(255, 255, 255, 0.8), 8px 8px 8px 0 rgb(208 53 53 / 20%);
}

#buttonBox {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  row-gap: 8px;
  left: 0px;
  top: 0px;
  width: 100%;
  padding-bottom: 8px;
  padding-top: 8px;
  border-bottom: 1px solid black;
  background-color: white;
  position: absolute;
  z-index: 200000;
}

#padTitle {
  margin-left: 24px;
}

.spacer {
  flex-grow: 1;
}

.menuButton {
  font-family: 'OpenSans-SemiBold';
  color: black;
  margin-left: 4px;
  margin-right: 4px;
  border-radius: 4px;
  cursor: pointer;
  border: 2px solid #555;
}

.runnerIframe {
  width: 100%;
  height: 100%;
  border: 2px solid black;
  box-sizing: border-box;
  border-radius: 0px 0px 6px 6px;
  background-color: #fff;
  user-select: none;
}

.titleBar {
  background-color: #bbb;
  width: 100%;
  height: 28px;
  display: flex;
  /* border: 2px ridge #ccc;*/
  /* box-sizing: border-box; */
  border-radius: 6px 6px 0px 0px;
  cursor: -webkit-grab;
  cursor: grab;
  /*overflow: hidden;*/
}

.title {
  font-family: OpenSans-Regular;
  pointer-events: none;
  margin-right: 10px;
  margin-left: 10px;
  margin-top: 2px;
  padding-left: 10px;
  padding-right: 10px;
  max-width: calc(100% - 150px);
  text-wrap: nowrap;
}

.title[contentEditable="true"] {
  background-color: #eee;
  pointer-events: all;
  user-select: all;
}

.titleSpacer {
  flex-grow: 1;
  pointer-events: none;
}

.runButtonContainer {
  display: flex;
  flex-direction: column;
}

.titlebarButton {
  height: 19px;
  width: 19px;
  min-width: 19px;
  min-height: 19px;
  margin: 2px;
  margin-top: 4px;
  pointer-events: all;
  border-radius: 4px;
  background-position: center;
  cursor: pointer;
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
  display: none;
  pointer-events: none;
}

.runButtonBackground {
  background-image: url("data:image/svg+xml,%3Csvg%20width%3D%2224px%22%20height%3D%2224px%22%20viewBox%3D%220%200%2024%2024%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22none%22%20stroke%3D%22%234D4D4D%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3C!--%20Box%20outline%20--%3E%3Crect%20x%3D%223%22%20y%3D%223%22%20width%3D%2218%22%20height%3D%2218%22%20rx%3D%222%22%20ry%3D%222%22%2F%3E%3C!--%20Right-pointing%20triangle%20(play%20icon)%20--%3E%3Cpath%20d%3D%22M9%207L17%2012L9%2017Z%22%20fill%3D%22%234D4D4D%22%20stroke%3D%22none%22%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E");
}


.resetButton {
  background-image: url("data:image/svg+xml,%3Csvg%20width%3D%2224px%22%20height%3D%2224px%22%20viewBox%3D%220%200%2024%2024%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3C!--%20Box%20outline%20--%3E%3Cg%20fill%3D%22none%22%20stroke%3D%22%234D4D4D%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Crect%20x%3D%223%22%20y%3D%223%22%20width%3D%2218%22%20height%3D%2218%22%20rx%3D%222%22%20ry%3D%222%22%2F%3E%3C%2Fg%3E%3C!--%20Play%20triangle%20(moved%20upward)%20--%3E%3Cpath%20d%3D%22M9%206L17%2011L9%2016Z%22%20fill%3D%22%234D4D4D%22%2F%3E%3C!--%20Rewind%20arrow%20shaft%20(moved%20up%20to%20y%3D18)%20--%3E%3Cpath%20d%3D%22M18%2018%20L7%2018%22%20fill%3D%22none%22%20stroke%3D%22%234D4D4D%22%20stroke-width%3D%221.2%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C!--%20Arrowhead%20(moved%20up%20accordingly)%20--%3E%3Cpath%20d%3D%22M7%2018%20L8.5%2016.5%22%20fill%3D%22none%22%20stroke%3D%22%234D4D4D%22%20stroke-width%3D%221.2%22%20stroke-linecap%3D%22round%22%2F%3E%3Cpath%20d%3D%22M7%2018%20L8.5%2019.5%22%20fill%3D%22none%22%20stroke%3D%22%234D4D4D%22%20stroke-width%3D%221.2%22%20stroke-linecap%3D%22round%22%2F%3E%3C%2Fsvg%3E");
}

.pinButton {
  background-image: url("data:image/svg+xml,%3Csvg%20width%3D%2224px%22%20height%3D%2224px%22%20viewBox%3D%220%200%2024%2024%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22%234D4D4D%22%20stroke%3D%22%234D4D4D%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3C!--%20Scaled%20filled%20top%20--%3E%3Cellipse%20cx%3D%2212%22%20cy%3D%226.5%22%20rx%3D%223.2%22%20ry%3D%221.6%22%2F%3E%3C!--%20Scaled%20neck%20as%20filled%20trapezoid%20--%3E%3Cpolygon%20points%3D%229.8%2C8.3%2014.2%2C8.3%2014.8%2C11.5%209.2%2C11.5%22%2F%3E%3C!--%20Scaled%20filled%20base%20--%3E%3Cellipse%20cx%3D%2212%22%20cy%3D%2213.2%22%20rx%3D%225%22%20ry%3D%221.8%22%2F%3E%3C!--%20Scaled%20short%20pin%20--%3E%3Cline%20x1%3D%2212%22%20y1%3D%2214.9%22%20x2%3D%2212%22%20y2%3D%2220%22%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E");
}

.pinButton[state="off"] {
  transform-origin: center;
  transform: rotate(40deg);
}

.runButton[type="runner"] {
  display: inherit;
  pointer-events: all;
}

.runButton2[delayed="true"] {
  display: inline;
  pointer-events: all;
}

.runButton2 {
  display: none;
  pointer-events: all;
  position: relative;
}

.runButton2[delayed="true"] {
  display: block;

}

.resizeHandler {
  position: absolute;
  width: 20px;
  height: 20px;
  border-radius: 6px;
  z-index: 10000;
  background-color: rgba(0.1, 0.1, 0.1, 0.03);
}

.resizeHandler[corner="bottomRight"] {
  cursor: se-resize;
  bottom: -15px;
  right: -15px;
}

.resizeHandler[corner="topLeft"] {
  cursor: nw-resize;
  top: -15px;
  left: -15px;
}

.resizeHandler[corner="bottomLeft"] {
  cursor: sw-resize;
  bottom: -15px;
  left: -15px;
}

.resizeHandler[corner="topRight"] {
  cursor: ne-resize;
  top: -15px;
  right: -15px;
}

.resizeHandler:hover {
  background-color: rgba(0.1, 0.4, 0.1, 0.3);
}

.windowHolder {
  height: calc(100% - 24px);
  box-sizing: border
}

.windowHolder[blurred="true"] {
  filter: blur(4px)
}

#navigationBox {
  display: flex;
  flex-direction: column;
  right: 20px;
  gap: 10px;
  bottom: 80px;
  align-items: center;
  width: 40px;
  border: 1px solid black;
  background-color: #d2d2d2;
  position: absolute;
  z-index: 200000;
  border-radius: 8px;
  box-shadow: 4px 5px 8px -2px rgba(0,0,0,.15);
}

.navigationButton {
  width: 30px;
  height: 30px;
  display: flex;
  cursor: pointer;
}

.with-border {
  border: 1px solid #4D4D4D;
  border-radius: 15px;
  background-color: white;
}

.navigationButton:hover {
  background-color: #eaeaea;
}

.navigationButton:first-child {
  margin-top: 10px;
}

.navigationButton:last-child {
  margin-bottom: 10px;
}

.navigationButtonImage {
  width: 100%;
  height: 100%;
  background-position: center;
  background-repeat: no-repeat;
}

#zoomInButton {
  background-image: url("data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22UTF-8%22%3F%3E%3Csvg%20width%3D%2224px%22%20height%3D%2224px%22%20viewBox%3D%220%200%2024%2024%22%20version%3D%221.1%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20xmlns%3Axlink%3D%22http%3A%2F%2Fwww.w3.org%2F1999%2Fxlink%22%3E%3Ctitle%3Eicon%2Fmaterial%2Fview_zoom-in%3C%2Ftitle%3E%3Cg%20id%3D%22icon%2Fmaterial%2Fview_zoom-in%22%20stroke%3D%22none%22%20stroke-width%3D%221%22%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20id%3D%22ic-baseline-add%22%3E%3Cg%20id%3D%22Icon%22%20fill%3D%22%234D4D4D%22%3E%3Cpolygon%20id%3D%22Icon-Path%22%20points%3D%2219%2013%2013%2013%2013%2019%2011%2019%2011%2013%205%2013%205%2011%2011%2011%2011%205%2013%205%2013%2011%2019%2011%22%3E%3C%2Fpolygon%3E%3C%2Fg%3E%3Crect%20id%3D%22ViewBox%22%20fill-rule%3D%22nonzero%22%20x%3D%220%22%20y%3D%220%22%20width%3D%2224%22%20height%3D%2224%22%3E%3C%2Frect%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E");
}

#zoomOutButton {
  background-image: url("data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22UTF-8%22%3F%3E%3Csvg%20width%3D%2224px%22%20height%3D%2224px%22%20viewBox%3D%220%200%2024%2024%22%20version%3D%221.1%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20xmlns%3Axlink%3D%22http%3A%2F%2Fwww.w3.org%2F1999%2Fxlink%22%3E%3Ctitle%3Eicon%2Fmaterial%2Fview_zoom-out%3C%2Ftitle%3E%3Cg%20id%3D%22icon%2Fmaterial%2Fview_zoom-out%22%20stroke%3D%22none%22%20stroke-width%3D%221%22%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20id%3D%22ic-baseline-minus%22%3E%3Cg%20id%3D%22Icon%22%20fill%3D%22%234D4D4D%22%3E%3Cpolygon%20id%3D%22Icon-Path%22%20points%3D%2219%2012.998%205%2012.998%205%2010.998%2019%2010.998%22%3E%3C%2Fpolygon%3E%3C%2Fg%3E%3Crect%20id%3D%22ViewBox%22%20fill-rule%3D%22nonzero%22%20x%3D%220%22%20y%3D%220%22%20width%3D%2224%22%20height%3D%2224%22%3E%3C%2Frect%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E");
}

#homeButton {
  background-image: url("data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22UTF-8%22%3F%3E%3Csvg%20width%3D%2224px%22%20height%3D%2224px%22%20viewBox%3D%220%200%2024%2024%22%20version%3D%221.1%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20xmlns%3Axlink%3D%22http%3A%2F%2Fwww.w3.org%2F1999%2Fxlink%22%3E%3Ctitle%3Eicon%2Fview-centered%3C%2Ftitle%3E%3Cg%20id%3D%22icon%2Fview-centered%22%20stroke%3D%22none%22%20stroke-width%3D%221%22%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20id%3D%22Group-3%22%20transform%3D%22translate(2.000000%2C%204.000000)%22%20fill%3D%22%234D4D4D%22%3E%3Cpath%20d%3D%22M0%2C9%20L3%2C9%20L3%2C7%20L0%2C7%20L0%2C9%20Z%20M17%2C9%20L20.001%2C9%20L20.001%2C7%20L17%2C7%20L17%2C9%20Z%20M9%2C3%20L11%2C3%20L11%2C0%20L9%2C0%20L9%2C3%20Z%20M13%2C9%20L11%2C9%20L11%2C11%20L9%2C11%20L9%2C9%20L7%2C9%20L7%2C7%20L9%2C7%20L9%2C5%20L11%2C5%20L11%2C7%20L13%2C7%20L13%2C9%20Z%20M9%2C16%20L11%2C16%20L11%2C13%20L9%2C13%20L9%2C16%20Z%20M13%2C0%20L13%2C2%20L18%2C2%20L18%2C5%20L20%2C5%20L20%2C0%20L13%2C0%20Z%20M18%2C14%20L13%2C14%20L13%2C16%20L20%2C16%20L20%2C11%20L18%2C11%20L18%2C14%20Z%20M0%2C5%20L2%2C5%20L2%2C2%20L7%2C2%20L7%2C0%20L0%2C0%20L0%2C5%20Z%20M2%2C11%20L0%2C11%20L0%2C16%20L7%2C16%20L7%2C14%20L2%2C14%20L2%2C11%20Z%22%20id%3D%22Fill-1%22%3E%3C%2Fpath%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E");
}

.enabledButton {
  background-image: url("data:image/svg+xml,%3Csvg%20width%3D%2224px%22%20height%3D%2224px%22%20viewBox%3D%220%200%2024%2024%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22none%22%20stroke%3D%22%234D4D4D%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3C!--%20Box%20outline%20--%3E%3Crect%20x%3D%223%22%20y%3D%223%22%20width%3D%2218%22%20height%3D%2218%22%20rx%3D%222%22%20ry%3D%222%22%20stroke-width%3D%222%22%2F%3E%3C!--%20Thicker%20checkmark%20--%3E%3Cpath%20d%3D%22M5.5%2012.5L10.5%2017.5L18.5%207.5%22%20stroke-width%3D%223%22%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E");
}

.enabledButton[disabled="true"] {
  background-image: url("data:image/svg+xml,%3Csvg%20width%3D%2224px%22%20height%3D%2224px%22%20viewBox%3D%220%200%2024%2024%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Crect%20x%3D%223%22%20y%3D%223%22%20width%3D%2218%22%20height%3D%2218%22%20rx%3D%222%22%20ry%3D%222%22%20fill%3D%22none%22%20stroke%3D%22%234D4D4D%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E");
}

.inspectorButton {
  background-image: url("data:image/svg+xml,%3Csvg%20width%3D%2224px%22%20height%3D%2224px%22%20viewBox%3D%220%200%2024%2024%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22none%22%20stroke%3D%22%234D4D4D%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3C!--%20Line%201%20--%3E%3Ccircle%20cx%3D%225%22%20cy%3D%227%22%20r%3D%221.5%22%20fill%3D%22%234D4D4D%22%20stroke%3D%22none%22%2F%3E%3Cline%20x1%3D%228%22%20y1%3D%227%22%20x2%3D%2219%22%20y2%3D%227%22%2F%3E%3C!--%20Line%202%20--%3E%3Ccircle%20cx%3D%225%22%20cy%3D%2212%22%20r%3D%221.5%22%20fill%3D%22%234D4D4D%22%20stroke%3D%22none%22%2F%3E%3Cline%20x1%3D%228%22%20y1%3D%2212%22%20x2%3D%2219%22%20y2%3D%2212%22%2F%3E%3C!--%20Line%203%20--%3E%3Ccircle%20cx%3D%225%22%20cy%3D%2217%22%20r%3D%221.5%22%20fill%3D%22%234D4D4D%22%20stroke%3D%22none%22%2F%3E%3Cline%20x1%3D%228%22%20y1%3D%2217%22%20x2%3D%2219%22%20y2%3D%2217%22%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E");
  display: none;
  pointer-events: none;
}


.inspectorButton[type="runner"] {
  display: inherit;
  pointer-events: all;
}

.cm-tooltip-lint {
  font-size: 12px;
}

.cm-tooltip-dependency {
  background-color: #66b;
  color: white;
  border: none;
  padding: 2px 7px;
  border-radius: 4px;

}

.cm-tooltip-dependency {
  transform: translate(20px, 0px)
}

.cm-tooltip-cursor-wide {
  text-wrap: nowrap;
}

.dependency-link {
  border: 1px solid #66b;
}

.dependency-link:hover {
  border: 1px solid #cc7;
  border-style: outset;
  background-color: #88c;
}
`;

((css, renkon) => {
  const style = document.createElement("style");
  style.id = "pad-css";
  style.textContent = css;
  renkon.querySelector("#pad-css")?.remove();
  renkon.appendChild(style);
})(css, renkon);

return {};
}

/* globals Events Behaviors Renkon */
