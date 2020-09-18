import { ExtensionContext, workspace, window } from 'vscode';
import { join } from "path";
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from "vscode-languageclient";

let client: LanguageClient;

export function activate(context: ExtensionContext) {

	let serverModule = context.asAbsolutePath(
		join("server", "out", "server.js")
	);



	let debugOptions = { execArgv: ["--nolazy", "--inspect=6009"] };

	let serverOptions: ServerOptions = {
		run: { module: serverModule, transport: TransportKind.ipc },
		debug: {
			module: serverModule,
			transport: TransportKind.ipc,
			options: debugOptions
		}
	};

	let clientOptions: LanguageClientOptions = {
		documentSelector: [{ scheme: "file", language: "json" }],
		synchronize: {
			fileEvents: workspace.createFileSystemWatcher("**/.clientrc")
		}
	};

	client = new LanguageClient(
		"languageServer",
		"Language Server",
		serverOptions.debug,
		clientOptions
	);

	client.onReady().then(() => {
		client.onNotification("custom/hasSchema", (file: string) => {
			window.showErrorMessage("No schema.json found for: " + file +
				" vscode-lsp plugin will have limitied functionality");
		});
	});


	client.start();

}
// Called when extension is closed
export function deactivate(): Thenable<void> {
	if (!client) {
		return undefined;
	}
	return client.stop();
}
