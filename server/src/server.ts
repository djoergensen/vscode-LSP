
import { TextDocument, TextDocuments, InitializeParams, DidChangeConfigurationNotification, Diagnostic, DiagnosticSeverity,
    TextDocumentPositionParams, CompletionItem, CompletionItemKind, Position, Location, Range, Hover, createConnection,
    ProposedFeatures, Definition} from "vscode-languageserver";
import Uri from 'vscode-uri';
import {existsSync} from "fs";
import {normalize, dirname} from "path";
import {buildApplicationSource, loadSchema, hasSchema} from "./build";
import {buildApplicationSourcePostitions} from "./positions";

const chalk = require("chalk");
const log = require('fancy-log');
const Ajv = require('Ajv');

// Connect to the server
let connection =  createConnection(ProposedFeatures.all);

// Creates the document manager
let documents: TextDocuments = new TextDocuments();

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
            // Tell client what services are provided
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
let documentSettings: Map<string, ExampleSettings>= new Map();

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

/*
documents.onDidChangeContent(change => {
    validateTextDocument(change.document);
});
*/
function findTarget(dataPath, application, params){
    for (var key in params){
        if (key.includes("missingProperty")){
            return null;
        }
    }
    let fileList = dataPath.split(/[.\'\[\]]+/);
    fileList.pop();
    fileList.shift();
    let target = application;
    for (let i = 0; i<fileList.length-1;i++){
        target = target[fileList[i]];
    }
    let meta = "meta"+fileList[fileList.length-1];
    target=target[meta];
    return target;
}

function checkPath(pattern, textDocument, diagnostics){
    let text = textDocument.getText();
    let lines = text.split("\n");
    let m: RegExpExecArray | null;

    while((m = pattern.exec(text))){
        let docUri = textDocument.uri;
        let lineNumber:number = textDocument.positionAt(m.index).line;
        let line:string = lines[lineNumber];

        let len = docUri.length;
        let fileLetters = 0;
        while(docUri[len-fileLetters]!=="/"){
            fileLetters++;
        }
        let folderUri = docUri.slice(0,-fileLetters);
        let relativeUri:string = line.slice(textDocument.positionAt(m.index).character, textDocument.positionAt(m.index+m[0].length).character);
        let properUri = relativeUri.replace(/:/g,"/");
        let destinationUri:string = folderUri+"/"+properUri+".json"; 
        
        let normalPath = normalize(Uri.parse(destinationUri).fsPath);
        if (!existsSync(normalPath) && line.includes("\"$ref\"") && !line.includes("#/")){
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
}


function validateTextDocument(textDocument: TextDocument) {
    let docDir = dirname(normalize(Uri.parse(textDocument.uri).fsPath));
    if(!existsSync(docDir)){
        return null;
    }

    let diagnostics: Diagnostic[] = [];

    let pattern = /(?!r)(?!e)(?!f)(_?[a-zA-Z]+:?)+[a-zA-Z]*(_?[a-zA-Z])*/g;
    checkPath(pattern,textDocument, diagnostics);

    if(!hasSchema(docDir)){
        connection.sendDiagnostics({uri:textDocument.uri, diagnostics});
        connection.sendNotification("custom/hasSchema", textDocument.uri);
        return null;
    }

    let application = buildApplicationSource(docDir);
    if (!application){
        return null;
    }
    let position_app = buildApplicationSourcePostitions(docDir);
    if (!position_app){
        return null;
    }

    const ajv = new Ajv({allErrors: true, verbose: true, errorDataPath: "property"});
    let schema = loadSchema(docDir);
    const validator = ajv.compile(schema);
    const validation = validator(application);
    if (validation === true) {
        log(chalk.green('Application conforms to the schema'));
        connection.sendDiagnostics({uri:textDocument.uri, diagnostics});
    } else {
        log(`There were ${chalk.red('errors')} validating the application against the schema:`);
        // pretty printing the error object
        for (const err of validator.errors) {
            log(chalk.red(`- ${err.dataPath || '.'} ${err.message}`));
            log(err.parentSchema);
            log(err.schemaPath);

            let target = findTarget(err.dataPath, position_app, err.params);
            if (!target){continue;}
            let path = target.dir;

            if (path && Uri.file(path).toString() === textDocument.uri){
                let doc = documents.get(Uri.file(path).toString());
        
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
                    let errorMessage:string = JSON.stringify(err.params);
                    diagnostic.relatedInformation = [
                        {
                            location: {
                                uri: doc.uri,
                                range: Object.assign({}, diagnostic.range)
                            },
                            message: errorMessage
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


function findReference(doc, schema){
    let fileList = doc.split("20")[1].slice(1,-5).split("/");
    let end = fileList[fileList.length-1].toLowerCase();
    let next = schema.properties[fileList[0].toLowerCase()];
    let pointer = JSON.stringify(next['$ref']).slice(0,-1);

    let target = findKeysFromDataPath(pointer, schema).properties;
    for (var key in target){
        if (key.toLocaleLowerCase() === end){
            let path = target[key]["$ref"];
            return path;
        }
    }
    return target;
}
function findKeysFromDataPath(dataPath, schema){
    let arr = dataPath.split("/");
    arr.shift();

    let target = schema;
    for (let i = 0; i<arr.length;i++){
        target = target[arr[i]];
    }
    return target;
}


// Handler for completion items
connection.onCompletion(
    (textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
        let docDir = dirname(normalize(Uri.parse(textDocumentPosition.textDocument.uri).fsPath));
        let schema = loadSchema(docDir);
        let doc = textDocumentPosition.textDocument.uri;
        let end = doc.split("20")[1].slice(1,-5).split("/");

        let lineNum = textDocumentPosition.position.line;
        let line = documents.get(textDocumentPosition.textDocument.uri).getText(Range.create(Position.create(lineNum,0),Position.create(lineNum+1,0)));
        let colon = line.indexOf(":");
        if (textDocumentPosition.position.character >= colon){
            return [];
        }

        if (end.length === 1){
            let props = schema.properties;
            let compArr = [];
            for (var key in props){
                const snippetCompletion = CompletionItem.create("\""+key);
                snippetCompletion.kind = CompletionItemKind.Snippet;
                compArr.push(snippetCompletion);
            }
            return compArr;
        }
        let ref = findReference(doc,schema);
        while (typeof ref !== "object"){
            ref = findKeysFromDataPath(ref,schema).properties;
        }
        let compArr = [];
// tslint:disable-next-line: no-duplicate-variable
        for (var key in ref){
            const snippetCompletion = CompletionItem.create("\""+key);
            snippetCompletion.kind = CompletionItemKind.Snippet;
            compArr.push(snippetCompletion);
        }
        return compArr;
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

    let normalPath = normalize(Uri.parse(destinationUri).fsPath);

    if (!existsSync(normalPath)){
        return null;
    }
    return {contents: "Ctrl + click to follow path"};
});

// Handler for definition request
connection.onDefinition((textDocumentPositionParams: TextDocumentPositionParams):Definition  => {
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

    let normalPath = normalize(Uri.parse(destinationUri).fsPath);
    if (!existsSync(Uri.parse(normalPath).fsPath)){
        return null;
    }
    return Location.create(destinationUri,range);
});

// Listen for open,close and change events for the doc manager
documents.listen(connection);

connection.listen();