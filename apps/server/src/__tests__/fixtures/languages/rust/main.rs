use std::fmt;

struct Box;

trait Runner {
    fn run(&self);
}

impl Runner for Box {
    fn run(&self) {
        helper();
    }
}

fn helper() {}
