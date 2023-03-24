import { Result, Ok, Err } from "ts-features";
import { 
    Diagnostic,
    DiagnosticSeverity 
} from "vscode-languageserver/node";

export function tokenize(input: string): Result<Token[], Diagnostic> {
    const tokens = [] as Token[];
    let current = 0;
    let line = 0;
    let col = 0;

    while (current < input.length) {
        let char = input[current];

        if (char === '(') {
            tokens.push({ 
                kind: TokenKind.LParen,
                startPos: current,
                endPos: current + 1,
                line,
                col
            });
            
            current++;
            col++;

            continue;
        }

        if (char === ')') {
            tokens.push({ 
                kind: TokenKind.RParen,
                startPos: current,
                endPos: current + 1,
                line,
                col 
            });

            current++;
            col++;

            continue;
        }

        if (char === '{') {
            tokens.push({ 
                kind: TokenKind.LBrace,
                startPos: current,
                endPos: current + 1,
                line,
                col 
            });

            current++;
            col++;

            continue;
        }

        if (char === '}') {
            tokens.push({ 
                kind: TokenKind.RBrace,
                startPos: current,
                endPos: current + 1,
                line,
                col 
            });

            current++;
            col++;

            continue;
        }

        if (char === ';') {
            tokens.push({
                kind: TokenKind.SemiColon,
                startPos: current,
                endPos: current + 1,
                line,
                col
            });

            current++;
            col++;

            continue;
        }

        const WHITESPACE = /[\r\t ]/;
        if (WHITESPACE.test(char)) {
            current++;
            col++;
            continue;
        }

        const LF = /\n/;
        if (LF.test(char)) {
            current++;
            line++;
            col = 0;
            continue;
        }

        const NUMBERS = /[0-9]/;
        if (NUMBERS.test(char)) {
            let value = '';

            while (NUMBERS.test(char)) {
                if (current >= input.length) {
                    return Err({
                        message: `Unexpected end of input`,
                        severity: DiagnosticSeverity.Error,
                        range: {
                            start: { line, character: col },
                            end: { line, character: col + 1 }
                        },
                    });
                }

                value += char;
                char = input[++current];
                col++;
            }

            const numValue = parseInt(value);

            tokens.push({ 
                kind: TokenKind.Number, 
                value: numValue,
                startPos: current,
                endPos: current + value.length,
                line,
                col
            });

            continue;
        }

        const LETTERS_FIRST = /[a-zA-Z_]/i;
        if (LETTERS_FIRST.test(char)) {
            let value = "";

            const LETTERS = /[a-zA-Z0-9_]/i;
            while (LETTERS.test(char)) {
                if (current >= input.length) {
                    return Err({
                        message: `Unexpected end of input`,
                        severity: DiagnosticSeverity.Error,
                        range: {
                            start: { line, character: col },
                            end: { line, character: col + 1 }
                        },
                    });
                }

                value += char;
                char = input[++current];
            }

            tokens.push({ 
                kind: reservedWordHelper(value),
                value,
                startPos: current,
                endPos: current + value.length,
                line,
                col
            });

            col += value.length;
            continue;
        }

        return Err({
            message: `Unexpected character '${char}'`,
            severity: DiagnosticSeverity.Error,
            range: {
                start: { line, character: col },
                end: { line, character: col + 1 }
            },
        });
    }

    return Ok(tokens);
}

function reservedWordHelper(word: string): TokenKind {
    switch (word) {
        case 'function':
            return TokenKind.FunctionToken;
        case 'while':
            return TokenKind.WhileToken;
        case 'repeat':
            return TokenKind.RepeatToken;
        case 'if':
            return TokenKind.IfToken;
        case 'else':
            return TokenKind.ElseToken;
        default:
            return TokenKind.Identifier;
    }
}

export enum TokenKind {
    FunctionToken = 'FunctionToken',
    WhileToken = 'WhileToken',
    RepeatToken = 'RepeatToken',
    IfToken = 'IfToken',
    ElseToken = 'ElseToken',
    Identifier = 'Identifier',
    Number = 'Number',
    LParen = 'LParen', // (
    RParen = 'RParen', // )
    LBrace = 'LBrace', // {
    RBrace = 'RBrace', // }
    SemiColon = 'SemiColon', // ;
}

export interface Token {
    kind: TokenKind;
    startPos: number;
    endPos: number;
    line: number;
    col: number;
    value?: string | number;
}

export interface IdentifierToken extends Token {
    kind: TokenKind.Identifier;
    value: string;
}

export function isIdentifierToken(token: Token): token is IdentifierToken {
    console.log(token);
    return token.kind === TokenKind.Identifier;
}

export interface NumberToken extends Token {
    kind: TokenKind.Number;
    value: number;
}

export function isNumberToken(token: Token): token is NumberToken {
    console.log(token);
    return token.kind === TokenKind.Number;
}
