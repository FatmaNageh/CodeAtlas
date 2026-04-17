#include <stdio.h>

struct Point {
  int x;
  int y;
};

enum Mode {
  MODE_A,
  MODE_B
};

int add(int a, int b) {
  return a + b;
}

int main(void) {
  printf("%d\n", add(1, 2));
  return 0;
}
