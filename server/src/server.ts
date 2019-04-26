import * as ls from "vscode-languageserver";
import Uri from 'vscode-uri';
import { TextDocument, InitializeParams, DidChangeConfigurationNotification, Diagnostic, DiagnosticSeverity,
    TextDocumentPositionParams, CompletionItem, CompletionItemKind, Position, Location, Range} from "vscode-languageserver";
import { existsSync, readFileSync, read} from "fs";

// Connect to the server
let connection =  ls.createConnection(ls.ProposedFeatures.all);

// Creates the document manager
let documents: ls.TextDocuments = new ls.TextDocuments();


let hasConfigurationCapability: boolean = false;
let hasWorkspaceFolderCapability: boolean = false;
let hasDiagnosticRelatedInformationCapability:boolean = false;

let rootPath:string;



connection.onInitialize((params: InitializeParams)=>{
    rootPath = params.rootPath;
    let capabilities = params.capabilities;
    // Checks if the client supports the workspace/configuration request
    hasConfigurationCapability = !!(capabilities.workspace && !!capabilities.workspace.configuration);
    hasWorkspaceFolderCapability = !!(capabilities.workspace && !!capabilities.workspace.workspaceFolders);
    hasDiagnosticRelatedInformationCapability = !!(capabilities.textDocument && capabilities.textDocument.publishDiagnostics && capabilities.textDocument.publishDiagnostics.relatedInformation);
    

    return {
        capabilities: {
            openClose: true,
            textDocumentSync: documents.syncKind,
            // Tell client what services is provided
            completionProvider: {
                resolveProvider: true
            },
            hoverProvider:true,
            definitionProvider:true
        }
    };
});

connection.onInitialized(()=> {
    if (hasConfigurationCapability){
        // Register for all changes
        connection.client.register(
            DidChangeConfigurationNotification.type,
            undefined
        );
        
    }
    if (hasWorkspaceFolderCapability){
        connection.workspace.onDidChangeWorkspaceFolders(event => {
            connection.console.log("Workspace folder change event recieved");
        });
    }
});

// Example settings for the server
interface ExampleSettings{
    maxNumberOfProblems: number;
}
// Define default settings
const defaultSettings: ExampleSettings = {maxNumberOfProblems: 1000};
let globalSettings: ExampleSettings = defaultSettings;

// Save the settings of all open documents
let documentSettings: Map<string, Thenable<ExampleSettings>>= new Map();

connection.onDidChangeConfiguration(change => {
    if (hasConfigurationCapability){
        // Reset settings for document when change in configuration occurs
        documentSettings.clear();
    } else{
        globalSettings = <ExampleSettings>(
            (change.settings.languageserver || defaultSettings)
        );
    }
    // Validate all open documents
    documents.all().forEach(validateTextDocument);
});

function getDocumentSettings(resource: string): Thenable<ExampleSettings> {
    if (!hasConfigurationCapability){
        return Promise.resolve(globalSettings);
    }
    let result = documentSettings.get(resource);
    if (!result) {
        result = connection.workspace.getConfiguration({
            scopeUri: resource,
            section: "languageServer"
        });
        documentSettings.set(resource,result);
    }
    return result;
}

// Only keep settings for open documents
documents.onDidClose(e => {
    documentSettings.delete(e.document.uri);
});


// A change in the content of a document has occurred. This is allso called
// when the documents is first opened
documents.onDidChangeContent(change => {
    validateTextDocument(change.document);
});

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
    // Wait for the settings for the document
    let settings = await getDocumentSettings(textDocument.uri);
    // Look for all caps words
    let text = textDocument.getText();


    let pattern = /([a-zA-Z]+:{1})+[a-zA-Z]*/g;
    let m: RegExpExecArray | null;

    let lines = text.split("\n");
    let rootUri:string = Uri.file(rootPath).toString();



    let problems = 0;
    let diagnostics: Diagnostic[] = [];

    while((m = pattern.exec(text)) && settings.maxNumberOfProblems > problems){
        let lineNumber:number = textDocument.positionAt(m.index).line;
        let relativeUri:string = lines[lineNumber].slice(textDocument.positionAt(m.index).character, textDocument.positionAt(m.index+m[0].length).character);
        let properUri = relativeUri.replace(/:/g,"/");
        let validUri:string = rootUri+"/"+properUri+".json"; 
    
        if (!existsSync(Uri.parse(validUri).fsPath)){
            problems++;
            let diagnostic: Diagnostic = {
                severity: DiagnosticSeverity.Warning,
                range:{
                    start: textDocument.positionAt(m.index),
                    end: textDocument.positionAt(m.index+m[0].length)
                },
                message: `${m[0]} is not a valid path.`,
                source: "ex"
            };
            if (hasDiagnosticRelatedInformationCapability){
                diagnostic.relatedInformation = [
                    {
                        location: {
                            uri: textDocument.uri,
                            range: Object.assign({}, diagnostic.range)
                        },
                        message: "This reference cannot be found"
                    }
                ];
            }
            diagnostics.push(diagnostic);
        } 
    } 
    // Send the array of dianostics to vs code
    connection.sendDiagnostics({uri: textDocument.uri, diagnostics});
}


connection.onDidChangeWatchedFiles(change => {
    connection.console.log("We recieved an file change event");
});

// Handler for completion items
connection.onCompletion(
    (textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
        return [
            {
                label: 'Dog',
				kind: CompletionItemKind.Text,
				data: 1
			},
			{
				label: 'Cat',
				kind: CompletionItemKind.Text,
				data: 2
			}    
        ];
    }
);


// Resolver add additional information on the item from the completion list
connection.onCompletionResolve((
    item: CompletionItem): CompletionItem => {
        if (item.data = 1){
            (item.detail= "Dogs are happy"),
            (item.documentation="Pet one to see yourself");
        }else if(item.data === 2){
            (item.detail= "Cats are angry"),
            (item.documentation="Don't go too close");
        }
        return item;
    }
);

// Handler for hover
connection.onHover(({ textDocument, position }): ls.Hover => { 
    let uri = textDocument.uri;
    
    let path:string = Uri.parse(uri).fsPath;
    return{
    
        contents: position.character.toString()
    };
});

connection.onDefinition((textDocumentPositionParams: TextDocumentPositionParams):ls.Definition  => {
    if(textDocumentPositionParams.position.character<=1){
        return null;
    }

    let rootUri:string = Uri.file(rootPath).toString();
    let text:string =documents.get(textDocumentPositionParams.textDocument.uri).getText();


    let lines = text.split("\n");
    let lineNumber:number = textDocumentPositionParams.position.line;
    let startCharNumber:number = textDocumentPositionParams.position.character;
    let endCharNumber:number = textDocumentPositionParams.position.character;
    while (lines[lineNumber][startCharNumber]!=="\"" && startCharNumber > 1){
        startCharNumber--;
    }
    while (lines[lineNumber][endCharNumber]!=="\"" && endCharNumber < 100){
        endCharNumber++;
    }

    let start = Position.create(lineNumber, startCharNumber+1);
    let end = Position.create(lineNumber, endCharNumber);
    let range = Range.create(start,end);


    let relativeUri = lines[lineNumber].slice(range.start.character,range.end.character);

    let properUri = relativeUri.replace(/:/g,"/");
    let finalUri:string = rootUri+"/"+properUri+".json"; 

    if (!existsSync(Uri.parse(finalUri).fsPath)){
        return null;
    }
    return Location.create(finalUri,range);
});


// Logging open,close and change of documents
/*
connection.onDidOpenTextDocument((params)=>{
    docText = params.textDocument.text;
    console.log("OPENED "+params.textDocument.text)
    connection.console.log(`${params.textDocument.uri} opened`);
});

connection.onDidChangeTextDocument((params) => {
	connection.console.log(`${params.textDocument.uri} changed: ${JSON.stringify(params.contentChanges)}`);
});
connection.onDidCloseTextDocument((params) => {
	connection.console.log(`${params.textDocument.uri} closed.`);
});
*/



// Listen for open,close and change events for the doc manager
documents.listen(connection);


connection.listen();