// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import {ExtensionContext, workspace, commands, window} from 'vscode';
import {join} from "path";
import {LanguageClient, LanguageClientOptions, ServerOptions, TransportKind} from "vscode-languageclient";


let client : LanguageClient;
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "lsp" is now active!');

	let serverModule = context.asAbsolutePath(
		join("server", "out", "server.js")
	);

	let debugOptions = {execArgv:["--nolazy", "--inspect=6009"]};


	let serverOptions: ServerOptions = {
		run: {module: serverModule, transport: TransportKind.ipc},
		debug: {
			module: serverModule,
			transport: TransportKind.ipc,
			options: debugOptions
		}
	};

	let clientOptions: LanguageClientOptions = {
		documentSelector: [{scheme: "file", language: "json"}],
		synchronize: {
			fileEvents: workspace.createFileSystemWatcher("**/.clientrc")
		}
	};

	
	client = new LanguageClient(
		"languageServer",
		"Language Server",
		serverOptions,
		clientOptions
	);
	client.start();
	//Register command
	let disposable = commands.registerCommand('extension.lsp', () => {

		window.showInformationMessage('Hello World!');
	});

	context.subscriptions.push(disposable);
}
// Called when extension 
export function deactivate(): Thenable<void> {
	if (!client) {
	  return undefined;
	}
	return client.stop();
  }
