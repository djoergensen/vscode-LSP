
import * as vscode from 'vscode';
import * as assert from 'assert';
import { getDocUri, activate, sleep } from './helper';

describe('Should get diagnostics', () => {
  const docUri = getDocUri('application.json');
  const platformUri = getDocUri('Platform/Platform.json');
	const shellUri = getDocUri('Shell/Notifications.json');
	const workspaceUri = getDocUri('Workspace/Workspace.json');
	const dailyTimeSheetsUri = getDocUri('Workspace/EmployeeSelfService/DailyTimeSheets/DailyTimeSheets.json');

  it('Diagnoses invalid keys and references', async () => {
    await testDiagnostics(docUri, [{ message: 'Authentication:Authenticatio is not a valid path.',
    range: toRange(7, 13, 7, 41), severity: vscode.DiagnosticSeverity.Warning, source: 'vscode-lsp' },
      { message: '- [\'platfor\'] is an invalid additional property',
       range: toRange(15, 3, 15, 11), severity: vscode.DiagnosticSeverity.Warning, source: 'vscode-lsp' }]);

    await testDiagnostics(platformUri, [{ message: 'Usagetrackin is not a valid path.',
    range: toRange(2, 13, 2, 25), severity: vscode.DiagnosticSeverity.Warning, source: 'vscode-lsp' }]);

    await testDiagnostics(shellUri, [{ message: 'NotificationType is not a valid path.',
    range: toRange(7, 13, 7, 29), severity: vscode.DiagnosticSeverity.Warning, source: 'vscode-lsp' },
      { message: '- .shell.notifications[\'type\'] is an invalid additional property',
       range: toRange(6, 3, 6, 8), severity: vscode.DiagnosticSeverity.Warning, source: 'vscode-lsp' }]);

    await testDiagnostics(dailyTimeSheetsUri, [{ message: 'DailyTimeSheets_Headin is not a valid path.',
    range: toRange(8, 15, 8, 37), severity: vscode.DiagnosticSeverity.Warning, source: 'vscode-lsp' },
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