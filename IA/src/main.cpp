#include "TCPServer.hpp"

int main() {

    TCPServer server(4005);
    server.run();
    return (0);
}

