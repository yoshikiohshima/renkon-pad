# Renkon-pad: A Live and Self-Sustaining Programming Environment Based on Functional Reactive Programming

## Introduction

**Renkon-pad** is a live programming environment that allows you to create graphical, web-based applications interactively. The language used is called **Renkon**—see the [`renkon-core`](https://github.com/your-org/renkon-core) repository for more information.

Renkon-pad lets you create multiple text boxes and "runner" iframes, where the code in the text boxes can be executed. The image below shows an example interface:

<img src="./doc/renkon-pad2.png">

## The Interface

Renkon-pad includes several buttons and controls for interacting with the environment.

### The Menu

The top menu bar includes one text field and five buttons:

- The **text field** lets you enter the name of your project.
- The first two buttons, **"code"** and **"runner"**, create a new text box and a new runner, respectively.
- The third button cycles through three states: **"show graph"**, **"show deps"**, and **"hide graph"**:
  - **Show graph**: Hovering over a text box displays its imports and exports.
  - **Show deps**: Hovering over a node definition shows its dependencies.
  - **Hide graph**: Disables both overlays.

- The **"save"** button saves window positions and contents to a file named after the project with a `.json` suffix. *Note: The saved file is not a valid JSON file. This suffix may change in the future.*

### Text Box

Each text area uses CodeMirror for editing. The title bar contains:

- A **close** button,
- An **edit** button that lets you change the label in the title bar,
- A **checkmark** button in the top-left corner to enable or disable the box (this affects runners; see below).

### Runner

A runner includes:

- A **close** button,
- An **inspector** toggle button,
- A **play** button.

The **play** button gathers the contents of all enabled text boxes and runs them in the runner iframe as a Renkon program. The **inspector** button toggles visibility of the resolved stream values.

### Navigation Box

A floating widget at the bottom right includes:

- **Zoom in** and **zoom out** buttons,
- A **home** button, which repositions the view so all windows are visible.

You can also zoom using a pinch gesture on a touchpad or by holding **Ctrl** and scrolling with the mouse. *Note: These gestures must be performed on the background, not within a window.* You can also pan by dragging the background.

### Pan and Zoom

By default, runners do not handle gestures so user programs have full control. However, this means pinch gestures on a runner will trigger the browser's default zoom behavior, potentially zooming the entire page. If the navigation box disappears from view, use the browser's **View > Actual Size** menu or zoom back in on a runner.

Double-clicking a window’s title bar centers that window in the view.

### Other Ways to Start Renkon-pad

You can launch a saved `.json` file as a standalone app without loading the full Renkon-pad UI:

- Use `index.html?pad=some.json`.
- Alternatively, copy `index.html` to a new file (e.g., `abc.html`) and load it in the browser. If the HTML filename is not `index`, the startup code will look for a `.json` file with the same base name and load it automatically.

To start Renkon-pad and immediately load a file for editing, use:  
`index.html?file=abc.json`

### Typical Idioms and Workflow

Check out `renkon-pad.json`, `llama.json`, and `cf.json` for examples.

Unless you've customized `index.html`, the body of the document is empty—you'll need to set up your app’s DOM elements manually. The typical pattern is to use an immediately invoked function expression (IIFE) that creates DOM elements via `createElement`, `appendChild`, etc.

The IIFE should return either the created DOM element or a promise that resolves when all required resources are ready. Other nodes can then depend on this node to initialize consistently.

You can create multiple runners—useful for comparing different versions of your code. Pressing a runner’s **play** button re-runs the code, although subtle rules determine which nodes are re-evaluated. When in doubt, create a fresh runner.

Be sure to save your project regularly, though Renkon-pad is quite robust.

### Development Tips

Keep the browser's developer tools open during development. You can insert `debugger` statements inside reactive functions. Node names act as file names, so you’ll find them under the "Sources" tab in the developer tools as transpiled code.

Use `console.log` generously during development. Clicking the filename in the console output usually opens the corresponding transpiled code.
