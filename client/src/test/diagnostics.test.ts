
import * as vscode from 'vscode';
import * as assert from 'assert';
import { getDocUri, activate, sleep } from './helper';

describe('Should get diagnostics', () => {
  const docUri = getDocUri('application.json');
  const platformUri = getDocUri('Platform/Platform.json');
	const shellUri = getDocUri('Shell/Notifications.json');
	const workspaceUri = getDocUri('Workspace/Workspace.json');
	const dailyTimeSheetsUri = getDocUri('Workspace/EmployeeSelfService/DailyTimeSheets/DailyTimeSheets.json');

  it('Diagnoses non-existing paths', async () => {
    await testDiagnostics(docUri, [
      { message: '- [\'platfor\'] is an invalid additional property',
       range: toRange(15, 3, 15, 11), severity: vscode.DiagnosticSeverity.Warning, source: 'vscode-lsp' }]);
    await testDiagnostics(platformUri, []);
    await testDiagnostics(shellUri, [
      { message: '- .shell.notifications[\'type\'] is an invalid additional property',
       range: toRange(6, 3, 6, 8), severity: vscode.DiagnosticSeverity.Warning, source: 'vscode-lsp' }]);
    await testDiagnostics(dailyTimeSheetsUri, [
      { message: '- .workspace.workspaces[\'DailyTimeSheets\'].layout[\'row\'] is an invalid additional property',
       range: toRange(16, 5, 16, 9), severity: vscode.DiagnosticSeverity.Warning, source: 'vscode-lsp' }]);
    await testDiagnostics(workspaceUri, [
      { message: '- .workspace.workspaces[\'MyReports\'][\'$re\'] is an invalid additional property',
       range: toRange(165, 7, 165, 11), severity: vscode.DiagnosticSeverity.Warning, source: 'vscode-lsp' }]);
  });
});

function toRange(sLine: number, sChar: number, eLine: number, eChar: number) {
  const start = new vscode.Position(sLine, sChar);
  const end = new vscode.Position(eLine, eChar);
  return new vscode.Range(start, end);
}

async function testDiagnostics(docUri: vscode.Uri, expectedDiagnostics: vscode.Diagnostic[]) {
  await activate(docUri);
  await sleep(1000);

  const actualDiagnostics = vscode.languages.getDiagnostics(docUri);

  assert.equal(actualDiagnostics.length, expectedDiagnostics.length);

  expectedDiagnostics.forEach((expectedDiagnostic, i) => {
    const actualDiagnostic = actualDiagnostics[i];
    assert.equal(actualDiagnostic.message, expectedDiagnostic.message);
    assert.deepEqual(actualDiagnostic.range, expectedDiagnostic.range);
    assert.equal(actualDiagnostic.severity, expectedDiagnostic.severity);
  });

  
}