import * as vscode from 'vscode';
import * as assert from 'assert';
import { getDocUri, activate } from './helper';
import {Hover} from "vscode-languageserver";
describe('Should provide hovers', () => {
	const docUri = getDocUri('hover.json');
	it('Hovers no path or instruction', async () => {
	
		await testHover(docUri, new vscode.Position(6, 23), [{contents: "Hold Ctrl to follow path", range:{start:{line: 6, character: 11}, end:{line:6,character:26}}}]
		);
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
