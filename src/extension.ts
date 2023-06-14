// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
const cp = require("child_process");
const packageJson = require("../package.json");

let log: ReturnType<(typeof HelperFunctions)["createLogger"]>;

const disposable = vscode.workspace.onWillRenameFiles(async (event) => {
  try {
    for (const file of event.files) {
      const oldPath = HelperFunctions.removeInitialSlash(file.oldUri.path);
      const newPath = HelperFunctions.removeInitialSlash(file.newUri.path);
      const oldPathWithoutFilename = oldPath.split("/").slice(0, -1).join("/");

      if (oldPath.toLowerCase() !== newPath.toLowerCase()) {
        log("[INFO]", "Changed file extension or parent folder. No operation needed, doing nothing.");
        return;
      }

      // if not a git repo, do nothing
      const isGitRepo = await HelperFunctions.isGitRepository(oldPathWithoutFilename);
      if (!isGitRepo) return;

      // get git project root path
      const gitProjectRoot = await HelperFunctions.execShell("git rev-parse --show-toplevel", oldPathWithoutFilename);

      // get git untracked files
      const untrackedGitFiles = (
        await HelperFunctions.execShell(`git -C "${gitProjectRoot}" ls-files --exclude-standard --others`)
      ).split("\n");

      const oldPathSegments = HelperFunctions.getPathSegments({
        path: oldPath,
        gitRoot: gitProjectRoot,
      });

      const newPathSegments = HelperFunctions.getPathSegments({
        path: newPath,
        gitRoot: gitProjectRoot,
      });

      if (
        untrackedGitFiles.some(
          (untrackedFile) =>
            untrackedFile.toLowerCase() ===
            HelperFunctions.removeInitialSlash(
              `${oldPathSegments.directory}/${oldPathSegments.fileName}${oldPathSegments.fileExtension}`
            ).toLowerCase()
        )
      ) {
        log("[INFO]", "File is not tracked by Git yet. No operation needed, doing nothing.");
        return;
      }

      const temporaryFileName = HelperFunctions.generateId();
      const command = [
        `git -C "${gitProjectRoot}"`,
        `mv ".${oldPathSegments.directory}/${oldPathSegments.fileName}${oldPathSegments.fileExtension}"`,
        `".${oldPathSegments.directory}/${temporaryFileName}${oldPathSegments.fileExtension}"`,
        `&&`,
        `git -C "${gitProjectRoot}"`,
        `mv ".${oldPathSegments.directory}/${temporaryFileName}${oldPathSegments.fileExtension}"`,
        `".${oldPathSegments.directory}/${newPathSegments.fileName}${newPathSegments.fileExtension}"`,
      ].join(" ");

      await HelperFunctions.execShell(command);

      log(
        "[INFO]",
        `File successfully renamed from '${oldPathSegments.fileName}${oldPathSegments.fileExtension}' to '${newPathSegments.fileName}${newPathSegments.fileExtension}'.`
      );
    }
  } catch (error: any) {
    log("ERROR:", error.toString());

    const err = error as Awaited<ReturnType<(typeof HelperFunctions)["execShell"]>>;
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
});

export function activate(context: vscode.ExtensionContext) {
  let channel = vscode.window.createOutputChannel("git-watch-vscode-rename");
  log = HelperFunctions.createLogger(channel);
  log("Extension is now active!");
  context.subscriptions.push(disposable);
}

export function deactivate(_context: vscode.ExtensionContext) {}

/* From here to end of the file, there's only helper functions */
const HelperFunctions = {
  async execShell(command: string, cwd?: string) {
    return new Promise<string>((resolve, reject) => {
      cp.exec(command, { cwd }, (_: any, stdout: string, stderr: string) => {
        if (stderr) {
          stderr = stderr.trim();
          log("[EXECUTING]:", command, "[ERROR]:", stderr);
          reject(stderr);
        } else {
          stdout = stdout.trim();
          log(
            "[EXECUTING]:",
            command,
            // command execution result
            stdout && "[RESULT]:",
            stdout && stdout
          );
          resolve(stdout);
        }
      });
    });
  },

  async isGitRepository(path: string) {
    try {
      const command = `git -C "${path.trim()}" rev-parse --is-inside-work-tree`;
      const result = await this.execShell(command);
      const outTrimmed = result.replace(/\r?\n|\r/g, "");
      return outTrimmed === "true";
    } catch (error: any) {
      log("[INFO]", "Not a Git repository. Doing nothing.");
      return false;
    }
  },

  getPathSegments({ path, gitRoot }: { path: string; gitRoot: string }) {
    const directory = path
      .replace(new RegExp(`${gitRoot}`, "i"), "")
      .split("/")
      .slice(0, -1)
      .join("/");

    const finalPathSegment = path.split("/").slice(-1).join("/");
    const splittedFinalPathSegment = finalPathSegment.split(".").slice(-1);

    const lastValueFromSplittedFinalPathSegment = splittedFinalPathSegment[splittedFinalPathSegment.length - 1];
    const fileExtension = this.getFileExtension(
      finalPathSegment.length === 1
        ? lastValueFromSplittedFinalPathSegment
        : `.${lastValueFromSplittedFinalPathSegment}`
    );

    const fileName = finalPathSegment.split(".").slice(0, -1).join(".");

    return {
      directory, // path based on git project root, without file's name/extension
      fileName,
      fileExtension,
    };
  },

  generateId: () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
  getFileExtension: (fileExtension: string) => (fileExtension.includes(".") ? fileExtension : ""),
  removeInitialSlash: (path: string) => (path.charAt(0) === "/" ? path.slice(1) : path),

  createLogger:
    (channel: vscode.OutputChannel) =>
    (...str: string[]) => {
      str.forEach((s) => {
        if (s.length === 0) return;
        channel.appendLine(s);
      });
      channel.appendLine("");
    },
};
