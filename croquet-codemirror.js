import {CodeMirror} from "./renkon-codemirror.js";
export {CodeMirror} from "./renkon-codemirror.js";
const reconcileAnnotationType = CodeMirror.state.Annotation.define();

const newCompartment = () => new CodeMirror.state.Compartment();

function handleEvent(event, _state) {
  function handleInsert(event) {
    const index = event.fromA;
    return [{ from: index, to: event.toA, insert: event.text }];
  }
  function handleSplice(event) {
    const index = event.index;
    return [{ from: index, insert: event.value }];
  }
  function handleDel(event) {
    const length = event.length || 1;
    const index = event.index;
    return [{ from: index, to: index + length }];
  }

  if (event.action === "insert") {
    return handleInsert(event);
  } else if (event.action === "splice") {
    return handleSplice(event);
  } else if (event.action === "del") {
    return handleDel(event);
  } else {
    return null;
  }
}

function applyCrEventToCm(view, events, viewId) {
  let selection = view.state.selection;
  for (const event of events) {
    if (viewId !== undefined && viewId === event.viewId) {continue;}
    const changeSpec = handleEvent(event, view.state);
    if (changeSpec != null) {
      const changeSet = CodeMirror.state.ChangeSet.of(changeSpec, view.state.doc.length, "\n");
      selection = selection.map(changeSet, 1);
      view.dispatch({
        changes: changeSet,
        annotations: reconcileAnnotationType.of({}),
      });
    }
  }
  view.dispatch({
    selection,
    annotations: reconcileAnnotationType.of({}),
  });
};

export class CodeMirrorModel extends Croquet.Model {
  init(options) {
    super.init();
    this.editor = new CodeMirror.EditorView(this.modelConfig(options.doc, newCompartment()));
    this.setupCroquet(this.editor, this);
    this.subscribe(this.id, "edit", "changed");
  }

  modelConfig(doc, compartment, selection) {
    this.croquetExt = compartment;
    return {
      doc: doc || "",
      selection,
      extensions: [
        this.croquetExt.of([]),
      ]
    };
  }

  setupCroquet(editor, model) {
    editor.croquetModel = model;
    editor.dispatch({
      effects: this.croquetExt.reconfigure([
        CodeMirror.view.ViewPlugin.define(_view => model)
      ])
    });
  }

  changed(data) {
    const view = this.editor;
    //console.log("receive model", this.id, data);
    applyCrEventToCm(view, data);
    //console.log("changed", this.id, this.editor.state.doc.toString());
    this.publish(this.id, "update", data);
  }

  destroy() {
    this.unsubscribe(this.id, "edit", "changed");
  }

  static types() {
    return {
      AnnotationType: {
        cls: CodeMirror.state.AnnotationType,
        read: (_obj) => reconcileAnnotationType,
        write: () => ''
      },
      Compartment: {
        cls: CodeMirror.state.Compartment,
        read: (_obj) => newCompartment(),
        write: () => ''
      },
      EditorView: {
        cls: CodeMirror.EditorView,
        read: (obj) => {
          const {model, doc, selection} = obj;
          const text = CodeMirror.state.Text.of(doc);
          let sel;
          if (selection.ranges) {
            sel = CodeMirror.state.EditorSelection.fromJSON(selection);
          } else {
            sel = CodeMirror.state.EditorSelection.single(0, 0);
          }
          const editor = new window.CodeMirror.EditorView(model.modelConfig(text, model.croquetExt, sel));
          model.setupCroquet(editor, model);
          return editor;
        },
        write: (obj) => {
          return {model: obj.croquetModel, doc: obj.viewState.state.doc.toJSON(), selection: obj.viewState.state.selection.toJSON()};
        }
      }
    }
  }
}

CodeMirrorModel.register("CodeMirrorModel");

export class CodeMirrorView extends Croquet.View {
  constructor(model, extensions) {
    super(model);
    this.model = model;
    this.editor = new CodeMirror.EditorView(this.viewConfig(model.editor.state.doc, model.editor.state.selection, extensions || [], newCompartment()));
    this.setupCroquet(this.editor, this);
    //console.log("view constructor", this.model.id, "update", this.editor.state.doc.toString());
    this.subscribe(this.model.id, "update", this.updated);
    this.subscribe(this.viewId, "synced", this.synced);
    this.viewSynced = true;
  }

  detach() {
    super.detach();
  }

  viewConfig(doc, selection, extensions, compartment) {
    this.croquetExt = compartment;
    return {
      doc: doc || "",
      selection,
      extensions: [...extensions, this.croquetExt.of([])],
    }
  }

  synced(value) {
    this.viewSynced = value;
    if (value === true) {
      const modelJSON = this.model.editor.viewState.state.doc.toJSON();
      const viewJSON = this.editor.viewState.state.doc.toJSON();
      if (JSON.stringify(modelJSON) !== JSON.stringify(viewJSON)) {
        this.editor.state.update({
          changes: {
            from: 0,
            to: this.editor.state.doc.length,
            insert: this.model.editor.state.doc.toString()
          }
        });
        console.log("synced, and update", this.viewId, this.model.editor.state.doc.toString());
      }
    }
  }

  setupCroquet(editor, view) {
    editor.dispatch({
      effects: this.croquetExt.reconfigure([
        CodeMirror.view.ViewPlugin.define(_view => view)
      ])
    });
  }

  isReconcileTx(tr) {return !!tr.annotation(reconcileAnnotationType)};

  transationsToEvents(transactions) {
    // console.log("translation", transactions);
    const transactionsWithChanges = transactions.filter(tr => !this.isReconcileTx(tr) && !tr.changes.empty);
    if (transactionsWithChanges.length === 0) {
      return;
    }

    const result = [];

    transactionsWithChanges.forEach((tr) => {
      tr.changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
        result.push({action: "insert", fromA, fromB, toA, toB, text: inserted.toString(), viewId: this.viewId});
      });
    });

    return result;
  }

  publishCmTransactions(events) {
    //console.log("publish", this.viewId, "edit", events);
    this.publish(this.model.id, "edit", events);
  }

  update(update) {
    // console.log("update", this.viewId, update);
    const events = this.transationsToEvents(update.transactions);
    if (events) {
      this.publishCmTransactions(events);
    }
  }

  updated(data) {
    // console.log("view updated", this.viewId, data, this.viewSynced);
    const view = this.editor;
    if (!this.viewSynced) {return;}
    // console.log("view before change", this.viewId, this.model.editor.state.doc.toString(), this.editor.state.doc.toString());
    applyCrEventToCm(view, data, this.viewId);
  };

  static create(Renkon, model, extensions) {
    // console.log("view create", model);
    const view = new this(Renkon.app.model.getModel(model.id), extensions);
    return view;
  }
}

/* globals Croquet */
