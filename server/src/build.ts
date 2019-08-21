const chalk = require("chalk");
const log = require('fancy-log');
const fs = require('fs');
import {join, dirname, normalize, basename} from "path";
const jsonlint = require('jsonlint').parser;
import * as _ from 'lodash';

function getFiles(dir:string, fileList:string[], fileName:string){
  fileList = fileList || [];
  var files = fs.readdirSync(dir);
  for(var i in files){
      if (!files.hasOwnProperty(i)) {continue;}
      var name = dir+'/'+files[i];
      if (fs.statSync(name).isDirectory()){
          getFiles(name, fileList, fileName);
      } else {
          if(name.includes(fileName)){
            let norm_name = normalize(name);
            fileList.push(norm_name);
          }
      }
  }
  return fileList;
}
export function is_dir(path) {
  try {
      var stat = fs.lstatSync(path);
      return stat.isDirectory();
  } catch (e) {
      // lstatSync throws an error if path doesn't exist
      return false;
  }
}

function getSchema(dir:string){
  while(basename(dir)!=="iAccess"){
    if (fs.existsSync(dir+"\\schema.json")){
      let schemaArray = getFiles(dir,[], "schema.json");
      let len = schemaArray.length;
      if(len<1){
        log('No schemas found in workspace');
      }  else if(len>1){
        log('More than 1 schema found in workspace');
      }
      return schemaArray[0];
    }
    dir=dirname(dir);
    
  }

  dir = join(dir, "tools", "core", "dist", "dev", "web");
  let schemaArray = getFiles(dir,[], "schema.json");
  let len = schemaArray.length;
  if(len<1){
    log('No schemas found in workspace');
  }  else if(len>1){
    log('More than 1 schema found in workspace');
  }
  return schemaArray[0];
}

function getApplication(dir:string){
  while(basename(dir).length!==2 && basename(dir)!=="testFixture" && dir!=="c:\\"){
    dir=dirname(dir);
  }
  if (dir==="c:\\"){
    return null;
  }
  let applicationArray = getFiles(dir,[], "application.json");
  let len = applicationArray.length;
  if(len<1){
    log('No applications found in workspace');
  }  else if(len>1){
    log('More than 1 application found in workspace');
  }
  return applicationArray[0];
}




export function buildApplicationSource(dirPath: string) {
    const applicationJsonPath = getApplication(dirPath);
    const application = doLoadApplication(applicationJsonPath);
    //validate(application)
    return application;
}
  
function doLoadApplication(applicationJsonPath: string): any /* IApplicationConfiguration */ {
    const application = resolveJsonRefs(applicationJsonPath, true);
    application['terms'] = {};
    log(`Loaded application from ${chalk.green(applicationJsonPath)}`);
    return application;
}

/**
 * Loads a file with the given filename and resolves all JSON references recursively.
 * @param filename a JSON file
 * @param stripLocalizationMarkers True if all Localization markers ('T$') should be removed.
 */
function resolveJsonRefs(filename: string, stripLocalizationMarkers: boolean): any {
  try {
    const content = JSON.parse(fs.readFileSync(filename));
    return processNode(dirname(filename), content, stripLocalizationMarkers);
  } catch (e) {
    if (e instanceof SyntaxError) {
      reportSyntaxError(filename, e);
    } else {
      log(`Caught an error in ${filename}: ` + e);
    }
  }
}

function processNode(directory: string, node: any, stripLocalizationMarkers: boolean): any {
  if (_.isArray(node)) {
    return processArray(directory, node, stripLocalizationMarkers);
  } else if (_.isObject(node)) {
    return processObject(directory, node, stripLocalizationMarkers);
  }
  return node;
}

function processObject(directory: string, node: any, stripLocalizationMarkers: boolean): any {
  if (_.has(node, '$ref')) {
    return processReference(directory, node, stripLocalizationMarkers);
  } else {
    const object: any = {};
    _.forEach(node, function(value: any, key: any) {
      // handle localizable properties
      if (stripLocalizationMarkers && _.isString(key)) {
        key = key.replace(/t\$|T\$/g, '');
      }
      object[key] = processNode(directory, value, stripLocalizationMarkers);
    });

    return object;
  }
}

function processReference(directory: string, node: any, stripLocalizationMarkers: boolean): any {
  const value = <string>_.get(node, '$ref');
  const parts = _.split(value, ':');
  const referredPath = join(directory, ..._.initial(parts), _.last(parts) + '.json');
  return resolveJsonRefs(referredPath, stripLocalizationMarkers);
}

function processArray(directory: string, node: any, stripLocalizationMarkers: boolean): any {
  const arrayNode: any = [];
  _.forEach(node, function(child: any) {
    arrayNode.push(processNode(directory, child, stripLocalizationMarkers));
  });
  return arrayNode;
}

function reportSyntaxError(filename: string, e: SyntaxError) {
  try {
    log("PARSING");
    jsonlint.parse(fs.readFileSync(filename, 'utf8'));
  } catch (e) {
    log(chalk.white.bgRed.bold('--------------------------------------------'));
    log(chalk.white.bgRed.bold(`Syntax Error in ${filename}`));
    log(chalk.white.bgRed.bold(e));
    log(chalk.white.bgRed.bold('--------------------------------------------'));
  }
}

export function showProps(obj) {
  var result = [];
  for (var i in obj) {
    // obj.hasOwnProperty() is used to filter out properties from the object's prototype chain
    if (obj.hasOwnProperty(i)) {
      result.push(i);
      result.push(obj[i]);
    }
  }
  return result;
}

/**
 * Loads and parses the generated schema.
 * @returns {object} the schema
 */
export function loadSchema(path:string): any {
  let schemaPath = getSchema(path);
  const schemaFileHandle = fs.readFileSync(schemaPath, 'utf-8');
  const schema = JSON.parse(schemaFileHandle);
  log(`Loaded schema from ${chalk.green(schemaPath)}`);
  return schema;
}
