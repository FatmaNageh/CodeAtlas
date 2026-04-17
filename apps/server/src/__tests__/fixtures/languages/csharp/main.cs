using System;

namespace Demo.App;

interface IRunner
{
  void Run();
}

class Box : IRunner
{
  public Box()
  {
  }

  public void Run()
  {
    Console.WriteLine(CreateValue());
  }

  private static int CreateValue()
  {
    return 42;
  }
}
