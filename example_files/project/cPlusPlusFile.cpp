#include <iostream>
using namespace std;
namespace Room1 {
    // Function greet inside namespace Room1
    void greet() {
        cout << "Hello from Room 1!" << std::endl;
    }
}
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