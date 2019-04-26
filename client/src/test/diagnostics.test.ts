
import * as vscode from 'vscode';
import * as assert from 'assert';
import { getDocUri, activate } from './helper';

describe('Should get diagnostics', () => {
  const docUri = getDocUri('diagnostics.json');

  it('Diagnoses non-existing paths', async () => {
    await testDiagnostics(docUri, [
      { message: 'Examples:Dog is not a valid path.', range: toRange(3, 12, 3, 24), severity: vscode.DiagnosticSeverity.Warning, source: 'ex' },
      { message: 'Examples:Cat is not a valid path.', range: toRange(6, 12, 6, 24), severity: vscode.DiagnosticSeverity.Warning, source: 'ex' }
    ]);
  });
});

function toRange(sLine: number, sChar: number, eLine: number, eChar: number) {
  const start = new vscode.Position(sLine, sChar);
  const end = new vscode.Position(eLine, eChar);
  return new vscode.Range(start, end);
}

async function testDiagnostics(docUri: vscode.Uri, expectedDiagnostics: vscode.Diagnostic[]) {
  await activate(docUri);

  const actualDiagnostics = vscode.languages.getDiagnostics(docUri);

  assert.equal(actualDiagnostics.length, expectedDiagnostics.length);

  expectedDiagnostics.forEach((expectedDiagnostic, i) => {
    const actualDiagnostic = actualDiagnostics[i];
    assert.equal(actualDiagnostic.message, expectedDiagnostic.message);
    assert.deepEqual(actualDiagnostic.range, expectedDiagnostic.range);
    assert.equal(actualDiagnostic.severity, expectedDiagnostic.severity);
  });
}