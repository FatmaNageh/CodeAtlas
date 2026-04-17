<?php

use Demo\Thing;

interface Runner {
  public function run(): void;
}

class Box implements Runner {
  public function run(): void {
    helper();
  }
}

function helper(): void {
}
