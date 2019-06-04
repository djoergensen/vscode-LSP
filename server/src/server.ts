import * as ls from "vscode-languageserver";
import Uri from 'vscode-uri';
import { TextDocument, InitializeParams, DidChangeConfigurationNotification, Diagnostic, DiagnosticSeverity,
    TextDocumentPositionParams, CompletionItem, CompletionItemKind, Position, Location, Range, Hover} from "vscode-languageserver";
import { existsSync} from "fs";
import * as path from "path";
import {buildApplicationSource, loadSchema} from "./build";
const chalk = require("chalk");
const log = require('fancy-log');
const Ajv = require('Ajv');
import {buildApplicationSourcePostitions} from "./positions";


// Connect to the server
let connection =  ls.createConnection(ls.ProposedFeatures.all);

// Creates the document manager
let documents: ls.TextDocuments = new ls.TextDocuments();


let hasConfigurationCapability: boolean = false;
let hasWorkspaceFolderCapability: boolean = false;
let hasDiagnosticRelatedInformationCapability:boolean = false;


connection.onInitialize((params: InitializeParams)=>{
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

documents.onDidSave(doc => {
    validateTextDocument(doc.document);
});

documents.onDidOpen(doc =>{
    validateTextDocument(doc.document);
});

// A change in the content of a document has occurred. This is allso called
// when the documents is first opened
/*documents.onDidChangeContent(change => {
    validateTextDocument(change.document);
});
*/
function findTarget(dataPath, application, params){
    for (var key in params){
        if (key.includes("missingProperty")){
            return null;
        }
    }

    let fileList = dataPath.split(/[ \s.\'\[\]]+/);
    fileList.pop();
    fileList.shift();

    let target = application;
    for (let i = 0; i<fileList.length-1;i++){
        target = target[fileList[i]];
    }
    return target;
}

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
    //let settings = await getDocumentSettings(textDocument.uri);
    let docDir = path.dirname(path.normalize(Uri.parse(textDocument.uri).fsPath));

    if(!existsSync(docDir)){
        return null;
    }
    let application = buildApplicationSource(docDir)[0];
    let position_app = buildApplicationSourcePostitions(docDir);
    let diagnostics: Diagnostic[] = [];
    log("POS")
    //log(position_app.shell.menu.group)
    const ajv = new Ajv({allErrors: true, verbose: true, errorDataPath: "property"});
    const validator = ajv.compile(loadSchema(docDir));
    const validation = validator(application);
    if (validation === true) {
        log(chalk.green('Application conforms to the schema'));
        connection.sendDiagnostics({uri:textDocument.uri, diagnostics});
    } else {
        log(`There were ${chalk.red('errors')} validating the application against the schema:`);
        // pretty printing the error object
        for (const err of validator.errors) {
            log(chalk.red(`- ${err.dataPath || '.'} ${err.message}`));

            let target = findTarget(err.dataPath, position_app, err.params);
            if (!target){continue;}
            let file = target.dir;
            if (file && documents.get(Uri.file(file).toString()).uri === textDocument.uri){

                let doc = documents.get(Uri.file(file).toString());
                
                let diagnostic: Diagnostic = {
                    severity: DiagnosticSeverity.Warning,
                    range:{
                        start: doc.positionAt(target.pos),
                        end: doc.positionAt(target.posEnd)
                    },
                    message: `- ${err.dataPath || '.'} ${err.message}`,
                    source: "vscode-lsp"
                };
                if (hasDiagnosticRelatedInformationCapability){
                    diagnostic.relatedInformation = [
                        {
                            location: {
                                uri: doc.uri,
                                range: Object.assign({}, diagnostic.range)
                            },
                            message: err.params.toString()
                        }
                    ];
                }
                diagnostics.push(diagnostic);
            }
                
        }
        connection.sendDiagnostics({uri:textDocument.uri, diagnostics});
    }
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
connection.onHover(({ textDocument, position }): Hover => {
    let text:string =documents.get(textDocument.uri).getText();

    let lines = text.split("\n");
    let lineNumber:number = position.line;
    let startCharNumber:number = position.character;
    let endCharNumber:number = position.character;
    while (lines[lineNumber][startCharNumber]!=="\"" && startCharNumber > 1){
        startCharNumber--;
    }
    while (lines[lineNumber][endCharNumber]!=="\"" && endCharNumber < 180){
        endCharNumber++;
    }

    let start = Position.create(lineNumber, startCharNumber+1);
    let end = Position.create(lineNumber, endCharNumber);
    let range = Range.create(start,end);

    let docUri = textDocument.uri;

    let len = docUri.length;
    let fileLetters = 0;
    while(docUri[len-fileLetters]!=="/"){
        fileLetters++;
    }
    let folderUri = docUri.slice(0,-fileLetters);

    let relativeUri = lines[lineNumber].slice(range.start.character,range.end.character);
    let properUri = relativeUri.replace(/:/g,"/");
    let destinationUri:string = folderUri+"/"+properUri+".json"; 

    let normalPath = path.normalize(Uri.parse(destinationUri).fsPath);

    if (!existsSync(normalPath)){
        return null;
    }
    return {contents: "Ctrl + click to follow path"};
});

// Handler for definition request
connection.onDefinition((textDocumentPositionParams: TextDocumentPositionParams):ls.Definition  => {
    if(textDocumentPositionParams.position.character<=1){
        return null;
    }
    let text:string =documents.get(textDocumentPositionParams.textDocument.uri).getText();


    let lines = text.split("\n");
    let lineNumber:number = textDocumentPositionParams.position.line;
    let startCharNumber:number = textDocumentPositionParams.position.character;
    let endCharNumber:number = textDocumentPositionParams.position.character;
    while (lines[lineNumber][startCharNumber]!=="\"" && startCharNumber > 1){
        startCharNumber--;
    }
    while (lines[lineNumber][endCharNumber]!=="\"" && endCharNumber < 180){
        endCharNumber++;
    }

    let start = Position.create(lineNumber, startCharNumber+1);
    let end = Position.create(lineNumber, endCharNumber);
    let range = Range.create(start,end);

    let docUri = textDocumentPositionParams.textDocument.uri;

    let len = docUri.length;
    let fileLetters = 0;
    while(docUri[len-fileLetters]!=="/"){
        fileLetters++;
    }

    let folderUri = docUri.slice(0,-fileLetters);
    let fileUri = lines[lineNumber].slice(range.start.character,range.end.character);
    let properUri =fileUri.replace(/:/g,"/");
    let destinationUri:string = folderUri+"/"+properUri+".json"; 

    let normalPath = path.normalize(Uri.parse(destinationUri).fsPath);
    if (!existsSync(Uri.parse(normalPath).fsPath)){
        return null;
    }
    return Location.create(destinationUri,range);
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