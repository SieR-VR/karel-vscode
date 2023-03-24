import { Result, Ok, Err } from "ts-features";
import { 
    Diagnostic,
    DiagnosticSeverity 
} from "vscode-languageserver/node";

import {
    Token,
    TokenKind,
    isIdentifierToken,
    isNumberToken,
} from './tokenizer';

export function parse(input: Token[]): Result<SourceFile, Diagnostic> {
    const sourceFile = {
        functions: [] as FunctionDeclaration[]
    };

    let current = 0;

    while (current < input.length) {
        const token = input[current];

        if (token.kind === TokenKind.FunctionToken) {
            const functionDeclarationUnchecked = parseFunctionDeclaration(input, current);
            if (functionDeclarationUnchecked.is_err()) {
                return Err(functionDeclarationUnchecked.unwrap_err());
            }

            const functionDeclaration = functionDeclarationUnchecked.unwrap();

            sourceFile.functions.push(functionDeclaration);
            current = functionDeclaration.endPos;
        }
    }

    return Ok(sourceFile);
}

function parseFunctionDeclaration(input: Token[], startPos: number): Result<FunctionDeclaration, Diagnostic> {
    const functionDeclaration = {
        kind: 'FunctionDeclaration',
        name: '',
        body: {} as BlockStatement,
        startPos,
        endPos: 0
    } as FunctionDeclaration;
    const lastToken = input[input.length - 1];

    let current = startPos + 1;
    const functionIdentifer = input[current];
    if (!functionIdentifer) {
        return Err({
            message: 'Unexpected end of file',
            severity: DiagnosticSeverity.Error,
            range: {
                start: {
                    line: lastToken.line,
                    character: lastToken.col
                },
                end: {
                    line: lastToken.line,
                    character: lastToken.col + (lastToken.endPos - lastToken.startPos)
                }
            }
        });
    }

    if (!isIdentifierToken(functionIdentifer)) {
        return Err({
            message: 'Expected identifier',
            severity: DiagnosticSeverity.Error,
            range: {
                start: {
                    line: functionIdentifer.line,
                    character: functionIdentifer.col
                },
                end: {
                    line: functionIdentifer.line,
                    character: functionIdentifer.col + (functionIdentifer.endPos - functionIdentifer.startPos)
                }
            }
        });
    }

    functionDeclaration.name = functionIdentifer.value;
    current++;

    const lparen = input[current];
    if (lparen.kind !== TokenKind.LParen) {
        return Err({
            message: 'Expected (',
            severity: DiagnosticSeverity.Error,
            range: {
                start: {
                    line: lparen.line,
                    character: lparen.col
                },
                end: {
                    line: lparen.line,
                    character: lparen.col + (lparen.endPos - lparen.startPos)
                }
            }
        });
    }
    current++;

    const rparen = input[current];
    if (rparen.kind !== TokenKind.RParen) {
        return Err({
            message: 'Expected )',
            severity: DiagnosticSeverity.Error,
            range: {
                start: {
                    line: rparen.line,
                    character: rparen.col
                },
                end: {
                    line: rparen.line,
                    character: rparen.col + (rparen.endPos - rparen.startPos)
                }
            }
        });
    }
    current++;

    const blockStatementUnchecked = parseBlockStatement(input, current);
    if (blockStatementUnchecked.is_err()) {
        return Err(blockStatementUnchecked.unwrap_err());
    }

    const blockStatement = blockStatementUnchecked.unwrap();
    functionDeclaration.body = blockStatement;
    functionDeclaration.endPos = blockStatement.endPos;

    return Ok(functionDeclaration);
}

function parseBlockStatement(input: Token[], startPos: number): Result<BlockStatement, Diagnostic> {
    const blockStatement = {
        kind: 'BlockStatement',
        statements: [] as Statement[],
        startPos,
        endPos: 0
    } as BlockStatement;

    let current = startPos;

    const lbrace = input[current];
    if (lbrace.kind !== TokenKind.LBrace) {
        return Err({
            message: 'Expected {',
            severity: DiagnosticSeverity.Error,
            range: {
                start: {
                    line: lbrace.line,
                    character: lbrace.col
                },
                end: {
                    line: lbrace.line,
                    character: lbrace.col + (lbrace.endPos - lbrace.startPos)
                }
            }
        });
    }
    current++;

    while (current < input.length) {
        const token = input[current];

        if (token.kind === TokenKind.RBrace) {
            blockStatement.endPos = current + 1;
            return Ok(blockStatement);
        }

        const statementUnchecked = parseStatement(input, current);
        if (statementUnchecked.is_err()) {
            return Err(statementUnchecked.unwrap_err());
        }

        const statement = statementUnchecked.unwrap();
        blockStatement.statements.push(statement);
        current = statement.endPos;
    }

    return Err({
        message: 'Expected }',
        severity: DiagnosticSeverity.Error,
        range: {
            start: {
                line: input[current - 1].line,
                character: input[current - 1].col
            },
            end: {
                line: input[current - 1].line,
                character: input[current - 1].col + (input[current - 1].endPos - input[current - 1].startPos)
            }
        }
    });
}

function parseStatement(input: Token[], startPos: number): Result<Statement, Diagnostic> {
    const token = input[startPos];

    if (token.kind === TokenKind.Identifier) {
        return parseCallStatement(input, startPos);
    }

    if (token.kind === TokenKind.IfToken) {
        return parseIfStatement(input, startPos);
    }

    if (token.kind === TokenKind.WhileToken) {
        return parseWhileStatement(input, startPos);
    }

    if (token.kind === TokenKind.RepeatToken) {
        return parseRepeatStatement(input, startPos);
    }

    if (token.kind === TokenKind.LBrace) {
        return parseBlockStatement(input, startPos);
    }

    return Err({
        message: `Expected token: ${token.kind}`,
        severity: DiagnosticSeverity.Error,
        range: {
            start: {
                line: token.line,
                character: token.col
            },
            end: {
                line: token.line,
                character: token.col + (token.endPos - token.startPos)
            }
        }
    });
}

function parseCallStatement(input: Token[], startPos: number): Result<CallStatement, Diagnostic> {
    const callStatement = {
        kind: 'CallStatement',
        function: '',
        startPos,
        endPos: 0
    } as CallStatement;
    
    let current = startPos;

    const identifier = input[current];
    if (!isIdentifierToken(identifier)) {
        return Err({
            message: 'Expected identifier',
            severity: DiagnosticSeverity.Error,
            range: {
                start: {
                    line: identifier.line,
                    character: identifier.col
                },
                end: {
                    line: identifier.line,
                    character: identifier.col + (identifier.endPos - identifier.startPos)
                }
            }
        });
    }
    callStatement.function = identifier.value;
    current++;

    const lparen = input[current];
    if (lparen.kind !== TokenKind.LParen) {
        return Err({
            message: 'Expected (',
            severity: DiagnosticSeverity.Error,
            range: {
                start: {
                    line: lparen.line,
                    character: lparen.col
                },
                end: {
                    line: lparen.line,
                    character: lparen.col + (lparen.endPos - lparen.startPos)
                }
            }
        });
    }
    current++;

    const rparen = input[current];
    if (rparen.kind !== TokenKind.RParen) {
        return Err({
            message: 'Expected )',
            severity: DiagnosticSeverity.Error,
            range: {
                start: {
                    line: rparen.line,
                    character: rparen.col
                },
                end: {
                    line: rparen.line,
                    character: rparen.col + (rparen.endPos - rparen.startPos)
                }
            }
        });
    }
    current++;

    const semicolon = input[current];
    if (semicolon.kind !== TokenKind.SemiColon) {
        return Err({
            message: 'Expected ;',
            severity: DiagnosticSeverity.Error,
            range: {
                start: {
                    line: semicolon.line,
                    character: semicolon.col
                },
                end: {
                    line: semicolon.line,
                    character: semicolon.col + (semicolon.endPos - semicolon.startPos)
                }
            }
        });
    }
    current++;

    callStatement.endPos = current;
    return Ok(callStatement);
}

function parseIfStatement(input: Token[], startPos: number): Result<IfStatement, Diagnostic> {
    const ifStatement = {
        kind: 'IfStatement',
        condition_function: '',
        body: {} as BlockStatement,
        startPos,
        endPos: 0
    } as IfStatement;

    let current = startPos + 1;

    const lparen = input[current];
    if (lparen.kind !== TokenKind.LParen) {
        return Err({
            message: 'Expected (',
            severity: DiagnosticSeverity.Error,
            range: {
                start: {
                    line: lparen.line,
                    character: lparen.col
                },
                end: {
                    line: lparen.line,
                    character: lparen.col + (lparen.endPos - lparen.startPos)
                }
            }
        });
    }
    current++;

    const identifier = input[current];
    if (!isIdentifierToken(identifier)) {
        return Err({
            message: 'Expected identifier',
            severity: DiagnosticSeverity.Error,
            range: {
                start: {
                    line: identifier.line,
                    character: identifier.col
                },
                end: {
                    line: identifier.line,
                    character: identifier.col + (identifier.endPos - identifier.startPos)
                }
            }
        });
    }
    ifStatement.condition_function = identifier.value;
    current++;

    const lparen2 = input[current];
    if (lparen2.kind !== TokenKind.LParen) {
        return Err({
            message: 'Expected (',
            severity: DiagnosticSeverity.Error,
            range: {
                start: {
                    line: lparen2.line,
                    character: lparen2.col
                },
                end: {
                    line: lparen2.line,
                    character: lparen2.col + (lparen2.endPos - lparen2.startPos)
                }
            }
        });
    }
    current++;

    const rparen2 = input[current];
    if (rparen2.kind !== TokenKind.RParen) {
        return Err({
            message: 'Expected )',
            severity: DiagnosticSeverity.Error,
            range: {
                start: {
                    line: rparen2.line,
                    character: rparen2.col
                },
                end: {
                    line: rparen2.line,
                    character: rparen2.col + (rparen2.endPos - rparen2.startPos)
                }
            }
        });
    }
    current++;

    const rparen = input[current];
    if (rparen.kind !== TokenKind.RParen) {
        return Err({
            message: 'Expected )',
            severity: DiagnosticSeverity.Error,
            range: {
                start: {
                    line: rparen.line,
                    character: rparen.col
                },
                end: {
                    line: rparen.line,
                    character: rparen.col + (rparen.endPos - rparen.startPos)
                }
            }
        });
    }
    current++;

    const ifBlockUnchecked = parseBlockStatement(input, current);
    if (ifBlockUnchecked.is_err()) {
        return Err(ifBlockUnchecked.unwrap_err());
    }

    const ifBlock = ifBlockUnchecked.unwrap();
    ifStatement.body = ifBlock;

    const elseToken = input[ifStatement.body.endPos];
    if (elseToken.kind === TokenKind.ElseToken) {
        const elseBlockUnchecked = parseBlockStatement(input, elseToken.endPos + 1);
        if (elseBlockUnchecked.is_err()) {
            return Err(elseBlockUnchecked.unwrap_err());
        }

        const elseBlock = elseBlockUnchecked.unwrap();
        ifStatement.else = elseBlock;
        ifStatement.endPos = ifStatement.else.endPos;
    } else {
        ifStatement.endPos = ifStatement.body.endPos;
    }

    return Ok(ifStatement);
}

function parseWhileStatement(input: Token[], startPos: number): Result<WhileStatement, Diagnostic> {
    const whileStatement = {
        kind: 'WhileStatement',
        condition_function: '',
        body: {} as BlockStatement,
        startPos,
        endPos: 0
    } as WhileStatement;

    let current = startPos + 1;

    const lparen = input[current];
    if (lparen.kind !== TokenKind.LParen) {
        return Err({
            message: 'Expected (',
            severity: DiagnosticSeverity.Error,
            range: {
                start: {
                    line: lparen.line,
                    character: lparen.col
                },
                end: {
                    line: lparen.line,
                    character: lparen.col + (lparen.endPos - lparen.startPos)
                },
            },
        });
    }
    current++;

    const identifier = input[current];
    if (!isIdentifierToken(identifier)) {
        return Err({
            message: 'Expected identifier',
            severity: DiagnosticSeverity.Error,
            range: {
                start: {
                    line: identifier.line,
                    character: identifier.col
                },
                end: {
                    line: identifier.line,
                    character: identifier.col + (identifier.endPos - identifier.startPos)
                },
            },
        });
    }
    whileStatement.condition_function = identifier.value;
    current++;

    const lparen2 = input[current];
    if (lparen2.kind !== TokenKind.LParen) {
        return Err({
            message: 'Expected (',
            severity: DiagnosticSeverity.Error,
            range: {
                start: {
                    line: lparen2.line,
                    character: lparen2.col
                },
                end: {
                    line: lparen2.line,
                    character: lparen2.col + (lparen2.endPos - lparen2.startPos)
                },
            },
        });
    }
    current++;

    const rparen2 = input[current];
    if (rparen2.kind !== TokenKind.RParen) { 
        return Err({
            message: 'Expected )',
            severity: DiagnosticSeverity.Error,
            range: {
                start: {
                    line: rparen2.line,
                    character: rparen2.col
                },
                end: {
                    line: rparen2.line,
                    character: rparen2.col + (rparen2.endPos - rparen2.startPos)
                },
            },
        });
    }
    current++;

    const rparen = input[current];
    if (rparen.kind !== TokenKind.RParen) {
        return Err({
            message: 'Expected )',
            severity: DiagnosticSeverity.Error,
            range: {
                start: {
                    line: rparen.line,
                    character: rparen.col
                },
                end: {
                    line: rparen.line,
                    character: rparen.col + (rparen.endPos - rparen.startPos)
                },
            },
        });
    }
    current++;

    const whileBlockUnchecked = parseBlockStatement(input, current);
    if (whileBlockUnchecked.is_err()) {
        return Err(whileBlockUnchecked.unwrap_err());
    }

    const whileBlock = whileBlockUnchecked.unwrap();
    whileStatement.body = whileBlock
    whileStatement.endPos = whileStatement.body.endPos;

    return Ok(whileStatement);
}

function parseRepeatStatement(input: Token[], startPos: number): Result<RepeatStatement, Diagnostic> {
    const repeatStatement = {
        kind: 'RepeatStatement',
        repeat_count: 0,
        body: {} as BlockStatement,
        startPos,
        endPos: 0
    } as RepeatStatement;

    let current = startPos + 1;

    const lparen = input[current];
    if (lparen.kind !== TokenKind.LParen) {
        return Err({
            message: 'Expected (',
            severity: DiagnosticSeverity.Error,
            range: {
                start: {
                    line: lparen.line,
                    character: lparen.col
                },
                end: {
                    line: lparen.line,
                    character: lparen.col + (lparen.endPos - lparen.startPos)
                },
            },
        });
    }
    current++;

    const number = input[current];
    if (!isNumberToken(number)) {
        return Err({
            message: 'Expected number',
            severity: DiagnosticSeverity.Error,
            range: {
                start: {
                    line: number.line,
                    character: number.col
                },
                end: {
                    line: number.line,
                    character: number.col + (number.endPos - number.startPos)
                },
            },
        });
    }
    repeatStatement.repeat_count = number.value;
    current++;

    const rparen = input[current];
    if (rparen.kind !== TokenKind.RParen) {
        return Err({
            message: 'Expected )',
            severity: DiagnosticSeverity.Error,
            range: {
                start: {
                    line: rparen.line,
                    character: rparen.col
                },
                end: {
                    line: rparen.line,
                    character: rparen.col + (rparen.endPos - rparen.startPos)
                },
            },
        });
    }
    current++;

    const repeatBlockUnchecked = parseBlockStatement(input, current);
    if (repeatBlockUnchecked.is_err()) {
        return Err(repeatBlockUnchecked.unwrap_err());
    }

    const repeatBlock = repeatBlockUnchecked.unwrap();
    repeatStatement.body = repeatBlock;
    repeatStatement.endPos = repeatStatement.body.endPos;

    return Ok(repeatStatement);
}

export interface SourceFile {
    functions: FunctionDeclaration[];
}

export interface FunctionDeclaration {
    kind: 'FunctionDeclaration';
    name: string;
    body: BlockStatement;
    startPos: number;
    endPos: number;
}

export interface BlockStatement {
    kind: 'BlockStatement';
    statements: Statement[];
    startPos: number;
    endPos: number;
}

export interface CallStatement {
    kind: 'CallStatement';
    function: string;
    startPos: number;
    endPos: number;
}

export interface IfStatement {
    kind: 'IfStatement';
    condition_function: string;
    body: BlockStatement;
    else?: BlockStatement;
    startPos: number;
    endPos: number;
}

export interface WhileStatement {
    kind: 'WhileStatement';
    condition_function: string;
    body: BlockStatement;
    startPos: number;
    endPos: number;
}

export interface RepeatStatement {
    kind: 'RepeatStatement';
    repeat_count: number;
    body: BlockStatement;
    startPos: number;
    endPos: number;
}

export type Statement =
    | BlockStatement
    | CallStatement
    | IfStatement
    | WhileStatement
    | RepeatStatement;