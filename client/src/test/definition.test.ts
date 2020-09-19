import * as vscode from 'vscode';
import * as assert from 'assert';
import { getDocUri, activate } from './helper';

describe('Should go to definition', () => {
	const docUri = getDocUri('application.json');
	const docTarget = getDocUri('Shell/Shell.json');

	const platformUri = getDocUri('Platform/Platform.json');
	const platformTarget = getDocUri('Platform/Containers.json');

	const shellUri = getDocUri('Shell/Shell.json');
	const shellTarget = getDocUri('Shell/Menu.json');

	const workspaceUri = getDocUri('Workspace/Workspace.json');
	const workspaceTarget = getDocUri('Workspace/Jobs/JobEstimation/JobEstimation.json');

	const dailyTimeSheetsUri = getDocUri('Workspace/EmployeeSelfService/DailyTimeSheets/DailyTimeSheets.json');
	const dailyTimeSheetsTarget = getDocUri('Workspace/EmployeeSelfService/DailyTimeSheets/DailyTimeSheets_ActionBar.json');

	it('Goes to definition if path is complete', async () => {
		await testDefinition(docUri, new vscode.Position(10, 21), [new vscode.Location(docTarget, new vscode.Range(10, 13, 10, 24))]);
		await testDefinition(platformUri, new vscode.Position(5, 18), [new vscode.Location(platformTarget, new vscode.Range(5, 13, 5, 23))]);
		await testDefinition(shellUri, new vscode.Position(2, 15), [new vscode.Location(shellTarget, new vscode.Range(2, 13, 2, 17))]);
		await testDefinition(workspaceUri, new vscode.Position(78, 32), [new vscode.Location(workspaceTarget, new vscode.Range(78, 15, 78, 47))]);
		await testDefinition(dailyTimeSheetsUri, new vscode.Position(14, 31), [new vscode.Location(dailyTimeSheetsTarget, new vscode.Range(14, 15, 14, 40))]);
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

		assert.equal(actualItem.range.start.character, expectedItem.range.start.character);
		assert.equal(actualItem.range.end.character, expectedItem.range.end.character);

		assert.equal(actualItem.range.start.line, expectedItem.range.start.line);
		assert.equal(actualItem.range.end.line, expectedItem.range.end.line);
	});
}
