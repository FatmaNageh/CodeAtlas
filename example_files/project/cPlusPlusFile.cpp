#include <iostream>
using namespace std;

int sum(int a, int b) {

    int result = a + b;

    return result;
}

int main()
{
    int a;
    int b;

    cout << "Enter two numbers\n";
    cin >> a;
    cin >> b;
    cout << "The result is " << sum(a, b);
}