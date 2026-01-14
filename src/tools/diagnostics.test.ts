import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock vscode module - must be before imports that use vscode
vi.mock('vscode', async () => {
    const { mockVscode } = await import('../test/helpers/mockVscode');
    return mockVscode;
});

import { getDiagnostics, diagnosticsSchema } from './diagnostics';
import { mockVscode, resetMocks, MockUri, MockRange, MockPosition, MockDiagnostic } from '../test/helpers/mockVscode';

describe('Diagnostics Tool', () => {
    beforeEach(() => {
        resetMocks();
    });

    describe('Schema Validation', () => {
        it('should validate empty parameters', () => {
            const validParams = {};
            const result = diagnosticsSchema.safeParse(validParams);
            expect(result.success).toBe(true);
        });

        it('should validate with uri', () => {
            const validParams = { uri: '/test/file.ts' };
            const result = diagnosticsSchema.safeParse(validParams);
            expect(result.success).toBe(true);
        });

        it('should validate with severity filter', () => {
            const validParams = { severityFilter: ['Error', 'Warning'] };
            const result = diagnosticsSchema.safeParse(validParams);
            expect(result.success).toBe(true);
        });
    });

    describe('getDiagnostics', () => {
        it('should return diagnostics for a specific file', async () => {
            const mockDiagnostics = [
                new MockDiagnostic(
                    new MockRange(new MockPosition(10, 0), new MockPosition(10, 20)),
                    'Error message',
                    mockVscode.DiagnosticSeverity.Error,
                    'typescript',
                    'TS2345'
                ),
            ];

            mockVscode.languages.getDiagnostics.mockReturnValue(mockDiagnostics);

            const result = await getDiagnostics({ uri: '/test/file.ts' });

            expect(result.diagnostics).toHaveLength(1);
            expect(result.diagnostics[0].message).toBe('Error message');
            expect(result.diagnostics[0].severity).toBe('Error');
            expect(result.summary.errors).toBe(1);
        });

        it('should return all workspace diagnostics when no uri provided', async () => {
            const file1Uri = MockUri.file('/test/file1.ts');
            const file2Uri = MockUri.file('/test/file2.ts');

            const mockDiagnosticEntries: [MockUri, MockDiagnostic[]][] = [
                [
                    file1Uri,
                    [
                        new MockDiagnostic(
                            new MockRange(new MockPosition(5, 0), new MockPosition(5, 10)),
                            'Warning message',
                            mockVscode.DiagnosticSeverity.Warning
                        ),
                    ],
                ],
                [
                    file2Uri,
                    [
                        new MockDiagnostic(
                            new MockRange(new MockPosition(10, 0), new MockPosition(10, 20)),
                            'Error message',
                            mockVscode.DiagnosticSeverity.Error
                        ),
                    ],
                ],
            ];

            mockVscode.languages.getDiagnostics.mockReturnValue(mockDiagnosticEntries);

            const result = await getDiagnostics({});

            expect(result.diagnostics).toHaveLength(2);
            expect(result.summary.errors).toBe(1);
            expect(result.summary.warnings).toBe(1);
        });

        it('should filter diagnostics by severity', async () => {
            const mockDiagnostics = [
                new MockDiagnostic(
                    new MockRange(new MockPosition(5, 0), new MockPosition(5, 10)),
                    'Warning message',
                    mockVscode.DiagnosticSeverity.Warning
                ),
                new MockDiagnostic(
                    new MockRange(new MockPosition(10, 0), new MockPosition(10, 20)),
                    'Error message',
                    mockVscode.DiagnosticSeverity.Error
                ),
            ];

            mockVscode.languages.getDiagnostics.mockReturnValue(mockDiagnostics);

            const result = await getDiagnostics({ uri: '/test/file.ts', severityFilter: ['Error'] });

            expect(result.diagnostics).toHaveLength(1);
            expect(result.diagnostics[0].severity).toBe('Error');
        });

        it('should handle diagnostic code as object', async () => {
            const mockDiagnostics = [
                new MockDiagnostic(
                    new MockRange(new MockPosition(10, 0), new MockPosition(10, 20)),
                    'Error message',
                    mockVscode.DiagnosticSeverity.Error,
                    'typescript',
                    { value: 'TS2345' }
                ),
            ];

            mockVscode.languages.getDiagnostics.mockReturnValue(mockDiagnostics);

            const result = await getDiagnostics({ uri: '/test/file.ts' });

            expect(result.diagnostics[0].code).toBe('TS2345');
        });

        it('should return proper summary', async () => {
            const mockDiagnostics = [
                new MockDiagnostic(new MockRange(new MockPosition(1, 0), new MockPosition(1, 10)), 'Error 1', mockVscode.DiagnosticSeverity.Error),
                new MockDiagnostic(new MockRange(new MockPosition(2, 0), new MockPosition(2, 10)), 'Error 2', mockVscode.DiagnosticSeverity.Error),
                new MockDiagnostic(new MockRange(new MockPosition(3, 0), new MockPosition(3, 10)), 'Warning', mockVscode.DiagnosticSeverity.Warning),
                new MockDiagnostic(new MockRange(new MockPosition(4, 0), new MockPosition(4, 10)), 'Info', mockVscode.DiagnosticSeverity.Information),
                new MockDiagnostic(new MockRange(new MockPosition(5, 0), new MockPosition(5, 10)), 'Hint', mockVscode.DiagnosticSeverity.Hint),
            ];

            mockVscode.languages.getDiagnostics.mockReturnValue(mockDiagnostics);

            const result = await getDiagnostics({ uri: '/test/file.ts' });

            expect(result.summary.errors).toBe(2);
            expect(result.summary.warnings).toBe(1);
            expect(result.summary.info).toBe(1);
            expect(result.summary.hints).toBe(1);
        });
    });
});
