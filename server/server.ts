import {
    createConnection,
    TextDocuments,
    Diagnostic,
    DiagnosticSeverity,
    ProposedFeatures,
    InitializeParams,
    DidChangeConfigurationNotification,
    CompletionItem,
    CompletionItemKind,
    TextDocumentPositionParams,
    TextDocumentSyncKind,
    InitializeResult
} from 'vscode-languageserver/node';

import {
    TextDocument
} from 'vscode-languageserver-textdocument';

import { tokenize } from './tokenizer';
import { parse } from './parser';

const connection = createConnection(ProposedFeatures.all);
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability: boolean = false;
let hasWorkspaceFolderCapability: boolean = false;
let hasDiagnosticRelatedInformationCapability: boolean = false;

connection.onInitialize((params: InitializeParams) => {
    const capabilities = params.capabilities;

    hasConfigurationCapability = !!(
        capabilities.workspace && !!capabilities.workspace.configuration
    );
    hasWorkspaceFolderCapability = !!(
        capabilities.workspace && !!capabilities.workspace.workspaceFolders
    );
    hasDiagnosticRelatedInformationCapability = !!(
        capabilities.textDocument &&
        capabilities.textDocument.publishDiagnostics &&
        capabilities.textDocument.publishDiagnostics.relatedInformation
    );

    const result: InitializeResult = {
        capabilities: {
            textDocumentSync: TextDocumentSyncKind.Incremental,
            completionProvider: {
                resolveProvider: true
            }
        }
    };
    if (hasWorkspaceFolderCapability) {
        result.capabilities.workspace = {
            workspaceFolders: {
                supported: true
            }
        };
    }
    return result;
});

connection.onInitialized(() => {
    if (hasConfigurationCapability) {
        // Register for all configuration changes.
        connection.client.register(DidChangeConfigurationNotification.type, undefined);
    }
    if (hasWorkspaceFolderCapability) {
        connection.workspace.onDidChangeWorkspaceFolders(_event => {
            connection.console.log('Workspace folder change event received.');
        });
    }
});

documents.onDidChangeContent(change => {
    validateTextDocument(change.document);
});

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
    const text = textDocument.getText();

    const tokensUnchecked = tokenize(text);
    if (tokensUnchecked.is_err()) {
        connection.sendDiagnostics({
            uri: textDocument.uri,
            diagnostics: [tokensUnchecked.unwrap_err()]
        });
        return;
    }

    const tokens = tokensUnchecked.unwrap();
    const astUnchecked = parse(tokens);
    if (astUnchecked.is_err()) {
        connection.sendDiagnostics({
            uri: textDocument.uri,
            diagnostics: [astUnchecked.unwrap_err()]
        });
        return;
    }
}

connection.onCompletion(
    (_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
        return [
            {
                label: 'function',
                kind: CompletionItemKind.Keyword,
                data: 1
            },
            {
                label: 'while',
                kind: CompletionItemKind.Keyword,
                data: 2
            },
            {
                label: 'repeat',
                kind: CompletionItemKind.Keyword,
                data: 3
            },
            {
                label: 'if',
                kind: CompletionItemKind.Keyword,
                data: 4
            },
            {
                label: 'else',
                kind: CompletionItemKind.Keyword,
                data: 5
            },
        ];
    }
);

documents.listen(connection);
connection.listen();