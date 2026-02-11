let ProgramState;
let codeMirrorObj;

function decls(funcStr, realm) {
  const state = new ProgramState(0);

  const {output} = state.getFunctionBody(funcStr);

  state.setupProgram([output]);

  const types = state.types;

  const decls = state.findDecls(output);
  const check = (d) => d.decls.length > 0 && realm.get(d.decls[0]) === "Model";

  const modelDecls = decls.filter((decl) => check(decl));
  const viewDecls = decls.filter((decl) => !check(decl));
  const modelState = new ProgramState(0);
  modelState.setLog(() => {});
  modelState.setupProgram([modelDecls.map(m => m.code).join("\n")]);
  const viewState = new ProgramState(0);
  viewState.setLog(() => {});
  viewState.setupProgram([viewDecls.map(m => m.code).join("\n")]);

  const modelVarsArray = [];
  const modelUsesArray = [];
  for (const [id, modelNode] of modelState.nodes) {
    if (!/^_?[0-9]/.exec(id)) {
      modelVarsArray.push(id);
    }
    for (const input of modelNode.inputs) {
      if (!/^_?[0-9]/.exec(input)) {
        modelUsesArray.push(input);
      }
    }
  }

  const viewVarsArray = [];
  const viewUsesArray = [];
  for (const [id, viewNode] of viewState.nodes) {
    if (!/^_?[0-9]/.exec(id)) {
      viewVarsArray.push(id);
    }
    for (const input of viewNode.inputs) {
      if (!/^_?[0-9]/.exec(input)) {
        viewUsesArray.push(input);
      }
    }
  }

  const viewToModel = new Set(viewVarsArray).intersection(new Set(modelUsesArray));
  const modelToView = new Set(modelVarsArray).intersection(new Set(viewUsesArray));
  return {modelDecls, viewDecls, viewToModel, modelToView, types, realm};
}

function strs(decls) {
  const {modelDecls, viewDecls, types, modelToView, viewToModel} = decls;

  const viewEvents = [];
  for (const viewDecl of viewToModel) {
    const type = types.get(viewDecl) === "Event" ? "Events" : "Behaviors";
    viewEvents.push(`const ${viewDecl} = ${type}.receiver();`);
  }

  const modelEvents = [];
  for (const modelDecl of modelToView) {
    const type = types.get(modelDecl) === "Event" ? "Events" : "Behaviors";
    modelEvents.push(`const ${modelDecl} = ${type}.receiver();`);
  }

  const modelNodeStr = modelDecls.map(m => m.code).join("\n");
  const viewEventsStr = viewEvents.join("\n");

  const viewNodeStr = viewDecls.map(m => m.code).join("\n");
  const modelEventsStr = modelEvents.join("\n");

  return {modelNodeStr, viewEventsStr, viewNodeStr, modelEventsStr};
}

export function splitStrs(func, realm) {
  const funcStr = typeof func === "function" ? func.toString() : func;
  const d = decls(funcStr, realm);
  return strs(d);
}

function makeMethodsString(methods) {
  const result = [];
  for (const k in methods) {
    const f = methods[k];
    result.push(f.toString());
  }
  return result.join("\n\t");
}

export function croquetify(func, p, appName, realm, typesString, methods) {
  ProgramState = p;
  const funcStr = typeof func === "function" ? func.toString() : func;
  const modelName = appName + "Model";
  const viewName = appName + "View";

  const methodsString = makeMethodsString(methods);

  const modelStr = `
class ${modelName} extends Croquet.Model {
  init(_options, persistent) {
    super.init(_options, persistent);

    this.$lastPublishTime = this.now();
    this.$changedKeys = new Set();

    this.funcStr = funcStr;
    const nodes = decls(funcStr, realm);
    this.realm = nodes.realm;
    this.viewToModel = nodes.viewToModel;
    this.modelToView = nodes.modelToView;
    const {modelNodeStr, viewEventsStr, viewNodeStr, modelEventsStr} = strs(nodes);

    this.timerNames = new Set();
    this.programState = new ProgramState(0, this);
    this.programState.setupProgram([modelNodeStr, viewEventsStr]);
    this.programState.options = {once: true};

    this.programState.evaluate(this.now());

    this.initCallFuture();

    if (this.renkonInit) {
       this.renkonInit();
    }

    this.subscribe(this.id, "viewMessage", this.viewMessage);
    this.subscribe(this.sessionId, "view-join", this.viewJoin);
    this.subscribe(this.sessionId, "view-exit", this.viewExit);
  }

  scheduleTimer(timerId, timerEvent) {
    console.log("scheduleTimer");
    if (this.timerNames.has(timerId)) {return;}
    this.timerNames.add(timerId);
  }

  initCallFuture() {
    [...this.programState.streams].forEach(([id, stream]) => {
      if (stream.constructor.name === "TimerEvent") {
        this.timerNames.add(id);
        this.invokeTimer(stream.interval);
      }
    });
  }

  invokeTimer(interval) {
    this.future(interval).invokeTimer(interval);
    this.timer();
  }

  viewMessage(data) {
    const now = this.now();
    const {name, value} = data;

    if (name === undefined || value === undefined) {return;}
    this.programState.registerEvent(name, value);

    this.run(now);
  }

  timer() {
    // console.log("timer", this.now());

    const now = this.now();
    this.run(now);
  }

  viewJoin(viewId) {
    this.programState.registerEvent("viewJoin", viewId);
    const now = this.now();
    this.run(now);
  }

  viewExit(viewId) {
    this.programState.registerEvent("viewExit", viewId);
    const now = this.now();
    this.run(now);
  }

  run(now) {
    if (this.$lastPublishTime !== now) {
      this.$changedKeys = new Set();
      this.$lastPublishTime = now;
    }

    window.modelNetwork = this.programState;
    if (!this.programState.app) {
      // console.log("reinstate app");
      this.programState.app = this;
    }

    let changedKeys = this.programState.evaluate(now);
    changedKeys = this.$changedKeys.union(changedKeys);
    this.$changedKeys = changedKeys.intersection(this.modelToView);
    this.publish(this.id, "modelUpdate", this.$changedKeys);
  }

  ${methodsString}

  static types() {
    return {
      ProgramState: {
        cls: ProgramState,
        write: (ps) => {
          return {
            scripts: ps.scripts,
            resolved: ps.resolved,
            scratch: ps.scratch,
            time: ps.time,
            changeList: ps.changeList,
          };
        },
        read: (obj) => {
          // console.log("read");
          let ps = new ProgramState(0);
          ps.setupProgram(obj.scripts);
          ps.options = {once: true};
          ps.changeList = obj.changeList;
          ps.evaluate(obj.time);
          ps.resolved = obj.resolved;
          ps.scratch = obj.scratch;
          return ps;
        }
      },
      ${typesString || ""}
    }
  }
  static okayToIgnore() {return ["$changedKeys", "$lastPublishTime"];}
}
`.trim();

  const viewStr = `
class ${viewName} extends Croquet.View {
  constructor(model) {
    super(model);
    this.model = model;

    const nodes = decls(model.funcStr, this.model.realm);
    const {modelNodeStr, viewEventsStr, viewNodeStr, modelEventsStr} = strs(nodes);
    this.programState = new ProgramState(0, this);
    this.programState.setupProgram([viewNodeStr, modelEventsStr]);
    this.programState.announcer = (varName, value) => this.announcer(varName, value);
    window.viewNetwork = this.programState;
    this.programState.evaluate(this.now());

    this.initViewState();
    this.subscribe(this.model.id, {event: "modelUpdate", handling: "oncePerFrame"}, this.modelUpdate);
  }

  initViewState() {
    this.modelUpdate(this.model.modelToView);
  }

  modelUpdate(keys) {
    for (const key of keys) {
      const value = this.model.programState.resolved.get(key);
      if (value && value.value !== undefined) {
        this.programState.registerEvent(key, value.value);
      }
    }
  }

  announcer(varName, value) {
    if (this.model.viewToModel.has(varName)) {
      this.publish(this.model.id, "viewMessage", {name: varName, value: value});
    }
  }

  detach() {
    const detach = this.programState?.resolved.get("detach")?.value
    if (detach) {
      detach();
    }
    super.detach();
  }
}`.trim();

  const result = new Function(
    "funcStr", "realm", "ProgramState", "Croquet", "decls", "strs", "typesString",
    `return {model: ${modelStr}, view: ${viewStr}}`
  )(funcStr, realm, ProgramState, Croquet, decls, strs, typesString);

  return result;
}

export function trimParenthesis(str) {
  let start = 0;
  let end = str.length - 1;
  while (str[start] === "(") {
    start++;
  }
  while (str[end] === ")") {
    end--;
  }
  if (start === 0 && end === str.length - 1) {return str;}
  return str.slice(start, end + 1);
}

export function toFunction(code, name) {
  return `
function ${name}({}) {
${code.join("\n")}

return {}
}`.trim();
}

export function retrieve(docName) {
  return fetch(docName).then((resp) => resp.text()).then((result) => result);
}

export function parse(result) {
  const index = result.indexOf("{__codeMap: true, value:");
  if (index < 0) {
    console.log("unknown type of data");
    return {};
  }

  let data1 = JSON.parse(result.slice(0, index));
  const data2 = result.slice(index);
  const loaded = eval("(" + data2 + ")");
  if (!loaded.__codeMap) {console.log("wrong file format"); return null};
  return {codeArray: loaded.value, data1};
}

export function extract(codeArray, data1) {
  let windowEnabledMap = new Map();
  if (data1?.windowEnabled?.map?.values) {
    windowEnabledMap = new Map(data1?.windowEnabled?.map?.values);
  }
  let windowTypesMap = new Map();
  if (data1?.windowTypes?.map?.values) {
    windowTypesMap = new Map(data1?.windowTypes?.map?.values);
  }

  let titlesMap = new Map();
  if (data1?.titles?.map?.values) {
    titlesMap = new Map(data1?.titles?.map?.values);
  }

  const croquet = codeArray.find(([id, _obj]) => {
    return titlesMap.get(id).title === "Croquet" && windowEnabledMap?.get(id)?.enabled;
  })?.[1];
  const code = codeArray.filter((pair) => (
    !windowEnabledMap.get(pair[0]) ||
      (windowEnabledMap.get(pair[0]).enabled && windowTypesMap.get(pair[0]) === "code" &&
       titlesMap.get(pair[0]).title !== "Croquet")
  ));
  if (croquet) {
    const parsed = parseCroquet(croquet);
    return {code, croquet: parsed};
  }
  return {code, croquet: {}};
}

export function parseCroquet(croquet) {
  const trimmed = trimParenthesis(croquet);
  return eval("(" + trimmed + ")");
}

function basenames() {
  let url = window.location.origin + window.location.pathname;
  let match = /([^/]+)\.html$/.exec(url);
  let basename = new URL(window.location).searchParams.get("world");

  if (!basename) {
    basename = (!match || match[1] === "index") ? "index" : match[1];
  }

  let baseurl;
  if (match) {
    baseurl = url.slice(0, match.index);
  } else {
    let slash = url.lastIndexOf("/");
    baseurl = url.slice(0, slash + 1);
  }

  return {baseurl, basename};
}

function isRunningLocalNetwork() {
  let hostname = window.location.hostname;

  if (/^\[.*\]$/.test(hostname)) {
    hostname = hostname.slice(1, hostname.length - 1);
  }

  let local_patterns = [
    /^localhost$/,
    /^.*\.local$/,
    /^.*\.ngrok.io$/,
    // 10.0.0.0 - 10.255.255.255
    /^(::ffff:)?10(?:\.\d{1,3}){3}$/,
    // 127.0.0.0 - 127.255.255.255
    /^(::ffff:)?127(?:\.\d{1,3}){3}$/,
    // 169.254.1.0 - 169.254.254.255
    /^(::f{4}:)?169\.254\.([1-9]|1?\d\d|2[0-4]\d|25[0-4])\.\d{1,3}$/,
    // 172.16.0.0 - 172.31.255.255
    /^(::ffff:)?(172\.1[6-9]|172\.2\d|172\.3[01])(?:\.\d{1,3}){2}$/,
    // 192.168.0.0 - 192.168.255.255
    /^(::ffff:)?192\.168(?:\.\d{1,3}){2}$/,
    // fc00::/7
    /^f[cd][\da-f]{2}(::1$|:[\da-f]{1,4}){1,7}$/,
    // fe80::/10
    /^fe[89ab][\da-f](::1$|:[\da-f]{1,4}){1,7}$/,
    // ::1
    /^::1$/,
  ];

  for (let i = 0; i < local_patterns.length; i++) {
    if (local_patterns[i].test(hostname)) {return true;}
  }

  return false;
}

async function loadApiKey() {
  let local = isRunningLocalNetwork();
  let apiKeysFile = local ? "apiKey-dev.js" : "apiKey.js";
  let {baseurl} = basenames();

  try {
    // use eval to hide import from webpack
    const apiKeysModule = await eval(`import('${baseurl}${apiKeysFile}')`);
    return apiKeysModule.default;
  } catch (error) {
    return;
  }
}

export async function startWithCodeMirrorWithCroquet(args) {
  // {code, croquet, docName, ProgramState, useApiKeyFile, options = {}}
  ProgramState = args.ProgramState;
  const options = args.options;
  const codeArray = args.code;
  const {parameters, methods} = args.croquet;

  let apiKeyParameters;

  if (args.useApiKeyFile) {
    apiKeyParameters = await loadApiKey();
  }

  let appParameters = {...parameters?.appParameters, ...apiKeyParameters?.appParameters, ...options?.appParameters};

  let croquetParameters = {...parameters, ...apiKeyParameters};
  // parameters.appParameters = appParameters;

  let {name, realm, types} = croquetParameters;

  const code = codeArray.map(((pair) => pair[1]));

  let debug = appParameters.debug || [];
  if (!appParameters.name || !appParameters.password) {
    if (options.offline) {
      appParameters.autoSleep = 0;
      debug = [...debug, "offline"];
      appParameters.name = "abc";
      appParameters.password = "abc";
    }
  }

  if (!document.head.querySelector("#croquet-script")) {
    const script = document.createElement("script");
    script.id = "croquet-script";
    script.src = "./croquet.min.js";
    script.type = "text/javascript";
    await new Promise((resolve) => {
      script.onload = () => resolve(Croquet);
      document.head.appendChild(script);
    });
  }

  if (!codeMirrorObj) {
    const {CodeMirrorModel, CodeMirrorView, CodeMirror} = await import("./croquet-codemirror.js");
    codeMirrorObj = {CodeMirrorModel, CodeMirrorView, CodeMirror};
    window.CodeMirrorModel = CodeMirrorModel;
    window.CodeMirrorView = CodeMirrorView;
    window.CodeMirror = CodeMirror;
  }

  realm = realm ? new Map(realm.model.map((key) => [key, "Model"])) : new Map();
  const {model, view} = croquetify(
    toFunction(code, name),
    ProgramState,
    name,
    realm,
    types,
    methods);
  model.register(model.name);

  const session = await window.Croquet.Session.join({...appParameters, debug, model, view});
  return {session, ...codeMirrorObj, Croquet, croquetify, toFunction, splitStrs, trimParenthesis};
}

export async function startNoCodeMirrorWithCroquet(args) {
  // {code, croquet, docName, ProgramState, useApiKeyFile, options = {}}
  ProgramState = args.ProgramState;
  const options = args.options;
  const codeArray = args.code;
  const {parameters, methods} =  args.croquet;

  let apiKeyParameters;

  if (args.useApiKeyFile) {
    apiKeyParameters = await loadApiKey();
  }

  let appParameters = {...parameters.appParameters, ...apiKeyParameters?.appParameters, ...options.appParameters};

  let croquetParameters = {...parameters, ...apiKeyParameters};
  // parameters.appParameters = appParameters;

  let {name, realm, types} = croquetParameters;

  const code = codeArray.map(((pair) => pair[1]));

  let debug = appParameters.debug || [];
  if (!appParameters.name || !appParameters.password) {
    if (options.offline) {
      appParameters.autoSleep = 0;
      debug = [...debug, "offline"];
      appParameters.name = "abc";
      appParameters.password = "abc";
    }
  }

  if (!document.head.querySelector("#croquet-script")) {
    const script = document.createElement("script");
    script.id = "croquet-script";
    script.src = "./croquet.min.js";
    script.type = "text/javascript";
    await new Promise((resolve) => {
      script.onload = () => resolve(Croquet);
      document.head.appendChild(script);
    });
  }

  realm = realm ? new Map(realm.model.map((key) => [key, "Model"])) : new Map();
  const {model, view} = croquetify(
    toFunction(code, name),
    ProgramState,
    name,
    realm,
    types,
    methods);
  model.register(model.name);

  const session = await window.Croquet.Session.join({...appParameters, debug, model, view});
  return {session, Croquet, croquetify, toFunction, splitStrs, trimParenthesis};
}

export async function startWithCodeMirrorNoCroquet(args) {
  ProgramState = args.ProgramState;
  const codeArray = args.code;

  if (!codeMirrorObj) {
    const {CodeMirror} = await import("./renkon-codemirror.js");
    window.CodeMirror = CodeMirror;
    window.CodeMirrorModel = {
      create: ({doc, id, creator}) => {
        const newEditor = window.programState.resolved.get(creator)?.value;
        // this may not have a value, when the program being run does not have "newEditor.
        return newEditor(id, {doc});
      }
    };
    window.CodeMirrorView = {
      create: (Renkon, docModel, extensions) => {
        if (!docModel.viewState) {
          return {editor: new CodeMirror.EditorView({doc: docModel.doc, extensions})};
        }
        return {editor: docModel}
      }
    };
    codeMirrorObj = {CodeMirrorModel: window.CodeMirrorModel, CodeMirrorView: window.CodeMirrorView, CodeMirror};
  }

  const newProgramState = !window.programState;
  if (newProgramState) {
    window.programState = new ProgramState(Date.now());
  }
  window.programState.updateProgram(codeArray.map((pair) => ({ blockId: pair[0], code: pair[1] })), args.docName);
  if (newProgramState) {
    window.programState.evaluate(Date.now());
  }

  return {...codeMirrorObj};
}

export async function startNoCodeMirrorNoCroquet(args) {
  ProgramState = args.ProgramState;
  const codeArray = args.code;

  const newProgramState = !window.programState;
  if (newProgramState) {
    window.programState = new ProgramState(Date.now());
  }
  window.programState.updateProgram(codeArray.map((pair) => ({ blockId: pair[0], code: pair[1] })), args.docName);
  if (newProgramState) {
    window.programState.evaluate(Date.now());
  }

  return {};
}

export async function loader(options) {
  const {codemirror, padName} = options;
  const {basename} = basenames();
  const docName = padName || `${basename}.renkon`;
  const result = await retrieve(docName);
  const {codeArray, data1} = parse(result);
  const {code, croquet} = extract(codeArray, data1);
  const {parameters} = croquet;
  const url = new URL(window.location);
  const apiKeyParameters = await loadApiKey();

  const q = url.searchParams.get("q");

  if (parameters?.appParameters?.name || q || apiKeyParameters?.appParameters?.name) {

    const options = {appParameters: {}};
    if (q) {
      if (q === "offline") {
        options.appParameters.name = "abc";
        options.appParameters.password = "123";
        options.debug = ["offline"];
      } else {
        options.appParameters.name = q;
        if (url.hash && url.hash.startsWith("#pw=")) {
          options.appParameters.password = url.hash.slice("#pw=".length) || "abc";
        }
      }
    }
    if (codemirror) {
      return startWithCodeMirrorWithCroquet({code, croquet, ProgramState: window.ProgramState, useApiKeyFile: true, options});
    } else {
      return startNoCodeMirrorWithCroquet({code, croquet, ProgramState: window.ProgramState, useApiKeyFile: true, options});
    }
  }

  if (codemirror) {
    return startWithCodeMirrorNoCroquet({ProgramState: window.ProgramState, code: code});
  } else {
    return startNoCodeMirrorNoCroquet({ProgramState: window.ProgramState, code: code});
  }
}

/* globals Croquet */

