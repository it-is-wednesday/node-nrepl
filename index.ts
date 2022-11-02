import { createServer, Socket } from "net";
import * as bencode from "bencode";

const server = createServer((socket: Socket) => {
  socket.on("data", (data) => {
    const input = bencode.decode(data, "utf8");
    console.log(input);
    socket.pipe(socket);
  });
});

server.listen(1337, "127.0.0.1");
