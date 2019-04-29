
import * as vscode from 'vscode';
import * as assert from 'assert';
import { getDocUri, activate } from './helper';

describe('Should go to definition', () => {
	const docUri = getDocUri('definitions.json');
	const targetUri=getDocUri('Examples/Cats.json');
	it('Goes to definition if path is complete', async () => {
		await testDefinition(docUri, new vscode.Position(6, 23), [new vscode.Location(targetUri, new vscode.Position(6,23))]);
	});
});

async function testDefinition(
	docUri: vscode.Uri,
	position: vscode.Position,
	expectedDefinitionList: vscode.Location[]
) {
	await activate(docUri);

	// Executing the command `vscode.executeCompletionItemProvider` to simulate triggering completion
	const actualDefinitionList = (await vscode.commands.executeCommand(
		'vscode.executeDefinitionProvider',
		docUri,
		position
	)) as vscode.Location;

	expectedDefinitionList.forEach((expectedItem, i) => {
		const actualItem = actualDefinitionList[i];
		assert.equal(actualItem.uri.path, expectedItem.uri.path);

		assert.equal(actualItem.range.start.character, 12);
		assert.equal(actualItem.range.end.character, 25);

		assert.equal(actualItem.range.start.line, expectedItem.range.start.line);
		assert.equal(actualItem.range.end.line, expectedItem.range.end.line);
	});
}
