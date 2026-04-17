import fs from "fs";

export function add(a, b) {
  return a + b;
}

export class Box {
  run() {
    return add(1, 2) + fs.constants.O_RDONLY;
  }
}
