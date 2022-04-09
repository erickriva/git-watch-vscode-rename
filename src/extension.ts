// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
const cp = require("child_process");
const packageJson = require("../package.json");

let log: ReturnType<typeof logger>;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  let channel = vscode.window.createOutputChannel("git-watch-vscode-rename");
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  log = logger(channel);
  log("**** Congratulations, your extension 'git-watch-vscode-rename' is now active! ****");

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  // The code you place here will be executed every time your command is executed

  const disposable = vscode.workspace.onWillRenameFiles(async (event) => {
    for (const file of event.files) {
      const path = removeInitialSlash(file.oldUri.path);
      const newPath = removeInitialSlash(file.newUri.path);

      const tempPath = path.slice(0, path.lastIndexOf("/"));
      const isGitRepo = await isGitRepository(tempPath);

      if (path.toLowerCase() === newPath.toLowerCase() && isGitRepo) {
        const tempName = generateId();

        const oldP = getPathSegments(path);
        const newP = getPathSegments(newPath);

        const fullTempPath = `${tempName}${oldP.pathExtension}`;

        let command = [
          "git",
          `-C ${tempPath}`,
          `mv ${oldP.finalPathSegment} ${fullTempPath}`,
          "&&",
          "git",
          `-C ${tempPath}`,
          `mv ${fullTempPath} ${newP.finalPathSegment}`,
        ].join(" ");

        log(`command to run: ${command}`);

        try {
          await execShell(command);
        } catch (error) {
          const err = error as Awaited<ReturnType<typeof execShell>>;
          const answer = await vscode.window.showErrorMessage(
            `${err}\n\nYou can open an issue about it if you want to.`,
            "Open an issue"
          );

          if (answer === "Open an issue") {
            let uri = packageJson.repository.url;
            uri += "/issues/new";
            uri += "?title=Uncaught Exception";
            uri += `&body=ERROR MESSAGE:\n${err}`;

            const encoded = encodeURI(uri);
            vscode.env.openExternal(vscode.Uri.parse(encoded));
          }
        }
      }
    }
  });

  context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {}

/* From here to end of the file, it is only helper functions */
const generateId = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

const getFileExtension = (fileExtension: string) => (fileExtension.includes(".") ? fileExtension : "");

const removeInitialSlash = (path: string) => (path.charAt(0) === "/" ? path.slice(1) : path);

const execShell = (cmd: string) => {
  return new Promise<string>((resolve, reject) => {
    cp.exec(cmd, (_: any, stdout: string, stderr: string) => {
      if (stderr) {
        reject(stderr);
      } else {
        resolve(stdout);
      }
    });
  });
};

const isGitRepository = async (path: string) => {
  const command = `git -C ${path} rev-parse --is-inside-work-tree`;
  log(`command to know if it is inside a GIT repository: ${command}`);

  try {
    const result = await execShell(command);
    const outTrimmed = result.replace(/\r?\n|\r/g, "");
    return outTrimmed === "true";
  } catch (err) {
    vscode.window.showInformationMessage(
      `'git mv' command will not be executed, because a Git repository was not found at ${path}`
    );
    return false;
  }
};

const getPathSegments = (path: string) => {
  const pathSegments = path.split("/");
  const finalPathSegment = pathSegments[pathSegments.length - 1];
  const splittedFinalPathSegment = pathSegments[pathSegments.length - 1].split(".");
  const lastValueFromSplittedFinalPathSegment = splittedFinalPathSegment[splittedFinalPathSegment.length - 1];
  const pathExtension = getFileExtension(
    finalPathSegment.length === 1 ? lastValueFromSplittedFinalPathSegment : `.${lastValueFromSplittedFinalPathSegment}`
  );
  return {
    finalPathSegment,
    pathExtension,
  };
};

export default function logger(channel: vscode.OutputChannel) {
  return function (str: string) {
    channel.appendLine(str);
    channel.appendLine("");
  };
}
