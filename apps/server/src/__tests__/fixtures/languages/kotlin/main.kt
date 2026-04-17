package demo

import kotlin.collections.List

interface Runner {
  fun run()
}

class Box : Runner {
  override fun run() {
    helper()
  }
}

fun helper() {}
