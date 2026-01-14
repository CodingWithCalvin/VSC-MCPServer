import * as path from 'path';
import { runTests } from '@vscode/test-electron';

/**
 * Integration test runner for VSCode MCP Extension
 * 
 * Use sparingly - these tests are slow and require VSCode download.
 * Most tests should be unit tests using Vitest.
 */
async function main() {
    try {
        // The folder containing the Extension Manifest package.json
        const extensionDevelopmentPath = path.resolve(__dirname, '../../');

        // The path to the integration test suite
        const extensionTestsPath = path.resolve(__dirname, './integration/suite/index');

        // Test workspace path
        const testWorkspace = path.resolve(__dirname, '../../test-workspace');

        console.log('Running VSCode MCP Extension Integration Tests...');
        console.log('Extension path:', extensionDevelopmentPath);
        console.log('Test suite path:', extensionTestsPath);
        console.log('Test workspace:', testWorkspace);

        // Download VS Code, unzip it and run the integration tests
        await runTests({
            extensionDevelopmentPath,
            extensionTestsPath,
            launchArgs: [
                testWorkspace,
                '--disable-extensions', // Disable other extensions for cleaner test environment
                '--skip-welcome',
                '--skip-release-notes',
            ],
        });

        console.log('Integration tests completed successfully!');
    } catch (err) {
        console.error('Failed to run integration tests:', err);
        process.exit(1);
    }
}

main();
