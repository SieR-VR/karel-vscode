import {
    createConnection,
    TextDocuments,
    ProposedFeatures,
    InitializeParams,
    DidChangeConfigurationNotification,
    CompletionItem,
    CompletionItemKind,
    TextDocumentPositionParams,
    TextDocumentSyncKind,
    InitializeResult,
} from 'vscode-languageserver/node';
import {
    TextDocument
} from 'vscode-languageserver-textdocument';

import { tokenize } from './language/tokenizer';
import { parse } from './language/parser';

import karelKeyword from './language/keyword.json';
import karelFunction from './language/function.json';

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

    try {
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

        connection.sendDiagnostics({
            uri: textDocument.uri,
            diagnostics: []
        });
    } catch (e) {
        connection.console.error(`Unexpected error while validating document ${textDocument.uri}: ${e}`);
        connection.sendDiagnostics({
            uri: textDocument.uri,
            diagnostics: []
        });
    }
}

connection.onCompletion(
    (_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
        const completionKeywords = Object.entries(karelKeyword.keyword).map(([_, value]) => {
            const item: CompletionItem = {
                label: value.label,
                kind: CompletionItemKind.Keyword,
                data: value.data,
            };
            return item;
        });

        const completionFunctions = Object.entries(karelFunction.function).map(([_, value]) => {
            const item: CompletionItem = {
                label: value.label,
                kind: CompletionItemKind.Function,
                data: value.data,
            };
            return item;
        });

        return [...completionKeywords, ...completionFunctions];
    }
);

connection.onCompletionResolve(
    (item: CompletionItem): CompletionItem => {
        const [category, name] = (item.data as string).split('/') as [string, string];

        if (category === 'keyword') {
            const keywordName = name as keyof typeof karelKeyword.keyword;
            const keyword = karelKeyword.keyword[keywordName];
            item.detail = keyword.detail;
            item.documentation = keyword.documentation;
        } else if (category === 'function') {
            const functionName = name as keyof typeof karelFunction.function;
            const func = karelFunction.function[functionName];
            item.detail = func.detail;
            item.documentation = func.documentation;
        }

        return item;
    }
);

documents.listen(connection);
connection.listen();
