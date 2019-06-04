const chalk = require("chalk");
const log = require('fancy-log');
const fs = require('fs');
import {join, dirname, normalize, basename} from "path";
const jsonlint = require('jsonlint').parser;
import * as _ from 'lodash';
import {positionParse} from "./parser";




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
  while(basename(dir).length!==2){
    dir=dirname(dir);
  }
  let applicationArray = getFiles(dir,[], "application.json");
  let len = applicationArray.length;
  if(len<1){
    log('No applications found in workspace');
  }  else if(len>1){
    log('More than 1 application found in workspace');
  }
  return [applicationArray[0], dir];
}



export function buildApplicationSourcePostitions(dirPath: string) {
  const applicationJsonPath = getApplication(dirPath)[0];
  const topPath = getApplication(dirPath)[1];
  const application = doLoadApplication(applicationJsonPath);
  //validate(application)
  return application;
}
  
function doLoadApplication(applicationJsonPath: string): any /* IApplicationConfiguration */ {
  const application = resolveJsonRefs(applicationJsonPath, true);
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
    const content = positionParse(fs.readFileSync(filename,"utf8"));
    return processNode(dirname(filename), content, stripLocalizationMarkers, filename);
  } catch (e) {
    if (e instanceof SyntaxError) {
      reportSyntaxError(filename, e);
    } else {
      console.error(`Caught an error in ${filename}: ` + e);
    }
  }
}



function processNode(directory: string, node: any, stripLocalizationMarkers: boolean, fileName:string): any {
  if (_.isArray(node)) {
    return processArray(directory, node, stripLocalizationMarkers, fileName);
  } else if (_.isObject(node)) {
    return processObject(directory, node, stripLocalizationMarkers, fileName);
  }
  return node;
}

function processObject(directory: string, node: any, stripLocalizationMarkers: boolean, fileName): any {

  if (_.has(node, '$ref')) {
    return processReference(directory, node, stripLocalizationMarkers);
  } else {
    const object: any = {};
    _.forEach(node, function(value: any, key: any) {
      // handle localizable properties
      if (stripLocalizationMarkers && _.isString(key)) {
        key = key.replace(/t\$|T\$/g, '');
      }
      object[key] = processNode(directory, value, stripLocalizationMarkers, fileName);
      object["dir"] = fileName;
    });
    //log(object);
    return object;
  }
}

function processReference(directory: string, node: any, stripLocalizationMarkers: boolean): any {
  const value = <string>_.get(node, '$ref');
  const parts = _.split(value, ':');
  const referredPath = join(directory, ..._.initial(parts), _.last(parts) + '.json');
  return resolveJsonRefs(referredPath, stripLocalizationMarkers);
}

function processArray(directory: string, node: any, stripLocalizationMarkers: boolean, fileName): any {
  const arrayNode: any = [];
  _.forEach(node, function(child: any) {
    arrayNode.push(processNode(directory, child, stripLocalizationMarkers, fileName));
  });
  return arrayNode;
}

function reportSyntaxError(filename: string, e: SyntaxError) {
  try {
    jsonlint.parse(fs.readFileSync(filename, 'utf8'));
  } catch (e) {
    console.error(chalk.white.bgRed.bold('--------------------------------------------'));
    console.error(chalk.white.bgRed.bold(`Syntax Error in ${filename}`));
    console.error(chalk.white.bgRed.bold(e));
    console.error(chalk.white.bgRed.bold('--------------------------------------------'));
  }
}
