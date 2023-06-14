# git-watch-vscode-rename

## Brief explanation
There is a specific case Git can't deal: changing case only.
You can commit, but another machine that already has this project with old filename won't recognize the name changes to be made to these files.

Let's say there is a file named `Page.js`:
- `Page.js` being renamed to `page.js` can't be tracked by Git, at least for Windows and MacOS. Linux seems to be working fine.

### Cases where this extension will not work (because there is no need, works fine in Git):
- When there is more changes to file name than changed case only. Example: `Page.js` being renamed to `_Page.js` or `_page.js`.
- Changing file extension. Example: `Page.js` to `Page.ts` or `page.ts`.

## Features

Automatically run 'git mv' command, when renaming files/folders in VS Code, just for occasions where only file/folder name case was changed.

https://git-scm.com/docs/git-mv

## Requirements

Git must have been installed and the renamed file need to be watched by it.

## Usage

Rename file/folder normally as you would. This extension will be watching for file/folder name changes and will run by its own.

## Release Notes

### 1.1.0

- Bug fixes
- Detailed logs on extension's output channel

### 1.0.0

Initial release of git-watch-vscode-rename
