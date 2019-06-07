import * as vscode from 'vscode';
import * as assert from 'assert';
import { getDocUri, activate } from './helper';
import {Hover} from "vscode-languageserver";
describe('Should provide hovers', () => {
	const docUri = getDocUri('application.json');
	const platformUri = getDocUri('Platform/Platform.json');
	const shellUri = getDocUri('Shell/Shell.json');
	const workspaceUri = getDocUri('Workspace/Workspace.json');
	const dailyTimeSheetsUri = getDocUri('Workspace/EmployeeSelfService/DailyTimeSheets/DailyTimeSheets.json');

	it('Hovers no path or instruction', async () => {
		await testHover(docUri, new vscode.Position(10, 21), [{contents: "Ctrl + click to follow path", range:{start:{line: 10, character: 12}, end:{line:10,character:25}}}]);
		await testHover(platformUri, new vscode.Position(8, 17), [{contents: "Ctrl + click to follow path", range:{start:{line: 8, character: 12}, end:{line:8,character:23}}}]);
		await testHover(shellUri, new vscode.Position(6, 17), [{contents: "Ctrl + click to follow path", range:{start:{line: 6, character: 12}, end:{line:6,character:22}}}]);
		await testHover(workspaceUri, new vscode.Position(78, 37), [{contents: "Ctrl + click to follow path", range:{start:{line: 78, character: 14}, end:{line:78,character:48}}}]);
		await testHover(dailyTimeSheetsUri, new vscode.Position(18, 28), [{contents: "Ctrl + click to follow path", range:{start:{line: 18, character: 16}, end:{line:18,character:51}}}]);
	});
});


async function testHover(
	docUri: vscode.Uri,
	position: vscode.Position,
	expectedHoverList: Hover[]
) {
	await activate(docUri);

	// Executing the command `vscode.executeCompletionItemProvider` to simulate triggering a
	const actualHoverList = (await vscode.commands.executeCommand(
		'vscode.executeHoverProvider',
		docUri,
		position
	)) as Hover;
	expectedHoverList.forEach((expectedItem, i) => {
		const actualItem = actualHoverList[i];
		assert.equal(actualItem.contents[0].value, expectedItem.contents);

		assert.equal(actualItem.range.start.character, expectedItem.range.start.character);
		assert.equal(actualItem.range.start.line, expectedItem.range.start.line);

		assert.equal(actualItem.range.end.character, expectedItem.range.end.character);
		assert.equal(actualItem.range.end.line, expectedItem.range.end.line);

	});
}
