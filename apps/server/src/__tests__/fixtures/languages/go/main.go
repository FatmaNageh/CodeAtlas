package demo

import "fmt"

type Box struct{}

func Add(a int, b int) int {
	return a + b
}

func (b Box) Run() {
	fmt.Println(Add(1, 2))
}
