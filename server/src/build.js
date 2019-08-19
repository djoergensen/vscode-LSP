"use strict";
exports.__esModule = true;
var chalk = require("chalk");
var log = require('fancy-log');
var fs = require('fs');
var path_1 = require("path");
var jsonlint = require('jsonlint').parser;
var _ = require("lodash");
function getFiles(dir, fileList, fileName) {
    fileList = fileList || [];
    var files = fs.readdirSync(dir);
    for (var i in files) {
        if (!files.hasOwnProperty(i)) {
            continue;
        }
        var name = dir + '/' + files[i];
        if (fs.statSync(name).isDirectory()) {
            getFiles(name, fileList, fileName);
        }
        else {
            if (name.includes(fileName)) {
                var norm_name = path_1.normalize(name);
                fileList.push(norm_name);
            }
        }
    }
    return fileList;
}
function is_dir(path) {
    try {
        var stat = fs.lstatSync(path);
        return stat.isDirectory();
    }
    catch (e) {
        // lstatSync throws an error if path doesn't exist
        return false;
    }
}
exports.is_dir = is_dir;
function getSchema(dir) {
    while (path_1.basename(dir) !== "iAccess") {
        if (fs.existsSync(dir + "\\schema.json")) {
            var schemaArray_1 = getFiles(dir, [], "schema.json");
            var len_1 = schemaArray_1.length;
            if (len_1 < 1) {
                log('No schemas found in workspace');
            }
            else if (len_1 > 1) {
                log('More than 1 schema found in workspace');
            }
            return schemaArray_1[0];
        }
        dir = path_1.dirname(dir);
    }
    dir = path_1.join(dir, "tools", "core", "dist", "dev", "web");
    var schemaArray = getFiles(dir, [], "schema.json");
    var len = schemaArray.length;
    if (len < 1) {
        log('No schemas found in workspace');
    }
    else if (len > 1) {
        log('More than 1 schema found in workspace');
    }
    return schemaArray[0];
}
function getApplication(dir) {
    while (path_1.basename(dir).length !== 2 && path_1.basename(dir) !== "testFixture") {
        dir = path_1.dirname(dir);
    }
    var applicationArray = getFiles(dir, [], "application.json");
    var len = applicationArray.length;
    if (len < 1) {
        log('No applications found in workspace');
    }
    else if (len > 1) {
        log('More than 1 application found in workspace');
    }
    return [applicationArray[0], dir];
}
function buildApplicationSource(dirPath) {
    var applicationJsonPath = getApplication(dirPath)[0];
    var topPath = getApplication(dirPath)[1];
    var application = doLoadApplication(applicationJsonPath);
    //validate(application)
    return [application, topPath];
}
exports.buildApplicationSource = buildApplicationSource;
function doLoadApplication(applicationJsonPath) {
    var application = resolveJsonRefs(applicationJsonPath, true);
    application['terms'] = {};
    log("Loaded application from " + chalk.green(applicationJsonPath));
    return application;
}
/**
 * Loads a file with the given filename and resolves all JSON references recursively.
 * @param filename a JSON file
 * @param stripLocalizationMarkers True if all Localization markers ('T$') should be removed.
 */
function resolveJsonRefs(filename, stripLocalizationMarkers) {
    try {
        var content = JSON.parse(fs.readFileSync(filename));
        return processNode(path_1.dirname(filename), content, stripLocalizationMarkers);
    }
    catch (e) {
        if (e instanceof SyntaxError) {
            reportSyntaxError(filename, e);
        }
        else {
            log("Caught an error in " + filename + ": " + e);
        }
    }
}
function processNode(directory, node, stripLocalizationMarkers) {
    if (_.isArray(node)) {
        return processArray(directory, node, stripLocalizationMarkers);
    }
    else if (_.isObject(node)) {
        return processObject(directory, node, stripLocalizationMarkers);
    }
    return node;
}
function processObject(directory, node, stripLocalizationMarkers) {
    if (_.has(node, '$ref')) {
        return processReference(directory, node, stripLocalizationMarkers);
    }
    else {
        var object_1 = {};
        _.forEach(node, function (value, key) {
            // handle localizable properties
            if (stripLocalizationMarkers && _.isString(key)) {
                key = key.replace(/t\$|T\$/g, '');
            }
            object_1[key] = processNode(directory, value, stripLocalizationMarkers);
        });
        return object_1;
    }
}
function processReference(directory, node, stripLocalizationMarkers) {
    var value = _.get(node, '$ref');
    var parts = _.split(value, ':');
    var referredPath = path_1.join.apply(void 0, [directory].concat(_.initial(parts), [_.last(parts) + '.json']));
    return resolveJsonRefs(referredPath, stripLocalizationMarkers);
}
function processArray(directory, node, stripLocalizationMarkers) {
    var arrayNode = [];
    _.forEach(node, function (child) {
        arrayNode.push(processNode(directory, child, stripLocalizationMarkers));
    });
    return arrayNode;
}
function reportSyntaxError(filename, e) {
    try {
        log("PARSING");
        jsonlint.parse(fs.readFileSync(filename, 'utf8'));
    }
    catch (e) {
        log(chalk.white.bgRed.bold('--------------------------------------------'));
        log(chalk.white.bgRed.bold("Syntax Error in " + filename));
        log(chalk.white.bgRed.bold(e));
        log(chalk.white.bgRed.bold('--------------------------------------------'));
    }
}
function showProps(obj) {
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
exports.showProps = showProps;
/**
 * Loads and parses the generated schema.
 * @returns {object} the schema
 */
function loadSchema(path) {
    var schemaPath = getSchema(path);
    var schemaFileHandle = fs.readFileSync(schemaPath, 'utf-8');
    var schema = JSON.parse(schemaFileHandle);
    log("Loaded schema from " + chalk.green(schemaPath));
    return schema;
}
exports.loadSchema = loadSchema;
