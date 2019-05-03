# Vscode-LSP
Vscode-LSP is a Language server + client for Visual Studio Code, that enables basic programmatic language features for the iAccess JSON schema.

## Start using Vscode-LSP

Vscode-LSP is published in the Visual Studio arketplace, and can be found using the keyword "Deltek" or "json lsp". Click the install button, and when you open a folder containing the "application.json" file somewhere in its path, the extension will become active.

Once you open a .json file in the folder, the extionsion will provide diagnostics for the "$ref":"URI" pattern, giving you an error if the URI you have written does not correspond to a file in the folder. 

Vscode-LSP also provides quick navigation throughout the directories of iAccess.
If a path exists, you can use Ctrl + click to open the referenced file, or right click and use "goto definition".

![](lsp.gif)

### Prerequisites
Only prerequisite for using the extension is Visual Studio Code

For development having node and npm installed is a requirement. This can be downloaded through nvm(Node Version Manager), which is prefered as the repository provides a .nvmrc.

After installing npm, use it to install typescript with
```
npm install -g typescript
```

### Development

First download the source from github

```
git clone https://github.com/Johanpdrsn/vscode-LSP
```

Then install all dependencies

```
npm install
```

The repository comes with a launch configuration, so to launch the extension in a "Extension Development Host" just go to debugging in the side bar, and select "Launch Client".
This will open up a new window with the extension running in debugging mode. 
All communication between the server and the client is logged in the "Language Server" channel. This can be found under "output" and selecting  "Language Server", and toggled on and of extension manifest(package.json).

There are 3 main files to look at when developing the extension:
1. Package.json - All contributions and dependencies of the extension are listed here.
2. client/src/extension.ts - The source code for the client part of the LSP
3. server/src/server.ts - The source code for the server part of the LSP

## Running the tests

The tests in the client/src/test folder, are end-2-end test using the mocha framework. These can be executed by going to the debugger and selecting "Run Tests". Again this will open a new window, performing the tests on the json files found under "TestFixtures". 

## Deployment

Deployment to the Visual Studio Marketplace is done with the vsce tool. Integration with Jenkins is on the roadmap.


## Versioning

We use [SemVer](http://semver.org/) for versioning.
