"use strict";
exports.__esModule = true;
var path = require("path");
var fs = require("fs");
var vscode_languageserver_1 = require("vscode-languageserver");
var build_1 = require("./build");
var pointer = require("json-pointer");
var Stack = /** @class */ (function () {
    function Stack() {
        this._store = [];
    }
    Stack.prototype.push = function (val) {
        this._store.push(val);
    };
    Stack.prototype.pop = function () {
        return this._store.pop();
    };
    Stack.prototype.get = function () {
        return this._store[this._store.length - 1];
    };
    return Stack;
}());
var Queue = /** @class */ (function () {
    function Queue() {
        this.oldestIndex = 1;
        this.newestIndex = 1;
        this.storage = {};
    }
    Queue.prototype.size = function () {
        return this.newestIndex - this.oldestIndex;
    };
    Queue.prototype.enqueue = function (data) {
        this.storage[this.newestIndex] = data;
        this.newestIndex++;
    };
    Queue.prototype.dequeue = function () {
        var oldestIndex = this.oldestIndex, newestIndex = this.newestIndex, deletedData;
        if (oldestIndex !== newestIndex) {
            deletedData = this.storage[oldestIndex];
            delete this.storage[oldestIndex];
            this.oldestIndex++;
            return deletedData;
        }
    };
    return Queue;
}());
var TNode = /** @class */ (function () {
    function TNode(data) {
        this.children = [];
        this.data = data;
        this.parent = null;
    }
    return TNode;
}());
var Tree = /** @class */ (function () {
    function Tree(data) {
        this.root = new TNode(data);
    }
    Tree.prototype.traverseDF = function (callback) {
        (function recurse(currentNode) {
            for (var i = 0, length = currentNode.children.length; i < length; i++) {
                recurse(currentNode.children[i]);
            }
            callback(currentNode);
        })(this.root);
    };
    Tree.prototype.traverseBF = function (callback) {
        var queue = new Queue();
        queue.enqueue(this.root);
        var currentTree = queue.dequeue();
        while (currentTree) {
            for (var i = 0, length = currentTree.children.length; i < length; i++) {
                queue.enqueue(currentTree.children[i]);
            }
            callback(currentTree);
            currentTree = queue.dequeue();
        }
    };
    Tree.prototype.contains = function (callback, traversal) {
        traversal.call(this, callback);
    };
    Tree.prototype.add = function (data, toData, traversal) {
        var child = new TNode(data), parent = null, callback = function (Tnode) {
            if (Tnode.data === toData) {
                parent = Tnode;
            }
        };
        this.contains(callback, traversal);
        if (parent) {
            parent.children.push(child);
            child.parent = parent;
        }
        else {
            throw new Error('Cannot add Tnode to a non-existent parent. ');
        }
    };
    Tree.prototype.remove = function (data, fromData, traversal) {
        var parent = null, childToRemove = null, index;
        var callback = function (Tnode) {
            if (Tnode.data === fromData) {
                parent = Tnode;
            }
        };
        this.contains(callback, traversal);
        if (parent) {
            index = findIndex(parent.children, data);
            if (index === undefined) {
                throw new Error('TNode to remove does not exist.');
            }
            else {
                childToRemove = parent.children.splice(index, 1);
            }
        }
        else {
            throw new Error('Parent does not exist.');
        }
        return childToRemove;
    };
    return Tree;
}());
function findIndex(arr, data) {
    var index;
    for (var i = 0; i < arr.length; i++) {
        if (arr[i].data === data) {
            index = i;
        }
    }
    return index;
}
function walkApp(filePath, tree) {
    var content = fs.readFileSync(filePath, "utf8");
    var lines = content.split("\n");
    lines.forEach(function (element) {
        if (element.includes("$ref")) {
            var colon = element.indexOf(":");
            var ref = element.slice(colon + 2).replace(/\"|,/g, "");
            var parts = ref.replace("\r", "").split(":");
            var refPath_1 = path.dirname(filePath);
            parts.forEach(function (element) {
                refPath_1 = path.join(refPath_1, element);
            });
            refPath_1 = refPath_1 + ".json";
            tree.add(refPath_1, filePath, tree.traverseBF);
            walkApp(refPath_1, tree);
        }
    });
}
function findRefs(fPath) {
    var application = new Tree("C:\\MaconomySources\\iAccess\\Application\\20\\application.json");
    var refPath = [];
    walkApp("C:\\MaconomySources\\iAccess\\Application\\20\\application.json", application);
    application.traverseBF(function (node) {
        if (node.data === "C:\\MaconomySources\\iAccess\\Application\\20\\Workspace\\EmployeeSelfService\\AbsenceMgmt\\AbsenceMgmt_AbsenceRequests_Tab.json") {
            while (node) {
                refPath.push(node.data);
                node = node.parent;
            }
        }
    });
    return refPath;
}
function parseTree(fPath, file) {
    var tree = new Tree(path.basename(fPath));
    var lines = file.split('\n');
    var stack = new Stack;
    stack.push(tree.root.data);
    var popped;
    for (var i = 1; i < lines.length; i++) {
        var lineNum = i + 1;
        if (lines[i].length <= 0) {
            continue;
        }
        var prevkey = lines[i - 1].trim().replace(/\"/g, "").split(":")[0];
        var key = lines[i].trim().replace(/\"/g, "").split(":")[0];
        if (lines[i].includes("{") && (lines[i].includes("}"))) {
            tree.add(key + ":" + lineNum, stack.get(), tree.traverseBF);
        }
        else if (lines[i].includes("{") && lines[i].trim().length > 1) {
            tree.add(key + ":" + lineNum, stack.get(), tree.traverseBF);
            stack.push(key + ":" + lineNum);
        }
        else if (lines[i].includes("{")) {
            if (prevkey === "},") {
                prevkey = popped;
                stack.push(prevkey);
            }
            else {
                stack.push(prevkey + ":" + i);
            }
        }
        else if (lines[i].includes("}") && lines[i].trim().length > 2) {
            tree.add(key + ":" + lineNum, stack.get(), tree.traverseBF);
            popped = stack.pop();
        }
        else if (lines[i].includes("}")) {
            popped = stack.pop();
        }
        else if (lines[i].includes("]") && lines[i].trim().length <= 2) {
            continue;
        }
        else {
            tree.add(key + ":" + lineNum, stack.get(), tree.traverseBF);
        }
    }
    return tree;
}
function findKeyesFromNum(fPath, line) {
    var file = fs.readFileSync(fPath, "utf8");
    var tree = parseTree(fPath, file);
    var end = line.toString().length + 1;
    var keys = [];
    while (keys.length === 0) {
        tree.traverseBF(function (node) {
            var temp = node.data;
            if (temp.slice(-end) === ":" + line) {
                while (node) {
                    keys.push(node.data);
                    node = node.parent;
                }
            }
        });
        line -= 1;
    }
    return keys;
}
function findKeyesFromString(fPath, key) {
    var file = fs.readFileSync(fPath, "utf8");
    var tree = parseTree(fPath, file);
    var end = key.length;
    var keys = [];
    tree.traverseBF(function (node) {
        var temp = node.data;
        if (temp.slice(0, end) === key) {
            while (node) {
                keys.push(node.data);
                node = node.parent;
            }
        }
    });
    return keys;
}
function findRefInFile(fPath, ref) {
    var file = fs.readFileSync(fPath, "utf8");
    var lines = file.split("\n");
    var lineNum = 0;
    for (lineNum; lineNum < lines.length; lineNum++) {
        if (lines[lineNum].includes(ref)) {
            break;
        }
        lineNum += 1;
    }
    var keys = findKeyesFromNum(fPath, lineNum + 1);
    return keys;
}
function getObjPath(fPath, pos) {
    var refs = findRefs(fPath);
    console.log(refs);
    var keys = findKeyesFromNum(refs[0], pos.line);
    keys.reverse();
    keys.shift();
    console.log(keys);
    var ref = path.basename(fPath, '.json');
    var s = findRefInFile(refs[1], ref);
    s.reverse();
    s.pop();
    console.log(s);
    keys.shift();
}
exports.getObjPath = getObjPath;
var tree = new Tree("schema.json");
var schema = build_1.loadSchema("C:\\MaconomySources\\iAccess\\Application\\20\\Workspace\\EmployeeSelfService\\AbsenceMgmt\\AbsenceMgmt_AbsenceRequests_Tab.json");
var pos = vscode_languageserver_1.Position.create(6, 15);
getObjPath("C:\\MaconomySources\\iAccess\\Application\\20\\Workspace\\EmployeeSelfService\\AbsenceMgmt\\AbsenceMgmt_AbsenceRequests_Tab.json", pos);
//let test  = parseSchema(schema, tree, "schema.json", schema);
console.log(pointer.get(schema, "/definitions/ITab/properties/rows"));
