import path from "path";
import { fileURLToPath } from "url";

import type { CodeFacts } from "@/types/facts";
import type { SupportedLanguage } from "@/types/scan";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const fixturesDir = path.resolve(__dirname, "../fixtures");
export const languageFixturesDir = path.join(fixturesDir, "languages");

export type LanguageFixture = {
  relPath: string;
  language: SupportedLanguage;
  requiredImports?: string[];
  requiredSymbols: string[];
  requiredCalls?: string[];
  requiredKinds?: Array<{ name: string; kind: CodeFacts["astNodes"][number]["kind"] }>;
};

export const languageFixtures: LanguageFixture[] = [
  {
    relPath: "c/main.c",
    language: "c",
    requiredImports: ["#include <stdio.h>"],
    requiredSymbols: ["Point", "Mode", "add", "main"],
    requiredCalls: ["printf", "add"],
    requiredKinds: [
      { name: "Point", kind: "struct" },
      { name: "Mode", kind: "enum" },
      { name: "add", kind: "function" },
    ],
  },
  {
    relPath: "csharp/main.cs",
    language: "csharp",
    requiredImports: ["using System;"],
    requiredSymbols: ["Demo.App", "Demo.App.IRunner", "Demo.App.Box", "Demo.App.Box.Run", "Demo.App.Box.CreateValue"],
    requiredCalls: ["Console.WriteLine", "CreateValue"],
    requiredKinds: [
      { name: "Demo.App", kind: "namespace" },
      { name: "IRunner", kind: "interface" },
      { name: "Box", kind: "class" },
      { name: "Run", kind: "method" },
      { name: "CreateValue", kind: "method" },
    ],
  },
  {
    relPath: "cpp/main.cpp",
    language: "cpp",
    requiredImports: ["#include <vector>"],
    requiredSymbols: ["demo", "demo::Box", "demo::Box::run", "demo::helper"],
    requiredCalls: ["helper"],
    requiredKinds: [
      { name: "demo", kind: "namespace" },
      { name: "Box", kind: "class" },
      { name: "run", kind: "method" },
      { name: "helper", kind: "function" },
    ],
  },
  {
    relPath: "go/main.go",
    language: "go",
    requiredImports: ['import "fmt"'],
    requiredSymbols: ["demo", "demo.Add", "Box.Run"],
    requiredCalls: ["fmt.Println", "Add"],
    requiredKinds: [
      { name: "demo", kind: "namespace" },
      { name: "Box", kind: "struct" },
      { name: "Add", kind: "function" },
      { name: "Run", kind: "method" },
    ],
  },
  {
    relPath: "java/Main.java",
    language: "java",
    requiredImports: ["import java.util.List;"],
    requiredSymbols: ["Runner", "Box", "Box.run", "Box.helper"],
    requiredCalls: ["helper"],
    requiredKinds: [
      { name: "Runner", kind: "interface" },
      { name: "Box", kind: "class" },
      { name: "run", kind: "method" },
      { name: "helper", kind: "method" },
    ],
  },
  {
    relPath: "javascript/main.js",
    language: "javascript",
    requiredImports: ["fs"],
    requiredSymbols: ["add", "Box", "Box.run"],
    requiredCalls: ["add"],
    requiredKinds: [
      { name: "add", kind: "function" },
      { name: "Box", kind: "class" },
      { name: "run", kind: "method" },
    ],
  },
  {
    relPath: "kotlin/main.kt",
    language: "kotlin",
    requiredImports: ["import kotlin.collections.List"],
    requiredSymbols: ["demo", "demo.Runner", "demo.Box", "demo.Box.run", "demo.helper"],
    requiredCalls: ["helper"],
    requiredKinds: [
      { name: "demo", kind: "namespace" },
      { name: "Runner", kind: "interface" },
      { name: "Box", kind: "class" },
      { name: "run", kind: "method" },
      { name: "helper", kind: "function" },
    ],
  },
  {
    relPath: "php/main.php",
    language: "php",
    requiredImports: ["use Demo\\Thing;"],
    requiredSymbols: ["Runner", "Box", "Box::run", "helper"],
    requiredCalls: ["helper"],
    requiredKinds: [
      { name: "Runner", kind: "interface" },
      { name: "Box", kind: "class" },
      { name: "run", kind: "method" },
      { name: "helper", kind: "function" },
    ],
  },
  {
    relPath: "python/main.py",
    language: "python",
    requiredImports: ["import os"],
    requiredSymbols: ["Box", "Box.run", "helper"],
    requiredCalls: ["helper"],
    requiredKinds: [
      { name: "Box", kind: "class" },
      { name: "run", kind: "method" },
      { name: "helper", kind: "function" },
    ],
  },
  {
    relPath: "ruby/main.rb",
    language: "ruby",
    requiredImports: ['require "json"'],
    requiredSymbols: ["Box", "Box.run", "Box.helper"],
    requiredCalls: ["helper", "JSON.generate"],
    requiredKinds: [
      { name: "Box", kind: "class" },
      { name: "run", kind: "method" },
      { name: "helper", kind: "method" },
    ],
  },
  {
    relPath: "rust/main.rs",
    language: "rust",
    requiredImports: ["use std::fmt;"],
    requiredSymbols: ["Box", "Runner", "Box::run", "helper"],
    requiredCalls: ["helper"],
    requiredKinds: [
      { name: "Box", kind: "struct" },
      { name: "Runner", kind: "trait" },
      { name: "run", kind: "method" },
      { name: "helper", kind: "function" },
    ],
  },
  {
    relPath: "swift/main.swift",
    language: "swift",
    requiredImports: ["import Foundation"],
    requiredSymbols: ["Runner", "Box", "Box.run", "helper"],
    requiredCalls: ["helper"],
    requiredKinds: [
      { name: "Runner", kind: "protocol" },
      { name: "Box", kind: "class" },
      { name: "run", kind: "method" },
      { name: "helper", kind: "function" },
    ],
  },
  {
    relPath: "typescript/main.ts",
    language: "typescript",
    requiredImports: ["path"],
    requiredSymbols: ["Runner", "Box", "Box.run", "helper"],
    requiredCalls: ["helper"],
    requiredKinds: [
      { name: "Runner", kind: "interface" },
      { name: "Box", kind: "class" },
      { name: "run", kind: "method" },
      { name: "helper", kind: "function" },
    ],
  },
];
