export function add(a: number, b: number): number {
  return a + b;
}

export class Greeter {
  constructor(private name: string) {}
  greet(): string {
    return `Hello, ${this.name}`;
  }
}

const g = new Greeter('MCP');
console.log(add(1, 2), g.greet());
