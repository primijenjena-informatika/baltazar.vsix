/* eslint-disable @typescript-eslint/naming-convention */

import * as vscode from 'vscode';
const axios = require('axios').default;
const https = require('https');
const highlightjs = require('markdown-it-highlightjs');
const md = require('markdown-it')();
md.use(highlightjs);

let githubUserId: any = '';

export function activate(context: vscode.ExtensionContext) {
    const provider = new DDBViewProvider(context.extensionUri, context);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(DDBViewProvider.viewId, provider));

    // Command: Clear Messages in the ddb50 chat window
    context.subscriptions.push(
        vscode.commands.registerCommand('ddb50.clearMessages', () => {
            provider.webViewGlobal?.webview.postMessage({ command: 'clearMessages' });
        })
    );

    getUserId().then((id: string) => {
        githubUserId = id;
    });
}

async function getUserId() {
    const url = 'https://api.github.com/user';
    const headers = {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${process.env['GITHUB_TOKEN']}`,
        'X-GitHub-Api-Version': '2022-11-28'
    };
    return await axios.get(url, { headers: headers }).then((response: any) => {
        return response.data.id;
    });
}

class DDBViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewId = 'ddb50.debugView';
    public webViewGlobal: vscode.WebviewView | undefined;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly context: vscode.ExtensionContext,
    ) { }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };
        webviewView.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'get_gpt_response':
                        this.getGptResponse(message.id, message.content);
                        return;
                }
            },
            undefined,
            this.context.subscriptions
        );
        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
        this.webViewGlobal = webviewView;
    }

    private getGptResponse(id: string, content: string) {
        try {
            const postData = JSON.stringify({
                'message': content,
                'stream': true,
                'user': {
                    'id': githubUserId,
                    'login': process.env['GITHUB_USER']
                }
            });

            const postOptions = {
                method: 'POST',
                host: 'cs50.ai',
                port: 443,
                path: '/ddb50',
                headers: {
                    'Content-Type': 'application/json'
                }
            };

            const postRequest = https.request(postOptions, (res: any) => {
                let buffers: string = '';
                res.on('data', (chunk: any) => {
                    buffers += chunk;
                    this.webviewDeltaUpdate(id, buffers);
                });
            });

            postRequest.write(postData);
            postRequest.end();
        } catch (error: any) {
            console.log(error);
        }
    }

    private webviewDeltaUpdate(id: string, content: string) {
        this.webViewGlobal!.webview.postMessage(
            {
                command: 'delta_update',
                id: id,
                content: md.render(content)
            });
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'static', 'ddb.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'static', 'style.css'));
        return `
            <!DOCTYPE html>
            <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="initial-scale=1.0, width=device-width">
                    <link href="${styleUri}" rel="stylesheet">
                    <script src="${scriptUri}"></script>
                    <title>ddb50</title>
                </head>
                <body>
                    <div id="ddbChatContainer">
                        <div id="ddbChatText"></div>
                        <div id="ddbInput"><textarea placeholder="Message ddb"></textarea></div>
                    </div>
                </body>
            </html>
        `;
    }
}

export function deactivate() { }
