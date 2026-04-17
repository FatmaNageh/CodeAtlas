import path from "path";

export interface Runner {
  run(): void;
}

export class Box implements Runner {
  run(): void {
    helper();
  }
}

export function helper(): string {
  return path.basename("a/b");
}
