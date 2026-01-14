/**
 * Sample code fixtures for testing
 */

export const SAMPLE_TYPESCRIPT = `
import { Something } from './other';

export class TestClass {
    private value: number;

    constructor(initialValue: number) {
        this.value = initialValue;
    }

    public getValue(): number {
        return this.value;
    }

    public setValue(newValue: number): void {
        this.value = newValue;
    }

    public static createDefault(): TestClass {
        return new TestClass(0);
    }
}

export function helperFunction(param1: string, param2: number): boolean {
    console.log(param1, param2);
    return true;
}

export const CONSTANT_VALUE = 42;
`;

export const SAMPLE_TYPESCRIPT_WITH_ERRORS = `
import { Missing } from './nonexistent';

export class BrokenClass {
    public brokenMethod() {
        return undefinedVariable;
    }
}
`;

export const SAMPLE_PYTHON = `
class SampleClass:
    def __init__(self, value):
        self.value = value
    
    def get_value(self):
        return self.value
    
    def set_value(self, new_value):
        self.value = new_value

def sample_function(param1, param2):
    return param1 + param2
`;

export const SAMPLE_CSS = `
.container {
    background-color: #ff0000;
    color: rgb(0, 255, 0);
    border: 1px solid rgba(0, 0, 255, 0.5);
}

.header {
    color: #00ff00;
}
`;

export const SAMPLE_MARKDOWN = `
# Sample Document

This is a sample document with [links](https://example.com) and references.

- List item 1
- List item 2

## Code Block

\`\`\`typescript
function example() {
    return "test";
}
\`\`\`
`;
