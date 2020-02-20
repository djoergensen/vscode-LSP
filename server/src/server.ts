
import { TextDocument, TextDocuments, InitializeParams, DidChangeConfigurationNotification, Diagnostic, DiagnosticSeverity,
    TextDocumentPositionParams, Position, Location, Range, Hover, createConnection,ProposedFeatures, Definition} from "vscode-languageserver";
import {URI} from 'vscode-uri';
import {existsSync} from "fs";
import {normalize, dirname} from "path";
import {buildApplicationSource, loadSchema, hasSchema} from "./build";
import {buildApplicationSourcePostitions} from "./positions";
import log = require('fancy-log');
import Ajv = require('Ajv');
import {performance} from 'perf_hooks';


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
//When a doc is saved perform validation
documents.onDidSave(doc => {
    validateTextDocument(doc.document);
});
//When a new doc is opened, perfrom validation
documents.onDidOpen(doc =>{
    validateTextDocument(doc.document);
});

//Finds the correct uri in the annotated application 
function findTarget(dataPath, application){
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

//Check if the path exists. If not create a diagnostic
function checkPath(pattern, textDocument, diagnostics){
    let text = textDocument.getText();
    let lines = text.split("\n");
    let m: RegExpExecArray | null;

    while(m = pattern.exec(text)){
        let lineNumber:number = textDocument.positionAt(m.index).line;
        let line:string = lines[lineNumber];

        let len = textDocument.uri.length;
        let fileLetters = 0;
        while(textDocument.uri[len-fileLetters]!=="/"){
            fileLetters++;
        }
        let folderUri = textDocument.uri.slice(0,-fileLetters);
        let relativeUri:string = line.slice(textDocument.positionAt(m.index).character, textDocument.positionAt(m.index+m[0].length).character);
        let properUri = relativeUri.replace(/:/g,"/");
        let destinationUri:string = folderUri+"/"+properUri+".json"; 
        
        let normalPath = normalize(URI.parse(destinationUri).fsPath);
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
                            range: diagnostic.range
                        },
                        message: "This reference cannot be found"
                    }
                ];
            }
            diagnostics.push(diagnostic);
        }
    }
}

//Performs the validation on documents by checking for correct path, and validation
// against the schema with AJV.
function validateTextDocument(textDocument: TextDocument) {
    let docDir = dirname(normalize(URI.parse(textDocument.uri).fsPath));
    if(!existsSync(docDir)){
        return null;
    }

    let diagnostics: Diagnostic[] = [];

    let pattern = /(?!r)(?!e)(?!f)(_?[a-zA-Z0-9]+:?)+[a-zA-Z0-9]*(_?[a-zA-Z0-9])*/g;
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
        log('Application conforms to the schema');
        connection.sendDiagnostics({uri:textDocument.uri, diagnostics});
    } else {
        log(`There were ${'errors'} validating the application against the schema:`);
        for (const err of validator.errors) {
            log(`- ${err.dataPath || '.'} ${err.message}`);            

            let target = findTarget(err.dataPath, position_app);
            if (!target){continue;}

            let path = target.dir;
            let docUri = URI.file(path).toString();
            let diagnostic: Diagnostic = {
                severity: DiagnosticSeverity.Warning,
                range:{
                    start: Position.create(target.line, target.column),
                    end: Position.create(target.lineEnd, target.columnEnd)
                },
                message: `- ${err.dataPath || '.'} ${err.message}`,
                source: "vscode-lsp"
            };
            if (hasDiagnosticRelatedInformationCapability){
                let errorMessage:string = JSON.stringify(err.params);
                diagnostic.relatedInformation = [
                    {
                        location: {
                            uri: docUri,
                            range: diagnostic.range
                        },
                        message: errorMessage
                    }
                ];
            }   
            diagnostics.push(diagnostic);            
        }
        sendDiagnostics(diagnostics);
    }
}

//Send diagnostics only to the docs from the annotated application
function sendDiagnostics(diagnostics:Diagnostic[]){
    if (diagnostics.length == 0){
        clearDiagnostics();
        return null;
    }
    clearDiagnostics();
    diagnostics.sort(compare);
    let startUri = diagnostics[0].relatedInformation[0].location.uri;
    let tempDiagnostics: Diagnostic[] = [];
    diagnostics.forEach(dia => {
        if (dia.relatedInformation[0].location.uri === startUri){
            tempDiagnostics.push(dia);
        } else{
            connection.sendDiagnostics({uri:startUri, diagnostics:tempDiagnostics});
            startUri = dia.relatedInformation[0].location.uri;
            tempDiagnostics = [];
            tempDiagnostics.push(dia);
        }
    }); 
    connection.sendDiagnostics({uri:startUri, diagnostics:tempDiagnostics});
}

//Clear diagnostics for all docs
function clearDiagnostics(){
    let dia: Diagnostic[] = [];

    documents.all().forEach(doc => {
        connection.sendDiagnostics({uri:doc.uri, diagnostics: dia});
    });
}


//Sort errors by URI
function compare( a, b ) {
    if ( a.relatedInformation[0].location.uri < b.relatedInformation[0].location.uri ){
      return -1;
    }
    if ( a.relatedInformation[0].location.uri > b.relatedInformation[0].location.uri ){
      return 1;
    }
    return 0;
}


// Handler for hover
connection.onHover(({ textDocument, position }): Hover => {
    let text:string =documents.get(textDocument.uri).getText();

    let lines = text.split("\n");
    let lineNumber:number = position.line;
    if (!lines[lineNumber].includes("$ref")){
        return null;
    }
    
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

    let normalPath = normalize(URI.parse(destinationUri).fsPath);

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
    if (!lines[lineNumber].includes("$ref")){
        return null;
    }

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

    let normalPath = normalize(URI.parse(destinationUri).fsPath);
    if (!existsSync(URI.parse(normalPath).fsPath)){
        return null;
    }
    return Location.create(destinationUri,range);
});

// Listen for open,close and change events for the doc manager
documents.listen(connection);

connection.listen();