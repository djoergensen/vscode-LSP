import {ExtensionContext, workspace, window} from 'vscode';
import {join} from "path";
import {LanguageClient, LanguageClientOptions, ServerOptions, TransportKind} from "vscode-languageclient";


let client : LanguageClient;
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: ExtensionContext) {

	let workSpaceFolder = workspace.getWorkspaceFolder;



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
}
// Called when extension 
export function deactivate(): Thenable<void> {
	if (!client) {
	  return undefined;
	}
	return client.stop();
  }
