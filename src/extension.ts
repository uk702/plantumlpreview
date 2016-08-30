'use strict';

import * as vscode from 'vscode';
import * as path from 'path';
import * as child_process from 'child_process';
import * as Q from 'q';

export function activate(context: vscode.ExtensionContext) {
    if (!process.env['PLANTUML_HOME'] || !process.env['JAVA_HOME'] || !process.env['TEMP']) {
        vscode.window.showErrorMessage('Setup enviroment variable. PLANTUML_HOME, JAVA_HOME, TEMP'); 
        return;
    }

    let plantumlCommand = '"' + path.join(process.env['PLANTUML_HOME'], 'plantuml.jar') + '"';
    let javaCommand = '"' + path.join(process.env['JAVA_HOME'], 'bin', 'java.exe') + '"';
    let outputPath = path.join(process.env['TEMP'], 'okazukiplantuml');

    class TextDocumentContentProvider implements vscode.TextDocumentContentProvider {
        private _onDidChange = new vscode.EventEmitter<vscode.Uri>();

        public provideTextDocumentContent(uri: vscode.Uri): string {
            return this.createPlantumlSnippet();
        }

        get onDidChange(): vscode.Event<vscode.Uri> {
            return this._onDidChange.event;
        }

        public update(uri: vscode.Uri) {
            this._onDidChange.fire(uri);
        }

        private createPlantumlSnippet() {
            let editor = vscode.window.activeTextEditor;
            if (!(editor.document.languageId === 'plaintext')) {
                return this.errorSnippet("not plaintext");
            }
            return this.extractSnippet();
        }

        private extractSnippet(): string {
            let editor = vscode.window.activeTextEditor;
            var r = `<body>
                <img src='file://` + path.join(outputPath, path.basename(editor.document.uri.fsPath, '.txt')) + `.png?dummy=` + new Date().getTime() + `' />
            </body>`;
            return r;
        }

        private errorSnippet(text: string) {
            return `<body>
                <span>` + text + `</span>
            </body>`
        }
    }

    let provider = new TextDocumentContentProvider();
    let registration = vscode.workspace.registerTextDocumentContentProvider('plantuml-preview', provider);

    let previewUri = vscode.Uri.parse('plantuml-preview://authority/plantuml-preview');    
    let disposable = vscode.commands.registerCommand('extension.previewPlantUML', () => {
        let editor = vscode.window.activeTextEditor;
        var d = Q.defer();
        console.log(javaCommand + ' -jar ' + plantumlCommand + ' "' +
            editor.document.uri.fsPath + '" -o "' + outputPath + '"');
        child_process.exec(javaCommand + ' -jar ' + plantumlCommand + ' "' +
            editor.document.uri.fsPath + '" -o "' + outputPath + '"', (error, stdout, stderr) => {
                vscode.commands.executeCommand('vscode.previewHtml', previewUri, vscode.ViewColumn.Two, 'PlantUML Preview')
                    .then((success) => {
                        provider.update(previewUri);
                         d.resolve(); 
                    }, (reason) => { 
                        vscode.window.showErrorMessage(reason); 
                        d.resolve();
                    });            
            });

        return d.promise;
    });

    vscode.workspace.onDidSaveTextDocument((e: vscode.TextDocument) => {
        if (e === vscode.window.activeTextEditor.document) {
            let editor = vscode.window.activeTextEditor;
            console.log(javaCommand + ' -jar ' + plantumlCommand + ' "' +
                editor.document.uri.fsPath + '" -o "' + outputPath + '"');
            child_process.exec(javaCommand + ' -jar ' + plantumlCommand + ' "' +
                editor.document.uri.fsPath + '" -o "' + outputPath + '"', (error, stdout, stderr) => {
                    provider.update(previewUri);
                });
        }
    });

    context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {
}