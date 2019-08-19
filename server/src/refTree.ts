import * as path from "path";
import * as fs from "fs";
import {Position} from "vscode-languageserver";
import {loadSchema} from "./build";
const pointer = require("json-pointer");


class Stack<T> {
	_store: T[] = [];
	push(val: T) {
	  this._store.push(val);
	}
	pop(): T | undefined {
	  return this._store.pop();
	}
	get(){
		return this._store[this._store.length-1];
	}
  }

class Queue {
    oldestIndex = 1;
    newestIndex = 1;
	storage = {};
	
	constructor(){}

	size() {
		return this.newestIndex - this.oldestIndex;
	}
	enqueue(data) {
		this.storage[this.newestIndex] = data;
		this.newestIndex++;
	}

	dequeue() {
		let oldestIndex = this.oldestIndex,
			newestIndex = this.newestIndex,
			deletedData;
	 
		if (oldestIndex !== newestIndex) {
			deletedData = this.storage[oldestIndex];
			delete this.storage[oldestIndex];
			this.oldestIndex++;
	 
			return deletedData;
		}
	}
}
 

class TNode {
    data:string;
    parent:TNode;
	children:TNode[] = [];
	
	constructor(data){
		this.data = data;
		this.parent = null;
	}
}
 
class Tree {
    root:TNode;
	
	constructor(data){
		this.root = new TNode(data);
	}


	traverseDF(callback) {
		(function recurse(currentNode) {
			for (var i = 0, length = currentNode.children.length; i < length; i++) {
				recurse(currentNode.children[i]);
			}	 
			callback(currentNode);
		})(this.root);
	}
 
	traverseBF(callback) {
		let queue = new Queue();
	
		queue.enqueue(this.root);
	
		let currentTree = queue.dequeue();

		while(currentTree){
			for (let i = 0, length = currentTree.children.length; i < length; i++) {
				queue.enqueue(currentTree.children[i]);
			}
			callback(currentTree);
			currentTree = queue.dequeue();
		}
	}
	contains(callback, traversal) {
		traversal.call(this, callback);
	}
 
	add(data, toData, traversal) {
		let child = new TNode(data),
			parent = null,
			callback = function(Tnode) {
				if (Tnode.data === toData) {
					parent = Tnode;
				}
			};
	
		this.contains(callback, traversal);
	
		if (parent) {
			parent.children.push(child);
			child.parent = parent;
		} else {
			throw new Error('Cannot add Tnode to a non-existent parent. ' );
		}
	}
 
	remove(data, fromData, traversal) {
		let parent = null,
			childToRemove = null,
			index;
	
		let callback = function(Tnode) {
			if (Tnode.data === fromData) {
				parent = Tnode;
			}
		};
		this.contains(callback, traversal);
	
		if (parent) {
			index = findIndex(parent.children, data);
	
			if (index === undefined) {
				throw new Error('TNode to remove does not exist.');
			} else {
				childToRemove = parent.children.splice(index, 1);
			}
		} else {
			throw new Error('Parent does not exist.');
		}
		return childToRemove;
	}
}
 
function findIndex(arr, data) {
    let index;
    for (let i = 0; i < arr.length; i++) {
        if (arr[i].data === data) {
            index = i;
        }
    }
    return index;
}


function walkApp(filePath, tree){
	let content = fs.readFileSync(filePath, "utf8");
	
	let lines = content.split("\n");
		lines.forEach(element => {
			if (element.includes("$ref")){
				let colon = element.indexOf(":");
				let ref = element.slice(colon+2).replace(/\"|,/g,"");
				let parts = ref.replace("\r","").split(":");

				let refPath = path.dirname(filePath);
				parts.forEach(element => {
					refPath = path.join(refPath, element);
				});
				refPath = refPath+".json";

				tree.add(refPath, filePath, tree.traverseBF);
				walkApp(refPath, tree);
			}
		});
}



function findRefs(fPath){
	let application = new Tree("C:\\MaconomySources\\iAccess\\Application\\20\\application.json");
	let refPath = [];
	walkApp("C:\\MaconomySources\\iAccess\\Application\\20\\application.json", application);
	application.traverseBF(function(node) {
		if (node.data === "C:\\MaconomySources\\iAccess\\Application\\20\\Workspace\\EmployeeSelfService\\AbsenceMgmt\\AbsenceMgmt_AbsenceRequests_Tab.json"){
			while (node){
				refPath.push(node.data);
				node = node.parent;
			}
		}
	});
	return refPath;
}


function parseTree(fPath, file){
	let tree = new Tree(path.basename(fPath));
	let lines = file.split('\n');
	let stack = new Stack;
	stack.push(tree.root.data);
	let popped;
	for (var i = 1; i<lines.length;i++)
	{
		let lineNum = i+1;
		if (lines[i].length<=0)
		{
			continue;
		}
		let prevkey = lines[i-1].trim().replace(/\"/g, "").split(":")[0];
		let key = lines[i].trim().replace(/\"/g, "").split(":")[0];

		if (lines[i].includes("{") && (lines[i].includes("}")))
		{
			tree.add(key+":"+lineNum, stack.get(), tree.traverseBF);

		}
		else if (lines[i].includes("{") && lines[i].trim().length>1)
		{
			tree.add(key+":"+lineNum, stack.get(), tree.traverseBF);
			stack.push(key+":"+lineNum);
		}
		else if (lines[i].includes("{"))
		{
			if (prevkey === "},")
			{
				prevkey = popped;
				stack.push(prevkey);
			} 
			else
			{
				stack.push(prevkey+":"+i);
			}
		}
		else if (lines[i].includes("}") && lines[i].trim().length>2)
		{
			tree.add(key+":"+lineNum, stack.get(), tree.traverseBF);
			popped = stack.pop();
		}
		else if (lines[i].includes("}"))
		{
			popped = stack.pop();
		}
		else if (lines[i].includes("]") && lines[i].trim().length <= 2)
		{
			continue;
		}
		else
		{
			tree.add(key+":"+lineNum, stack.get(), tree.traverseBF);
		}
	}
	return tree;
}

function findKeyesFromNum(fPath:string, line:number){
	let file = fs.readFileSync(fPath, "utf8");
	let tree = parseTree(fPath, file);
	let end = line.toString().length+1;
	let keys = [];
	while (keys.length === 0) {
		tree.traverseBF(function(node){
			let temp:string = node.data;
			if (temp.slice(-end)===":"+line){
				while(node){
					keys.push(node.data);
					node = node.parent;
				}
			}
		});
		line -= 1;
	}
	return keys;
}

function findKeyesFromString(fPath:string, key:string){
	let file = fs.readFileSync(fPath, "utf8");
	let tree = parseTree(fPath, file);

	let end = key.length;
	let keys = [];
	tree.traverseBF(function(node){
		let temp:string = node.data;
		if (temp.slice(0,end)===key){
			while(node){
				keys.push(node.data);
				node = node.parent;
			}
		}
	});
	return keys;
}

function findRefInFile(fPath:string, ref:string){
	let file = fs.readFileSync(fPath, "utf8");
	let lines = file.split("\n");
	let lineNum = 0;
	for (lineNum; lineNum<lines.length; lineNum++){
		if (lines[lineNum].includes(ref)){
			break;
		}
		lineNum += 1;
	}
	let keys = findKeyesFromNum(fPath, lineNum+1);
	return keys;
}


export function getObjPath(fPath:string, pos:Position){
	let refs = findRefs(fPath);
	console.log(refs);

	let keys = findKeyesFromNum(refs[0], pos.line);
	keys.reverse();
	keys.shift();

	console.log(keys);

	let ref = path.basename(fPath, '.json');
	let s = findRefInFile(refs[1], ref);
	s.reverse();

	s.pop();

	console.log(s);

	keys.shift();
}



let tree = new Tree("schema.json");


let schema = loadSchema("C:\\MaconomySources\\iAccess\\Application\\20\\Workspace\\EmployeeSelfService\\AbsenceMgmt\\AbsenceMgmt_AbsenceRequests_Tab.json");

let pos = Position.create(6, 15);
getObjPath("C:\\MaconomySources\\iAccess\\Application\\20\\Workspace\\EmployeeSelfService\\AbsenceMgmt\\AbsenceMgmt_AbsenceRequests_Tab.json", pos);
//let test  = parseSchema(schema, tree, "schema.json", schema);
console.log(pointer.get(schema, "/definitions/ITab/properties/rows"));