import Foundation

protocol Runner {
  func run()
}

class Box: NSObject, Runner {
  func run() {
    helper()
  }
}

func helper() {}
