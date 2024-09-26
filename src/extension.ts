/* eslint-disable @typescript-eslint/naming-convention */

import * as vscode from "vscode";

const http = require("http");
const highlightjs = require("markdown-it-highlightjs");
const md = require("markdown-it")();
const uuid = require("uuid");
md.use(highlightjs);

let gpt_messages_array: any = []; // Array of messages in the current session
let thread_ts: string = ""; // thread_ts value for the current session
let help50_message: string = ""; // help50 message for the current session

export function activate(context: vscode.ExtensionContext) {
  // Register the ddb50 chat window
  const provider = new DDBViewProvider(context.extensionUri, context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(DDBViewProvider.viewId, provider),
  );

  // Command: Ask a question in the ddb50 chat window
  context.subscriptions.push(
    vscode.commands.registerCommand("ddb50.ask", async (args) => {
      await vscode.commands
        .executeCommand("ddb50.chatWindow.focus")
        .then(() => {
          setTimeout(() => {
            provider.webViewGlobal?.webview.postMessage({
              command: "ask",
              content: { userMessage: args[0] },
            });
          }, 100);
        });
    }),
  );

  // Command: Have the duck say something in the ddb50 chat window
  context.subscriptions.push(
    vscode.commands.registerCommand("ddb50.say", async (args) => {
      await vscode.commands
        .executeCommand("ddb50.chatWindow.focus")
        .then(() => {
          setTimeout(() => {
            provider.webViewGlobal?.webview.postMessage({
              command: "say",
              content: { userMessage: args[0] },
            });
          }, 100);
        });
    }),
  );

  // Command: Prompt the user for input in the ddb50 chat window
  context.subscriptions.push(
    vscode.commands.registerCommand("ddb50.prompt", async (args) => {
      vscode.window
        .showInformationMessage(args[0], ...["Ask for Help", "Dismiss"])
        .then((selection) => {
          if (selection === "Ask for Help") {
            vscode.commands
              .executeCommand("ddb50.chatWindow.focus")
              .then(() => {
                setTimeout(() => {
                  provider.webViewGlobal?.webview.postMessage({
                    command: "ask",
                    content: { userMessage: args[1] },
                  });
                }, 100);
              });
          }
        });
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("ddb50.hide", async (args) => {
      vscode.window.showInformationMessage("");
    }),
  );

  // Command: Download the chat history
  context.subscriptions.push(
    vscode.commands.registerCommand("ddb50.downloadChatHistory", async () => {
      const chatHistory = gpt_messages_array
        .map((message: any) => {
          return `${message.role}: ${message.content}\n`;
        })
        .join("\n");

      // Show a "Save As" dialog
      const uri = await vscode.window.showSaveDialog({
        saveLabel: "Spremi povijest razgovora",
        filters: { "Text Files": ["txt"] },
        defaultUri: vscode.Uri.file(
          `${vscode.workspace.workspaceFolders?.[0]?.uri.fsPath}/baltazar_chat_history_${Date.now()}.txt`,
        ),
      });

      if (uri) {
        // Write the chat history to the selected file
        await vscode.workspace.fs.writeFile(
          uri,
          Buffer.from(chatHistory, "utf8"),
        );
        vscode.window.showInformationMessage("Povijest spremljena!");
      } else {
        vscode.window.showWarningMessage("Operacija spremanja obustavljena.");
      }
    }),
  );

  // Command: Clear Messages in the ddb50 chat window with confirmation
  context.subscriptions.push(
    vscode.commands.registerCommand("ddb50.resetHistory", async () => {
      const result = await vscode.window.showWarningMessage(
        "Jeste li sigurni da želite obrisati povijest razgovora? Ova radnja je nepovratna.",
        { modal: true },
        "Ne, odustani",
        "Da, obriši povijest",
      );

      if (result === "Da, obriši povijest") {
        provider.webViewGlobal?.webview.postMessage({
          command: "resetHistory",
        });
        gpt_messages_array = [];
        vscode.window.showInformationMessage("Povijest izbrisana.");
      }
    }),
  );

  // Help50 commands
  context.subscriptions.push(
    vscode.commands.registerCommand("ddb50.help50.say", async (args) => {
      help50_message = args[0];
      await vscode.commands.executeCommand(
        "setContext",
        "ddb50:help50ask",
        false,
      );
      await vscode.commands.executeCommand(
        "setContext",
        "ddb50:help50say",
        true,
      );
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("ddb50.help50.say.click", async (args) => {
      await vscode.commands
        .executeCommand("ddb50.chatWindow.focus")
        .then(async () => {
          // ensure provider.webViewGlobal is defined and has a webview
          while (
            provider.webViewGlobal === undefined ||
            provider.webViewGlobal?.webview === undefined
          ) {
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
          await provider.webViewGlobal?.webview.postMessage({
            command: "say",
            content: { userMessage: help50_message },
          });
        });
      await vscode.commands.executeCommand(
        "setContext",
        "ddb50:help50say",
        false,
      );
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("ddb50.help50.ask", async (args) => {
      help50_message = args[0];
      await vscode.commands.executeCommand(
        "setContext",
        "ddb50:help50say",
        false,
      );
      await vscode.commands.executeCommand(
        "setContext",
        "ddb50:help50ask",
        true,
      );
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("ddb50.help50.ask.click", async (args) => {
      await vscode.commands
        .executeCommand("ddb50.chatWindow.focus")
        .then(async () => {
          // ensure provider.webViewGlobal is defined and has a webview
          while (
            provider.webViewGlobal === undefined ||
            provider.webViewGlobal?.webview === undefined
          ) {
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
          await provider.webViewGlobal?.webview.postMessage({
            command: "ask",
            content: { userMessage: help50_message },
          });
        });
      await vscode.commands.executeCommand(
        "setContext",
        "ddb50:help50ask",
        false,
      );
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("ddb50.help50.dismiss", async (args) => {
      help50_message = "";
      await vscode.commands.executeCommand(
        "setContext",
        "ddb50:help50say",
        false,
      );
      await vscode.commands.executeCommand(
        "setContext",
        "ddb50:help50ask",
        false,
      );
    }),
  );

  vscode.window.onDidCloseTerminal(async (terminal) => {
    help50_message = "";
    await vscode.commands.executeCommand(
      "setContext",
      "ddb50:help50say",
      false,
    );
    await vscode.commands.executeCommand(
      "setContext",
      "ddb50:help50ask",
      false,
    );
  });

  // Expose ddb50 API to other extensions (e.g., style50)
  const api = {
    requestGptResponse: async (
      displayMessage: string,
      contextMessage: string,
      payload: any,
    ) => {
      provider.createDisplayMessage(displayMessage).then(() => {
        setTimeout(() => {
          provider.getGptResponse(uuid.v4(), payload, contextMessage, false);
        }, 1000);
      });
    },
  };
  return api;
}

class DDBViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewId = "ddb50.chatWindow";
  public webViewGlobal: vscode.WebviewView | undefined;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly context: vscode.ExtensionContext,
  ) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };
    webviewView.webview.onDidReceiveMessage(
      (message) => {
        switch (message.command) {
          case "reset_history":
            gpt_messages_array = [];
            return;

          case "get_gpt_response":
            this.getGptResponse(message.id, message.content);
            return;

          case "restore_messages":
            gpt_messages_array = message.content;
            return;
        }
      },
      undefined,
      this.context.subscriptions,
    );
    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);
    this.webViewGlobal = webviewView;
  }

  public async createDisplayMessage(message: string) {
    await vscode.commands.executeCommand("ddb50.chatWindow.focus").then(() => {
      setTimeout(() => {
        this.webViewGlobal!.webview.postMessage({
          command: "addMessage",
          content: {
            userMessage: message,
          },
        });
      }, 100);
    });
  }

  public getGptResponse(
    id: string,
    payload: any,
    contextMessage: string = "",
    chat = true,
  ) {
    try {
      // if input is too long, abort
      if ((chat && payload.length > 10000) || contextMessage.length > 10000) {
        this.webviewDeltaUpdate(id, "Dogodio se problem sa serverom.\n");
        this.webViewGlobal!.webview.postMessage({ command: "enable_input" });
        return;
      }

      // request timestamp in epoch time
      const requestTimestamp = Date.now();

      chat
        ? gpt_messages_array.push({
            role: "user",
            content: payload,
            timestamp: requestTimestamp,
          })
        : gpt_messages_array.push({
            role: "user",
            content: contextMessage,
            timestamp: requestTimestamp,
          });

      this.webViewGlobal!.webview.postMessage({
        command: "persist_messages",
        gpt_messages_array: gpt_messages_array,
      });

      const postOptions = {
        method: "POST",
        hostname: "localhost",
        port: 8080,
        path: "/v1/chat/completions",
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 10000,
      };

      // ensure message only has "role" and "content" keys
      const payloadMessages = gpt_messages_array.map((message: any) => {
        return { role: message.role, content: message.content };
      });
      let postData;
      chat
        ? (postData = {
            messages: payloadMessages,
            model: "mistral-large-2407",
          })
        : (postData = payload);

      // add thread_ts to postData
      postData["thread_ts"] = thread_ts;
      postData = JSON.stringify(postData);

      const postRequest = http.request(postOptions, (res: any) => {
        if (res.statusCode !== 200) {
          console.log(res.statusCode, res.statusMessage);
          this.webviewDeltaUpdate(id, "Dogodio se problem sa serverom.\n");
          this.webViewGlobal!.webview.postMessage({ command: "enable_input" });
          return;
        }

        res.on("timeout", () => {
          console.log("Request timed out");
          console.log(res.statusCode, res.statusMessage);
          postRequest.abort();
          this.webviewDeltaUpdate(id, "Dogodio se problem sa serverom.\n");
          this.webViewGlobal!.webview.postMessage({ command: "enable_input" });
          return;
        });

        let buffers: string = "";
        let partialToken: string = "";

        res.on("data", (chunk: any) => {
          const chunkStr = chunk.toString();
          console.log("Raw chunk:", chunkStr); // Debug log

          // Split the chunk into lines
          const lines = (partialToken + chunkStr).split("\n");

          // The last line might be incomplete, so we'll save it for the next chunk
          partialToken = lines.pop() || "";

          lines.forEach((line) => {
            if (line.startsWith("data: ")) {
              const jsonStr = line.slice(6); // Remove "data: " prefix
              try {
                const jsonData = JSON.parse(jsonStr);
                if (
                  jsonData.choices &&
                  jsonData.choices[0] &&
                  jsonData.choices[0].delta
                ) {
                  const content = jsonData.choices[0].delta.content;
                  if (content) {
                    buffers += content;
                    this.webviewDeltaUpdate(id, buffers);
                  }
                }
              } catch (e) {
                console.error("Error parsing JSON:", e);
              }
            }
          });
        });

        res.on("end", () => {
          // Handle any remaining partial token
          if (partialToken) {
            if (partialToken.startsWith("data: ")) {
              const jsonStr = partialToken.slice(6);
              try {
                const jsonData = JSON.parse(jsonStr);
                if (
                  jsonData.choices &&
                  jsonData.choices[0] &&
                  jsonData.choices[0].delta
                ) {
                  const content = jsonData.choices[0].delta.content;
                  if (content) {
                    buffers += content;
                    this.webviewDeltaUpdate(id, buffers);
                  }
                }
              } catch (e) {
                console.error("Error parsing JSON in last partial token:", e);
              }
            }
          }

          gpt_messages_array.push({
            role: "assistant",
            content: buffers,
            timestamp: requestTimestamp,
          });
          this.webViewGlobal!.webview.postMessage({
            command: "persist_messages",
            gpt_messages_array: gpt_messages_array,
          });
          this.webViewGlobal!.webview.postMessage({ command: "enable_input" });
        });
      });

      postRequest.write(postData);
      postRequest.end();
    } catch (error: any) {
      console.log(error);
    }
  }

  private webviewDeltaUpdate(id: string, content: string) {
    this.webViewGlobal!.webview.postMessage({
      command: "delta_update",
      content: md.render(content),
      id: id,
    });
  }

  private getHtmlForWebview(webview: vscode.Webview) {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "static", "ddb.js"),
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "static", "style.css"),
    );
    const highlightjsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this._extensionUri,
        `static/vendor/highlightjs/11.7.0/highlight.min.js`,
      ),
    );
    const bootstrapStyleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this._extensionUri,
        `static/vendor/bootstrap/5.3.3/css/bootstrap.min.css`,
      ),
    );
    const bootstrapScriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this._extensionUri,
        `static/vendor/bootstrap/5.3.3/js/bootstrap.bundle.min.js`,
      ),
    );
    let highlightStyleUri: vscode.Uri;
    let codeStyleUri: vscode.Uri;

    let lightTheme = [
      vscode.ColorThemeKind.Light,
      vscode.ColorThemeKind.HighContrastLight,
    ];
    const isLightTheme = lightTheme.includes(
      vscode.window.activeColorTheme.kind,
    );
    if (isLightTheme) {
      codeStyleUri = webview.asWebviewUri(
        vscode.Uri.joinPath(this._extensionUri, `static/css/light.css`),
      );
      highlightStyleUri = webview.asWebviewUri(
        vscode.Uri.joinPath(
          this._extensionUri,
          `static/vendor/highlightjs/11.7.0/styles/github.min.css`,
        ),
      );
    } else {
      codeStyleUri = webview.asWebviewUri(
        vscode.Uri.joinPath(this._extensionUri, `static/css/dark.css`),
      );
      highlightStyleUri = webview.asWebviewUri(
        vscode.Uri.joinPath(
          this._extensionUri,
          `static/vendor/highlightjs/11.7.0/styles/github-dark.min.css`,
        ),
      );
    }
    const markdownItUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this._extensionUri,
        `static/vendor/markdown-it/markdown-it.min.js`,
      ),
    );

    let fontSize: number | undefined = vscode.workspace
      .getConfiguration()
      .get("editor.fontSize");
    fontSize !== undefined ? fontSize : 12;

    return `
            <!DOCTYPE html>
            <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="initial-scale=1.0, width=device-width">
                    <link href="${bootstrapStyleUri}" rel="stylesheet">
                    <link href="${highlightStyleUri}" rel="stylesheet">
                    <link href="${codeStyleUri}" rel="stylesheet">
                    <link href="${styleUri}" rel="stylesheet">
                    <title>Baltazar</title>
                    <style>
                        body { font-size: ${fontSize}px; }
                        textarea { font-size: ${fontSize}px; }
                    </style>
                </head>
                <body>
                    <div id="ddbChatContainer">
                        <div id="ddbChatText"></div>
                        <div id="resizeHandle"></div>
                        <div id="ddbOutterEnergyBar" class="progress" role="progressbar" aria-label="CS50 Duck Energy Bar" aria-valuenow="100" aria-valuemin="0" aria-valuemax="100">
                            <div id="ddbInnerEnergyBar" class="progress-bar" style="width: 100%; color: black"></div>
                        </div>
                        <div id="ddbInput"><textarea placeholder="Pitaj me!"></textarea></div>
                    </div>
                </body>
                <script src="${bootstrapScriptUri}"></script>
                <script src="${highlightjsUri}"></script>
                <script src="${markdownItUri}"></script>
                <script src="${scriptUri}"></script>
            </html>
        `;
  }
}

export function deactivate() {}
