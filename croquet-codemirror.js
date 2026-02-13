import {CodeMirror} from "./renkon-codemirror.js";
export {CodeMirror} from "./renkon-codemirror.js";

const {ChangeSet, Text, StateEffect, StateField, EditorState, Transaction, Facet} = CodeMirror.state;
const {receiveUpdates, rebaseUpdates, sendableUpdates, collab, getClientID, getSyncedVersion} = CodeMirror.collab;
const {Decoration, EditorView, ViewPlugin, WidgetType} = CodeMirror.view;

function encodeEffects(effects) {
  return effects.map((effect) => {
    if (effect.is(sharedSelectionEffect)) {
      return {type: "selection", value: effect.value};
    }
    return null;
  }).filter(e => e);
}

function decodeEffects(effects) {
  return effects.map((effect) => {
    if (effect.type === "selection") {
      return sharedSelectionEffect.of(effect.value);
    }
    return null;
  }).filter(e => e);
}

class TextWrapper {
  constructor(text) {
    this.text = text;
  }
}

class UpdatesWrapper {
  constructor(base, array, versions, clientIDs, lastUpdates) {
    this.base = base;
    this.array = array;
    this.versions = versions || new Map(); // clientIDs -> high mark<number>
    this.clientIDs = clientIDs || new Map(); // viewID -> [clientIDs]
    this.lastUpdates = lastUpdates || new Map(); // clientIDs -> updates
  }

  get length() {
    return this.base + this.array.length;
  }

  at(index) {
    const realIndex = index - this.base;
    return this.array[realIndex];
  }

  slice(from, to) {
    const realFrom = from - this.base;
    const realTo = to === undefined ? undefined : to - this.base;
    return this.array.slice(realFrom, realTo);
  }

  push(obj) {
    this.lastUpdates.set(obj.clientID, obj);
    this.array.push(obj);
  }

  setLowest() {
    const versions = [...this.versions.values()];
    const lowest = Math.min(...versions);
    if (lowest <= this.base) {return;}
    const newBase = lowest;
    const diff = lowest - this.base;
    const newArray = this.array.slice(diff);
    this.base = newBase;
    this.array = newArray;
  }

  setVersion(viewId, clientID, version) {
    let set = this.clientIDs.get(viewId);
    if (set === undefined) {
      set = new Set();
      this.clientIDs.set(viewId, set);
    }
    set.add(clientID);
    this.versions.set(clientID, version);

    this.setLowest();
  }

  viewExit(viewId) {
    const clientIDs = this.clientIDs.get(viewId);
    this.clientIDs.delete(viewId);
    if (clientIDs === undefined) {return;}
    for (const clientID of clientIDs) {
      this.versions.delete(clientID);
      this.lastUpdates.delete(clientID);
    }
    this.setLowest();
  }

  clientExit(viewId, clientID) {
    this.clientIDs.delete(viewId);
    this.versions.delete(clientID);
    this.setLowest();
  }
}

export class CodeMirrorModel extends Croquet.Model {
  init(options) {
    let doc = options.doc;
    if (typeof doc === "string") {
      doc = doc.split("\n");
    } else if (typeof doc === "undefined") {
      doc = [""];
    }

    this.doc = new TextWrapper(Text.of(doc));
    this.updates = new UpdatesWrapper(0, []);
    this.pending = [];
    this.colors = new Map() // viewId => css color string
    this.subscribe(this.id, "collabMessage", this.collabMessage);
    this.subscribe(this.sessionId, "view-exit", this.viewExit);
  }

  static types() {
    return {
      TextWrapper: {
        cls: TextWrapper,
        write: (obj) => {
          return obj.text.toJSON();
        },
        read: (data) => {
          return new TextWrapper(Text.of(data));
        }
      },
      UpdatesWrapper: {
        cls: UpdatesWrapper,
        write: (obj) => {
          const writer = u => ({
            clientID: u.clientID,
            changes: u.changes.toJSON(),
            effects: encodeEffects(u.effects || [])
          });
          const array = obj.array.map(writer);
          const lastUpdates = [...obj.lastUpdates.values()].map(writer)
          return {
            base: obj.base,
            array,
            versions: obj.versions,
            clientIDs: obj.clientIDs,
            lastUpdates
          };
        },
        read: (data) => {
          const reader = u => ({
            changes: ChangeSet.fromJSON(u.changes),
            clientID: u.clientID,
            effects: decodeEffects(u.effects || []),
          });
          const array = data.array.map(reader);
          const mapped = data.lastUpdates.map((u) => {
            const read = reader(u);
            return [read.clientID, read]
          });
          const lastUpdates = new Map(mapped);
          return new UpdatesWrapper(data.base, array, data.versions, data.clientIDs, lastUpdates);
        }
      }
    }
  }

  collabMessage(event) {
    // following code at:
    // https://github.com/codemirror/website/tree/main/site/examples/collab
    // an implicit logic is that only peer that the ports[0], which was the sender of the message
    // The model to view message sent from here contains the clientID and only the receiver who has that clientID
    // acts on it.
    const {type, version, updates, clientID, viewId} = event;
    // console.log("model", event);
    if (!this.colors.get(viewId)) {
      this.colors.set(viewId, this.randomColor(viewId));
    }
    if (type === "pullUpdates") {
      if (version < this.updates.length) {
        this.publish(this.id, "collabUpdate", {clientIDs: [clientID], type: "pullUpdates", start: version, end: this.updates.length});
      } else {
        this.pending.push(event.clientID);
      }
    } else if (type === "pushUpdates") {
      let received = updates.map(json => ({
        clientID: json.clientID,
        changes: ChangeSet.fromJSON(json.changes),
        effects: decodeEffects(json.effects || [])
      }));

      if (version !== this.updates.length) {
        received = rebaseUpdates(received, this.updates.slice(version));
      }

      const pendingStart = this.updates.length;

      for (let update of received) {
        this.updates.push(update);
        this.doc = new TextWrapper(update.changes.apply(this.doc.text));
      }
      const pendingEnd = this.updates.length;
      this.publish(this.id, "collabUpdate", {clientIDs: [clientID], type: "ok"});
      if (received.length > 0) {
        // let json = received.map(update => ({
        // clientID: update.clientID,
        // changes: update.changes.toJSON()
        // }));
        const pending = this.pending;
        this.pending = [];
        this.publish(this.id, "collabUpdate", {clientIDs: pending, type: "pullUpdates", start: pendingStart, end: pendingEnd});
        //while (this.pending.length > 0) {
        // const sendTo = this.pending.pop();
        // this.publish(this.id, "collabUpdate", {clientID: sendTo, type: "pullUpdates", start: pendingStart, end: pendingEnd});
        //}
      }
    } else if (type === "getDocument") {
      this.publish(this.id, "collabUpdate", {type: "getDocument"});
    } else if (type === "destroy") {
      console.log("destroy", this.updates, event);
      this.updates.clientExit(viewId, clientID);
    }
    this.updates.setVersion(viewId, clientID, version);
  }

  randomColor(viewId) {
    let h = Math.floor(parseInt(viewId, 36) / (36 ** 10) * 360);
    let s = "40%";
    let l = "40%";
    let a = "70%";
    return `hsl(${h}, ${s}, ${l} / ${a})`;
  }

  viewExit(viewId) {
    this.updates.viewExit(viewId);
    this.colors.delete(viewId);
  }
}

CodeMirrorModel.register("CodeMirrorModel");


const viewIdFacet = Facet.define({
  combine(values) {
    return values.length ? values[0] : null;
  }
});

const colorLookupFacet = Facet.define({
  combine(values) {
    return values.length ? values[0] : () => null;
  }
});

const sharedSelectionEffect = StateEffect.define({
  map(value, changes) {
    const ranges = value.ranges.map((range) => mapSelectionRange(range, changes));
    return {clientID: value.clientID, viewId: value.viewId, ranges};
  }
});

const remoteSelectionsField = StateField.define({
  create() {
    return new Map();
  },
  update(value, tr) {
    let mapped = value;
    if (tr.docChanged && value.size) {
      const next = new Map();
      for (const [key, ranges] of value.entries()) {
        next.set(key, ranges.map((range) => mapSelectionRange(range, tr.changes)));
      }
      mapped = next;
    }
    for (const effect of tr.effects) {
      if (effect.is(sharedSelectionEffect)) {
        const {viewId, clientID, ranges} = effect.value;
        const key = viewId || clientID;
        const next = new Map(mapped);
        if (!ranges || ranges.length === 0) {
          next.delete(key);
        } else {
          next.set(key, ranges);
        }
        mapped = next;
      }
    }
    return mapped;
  }
});

const sharedSelectionExtender = EditorState.transactionExtender.of((tr) => {
  if (!tr.selection) return null;
  if (tr.annotation(Transaction.remote)) return null;
  if (tr.effects.some((effect) => effect.is(sharedSelectionEffect))) return null;
  const ranges = tr.selection.ranges.map((range) => ({
    anchor: range.anchor,
    head: range.head
  }));
  const viewId = tr.startState.facet(viewIdFacet);
  return {effects: sharedSelectionEffect.of({clientID: getClientID(tr.startState), viewId, ranges})};
});

function mapSelectionRange(range, changes) {
  const forward = range.anchor <= range.head;
  const anchor = changes.mapPos(range.anchor, forward ? 1 : -1);
  const head = changes.mapPos(range.head, forward ? -1 : 1);
  return {anchor, head};
}

class RemoteCursorWidget extends WidgetType {
  constructor(color) {
    super();
    this.color = color;
  }

  eq(other) {
    return other.color === this.color;
  }

  toDOM() {
    const dom = document.createElement("span");
    dom.className = "cm-remoteCursor";
    if (this.color) {
      dom.style.borderColor = this.color;
    }
    return dom;
  }
}

const remoteSelectionsDecorations = EditorView.decorations.compute(
  [remoteSelectionsField],
  (state) => {
    const selections = state.field(remoteSelectionsField);
    const colorLookup = state.facet(colorLookupFacet);
    const decorations = [];

    for (const [viewId, ranges] of selections.entries()) {
      const color = colorLookup(viewId);
      for (const range of ranges) {
        const from = Math.min(range.anchor, range.head);
        const to = Math.max(range.anchor, range.head);
        if (from !== to) {
          const spec = color
            ? {class: "cm-remoteSelection", attributes: {style: `background-color: ${color};`}}
            : {class: "cm-remoteSelection"};
          decorations.push(Decoration.mark(spec).range(from, to));
        } else {
          decorations.push(Decoration.widget({widget: new RemoteCursorWidget(color), side: 1}).range(from));
        }
      }
    }

    return Decoration.set(decorations, true);
  }
);

export class CodeMirrorView extends Croquet.View {
  constructor(model, extensions) {
    super(model);
    this.model = model;
    this.subscribe(this.model.id, "collabUpdate", this.collabUpdate);
    const config = this.viewConfig(extensions || []);
    this.view = new CodeMirror.EditorView(config);
    this.clientID = getClientID(this.view.state);
    this.applyLastUpdates();
    this.pullPromise = null;
    this.pushPromise = null;
    this.done = false;
    this.pull();
    this.editor = this.view;
  }

  applyLastUpdates() {
    const lastUpdates = this.getLastUpdates();
    if (!lastUpdates || lastUpdates.size === 0) {
      return;
    }

    const effects = [];
    for (const update of lastUpdates.values()) {
      if (!update.effects || update.clientID === this.clientID) {
        continue;
      }
      for (const effect of update.effects) {
        if (effect.is(sharedSelectionEffect)) {
          effects.push(effect);
        }
      }
    }

    if (effects.length) {
      this.view.dispatch({effects, annotations: [Transaction.remote.of(true)]});
    }
  }

  viewConfig(extensions) {
    const sharedEffects = (tr) => {
      return tr.effects.filter(e => e.is(sharedSelectionEffect));
    };
    return {
      doc: this.model.doc.text || "",
      extensions: [
        ...extensions,
        viewIdFacet.of(this.viewId),
        colorLookupFacet.of((viewId) => this.model.colors.get(viewId)),
        remoteSelectionsField,
        remoteSelectionsDecorations,
        sharedSelectionExtender,
        collab({startVersion: this.model.updates.length, sharedEffects}),
        ViewPlugin.define(_view => this)
      ]
    }
  }

  sendPushUpdates(version, fullUpdates) {
    let updates = fullUpdates.map(u => ({
      clientID: u.clientID,
      changes: u.changes.toJSON(),
      effects: encodeEffects(u.effects || [])
    }));
    // console.log("push", getClientID(this.view.state), version, updates);
    this.publish(this.model.id, "collabMessage", {type: "pushUpdates", version, clientID: this.clientID, updates, viewId: this.viewId});
    return new Promise((resolve) => {
      this.pushPromise = resolve;
    });
  }

  sendPullUpdates(version) {
    this.publish(this.model.id, "collabMessage", {type: "pullUpdates", version, clientID: this.clientID, viewId: this.viewId});
    return new Promise((resolve) => {
      this.pullPromise = resolve;
    });
  }

  collabUpdate(data) {
    // console.log("view message", data);
    const type = data.type;
    const clientIDs = data.clientIDs;
    if (!clientIDs.includes(this.clientID)) {return;}
    if (type === "pullUpdates") {
      const resolve = this.pullPromise;
      if (!resolve) {
        // console.log("probably this client went away")
        return;
      }
      this.pullPromise = null;
      resolve(data);
    } else if (type === "ok") {
      const resolve = this.pushPromise;
      if (!resolve) {
        // console.log("probably this client went away");
        return;
      }
      this.pushPromise = null;
      resolve(true);
    }
  }

  async push() {
    let updates = sendableUpdates(this.view.state);
    // console.log("maybe push", getClientID(this.view.state), updates);
    if (this.pushPromise || updates.length === 0) return
    let version = getSyncedVersion(this.view.state);
    // console.log("actually push", getClientID(this.view.state));
    const pushResult = this.sendPushUpdates(version, updates);
    await pushResult;
    // console.log("push done", pushResult);
    // Regardless of whether the push failed or new updates came in
    // while it was running, try again if there's updates remaining
    if (sendableUpdates(this.view.state).length) {
      setTimeout(() => this.push(), 100)
    }
  }

  async pull() {
    while (!this.done) {
      let version = getSyncedVersion(this.view.state);
      let pullResult = this.sendPullUpdates(version);
      // console.log("pullResult", pullResult);
      let updateInfo = await pullResult;
      // console.log("updateInfo", updateInfo);
      const updates = this.model.updates.slice(updateInfo.start, updateInfo.end);
      this.view.dispatch(receiveUpdates(this.view.state, updates));
    }
  }

  getDocument() {
    return {
      version: this.model.version,
      doc: this.model.doc.text,
    }
  }

  getRemoteSelections() {
    return this.view.state.field(remoteSelectionsField);
  }

  detach() {
    console.log("detach editor");
    super.detach();
  }

  // update and destroy are the required methods for a CodeMirror plugin.
  update(update) {
    const hasSharedSelectionEffect = update.transactions.some((tr) =>
      tr.effects.some((effect) => effect.is(sharedSelectionEffect))
    );

    if (update.docChanged || hasSharedSelectionEffect) {
      // console.log("view update", this.view.dom.id, getSyncedVersion(this.view.state), update);
      this.push();
      return;
    }
  }

  getLastUpdates() {
    return this.model.updates.lastUpdates;
  }

  destroy() {
    this.publish(this.model.id, "collabMessage", {type: "destroy", clientID: this.clientID, viewId: this.viewId});
    this.done = true;
  }

  static create(Renkon, model, extensions) {
    const view = new this(Renkon.app.model.getModel(model.id), extensions);
    return view;
  }
}

/* globals Croquet */
