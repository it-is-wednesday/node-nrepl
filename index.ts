import { createServer, Socket } from "net";
import { randomUUID } from "crypto";
import * as bencode from "bencode";
import dayjs from "dayjs";

function describe() {
  const ops = {};
  for (const op of Object.keys(opIndex)) {
    // idk why all implementations return a map with empty values rather than a list
    ops[op] = {};
  }

  return {
    aux: {},
    ops,
  };
}

function clone() {
  return {
    "new-session": randomUUID(),
    "time-stamp": dayjs().format("YYYY-MM-DD hh:mm:ss.SSS000000"),
    status: ["done"],
  };
}

const opIndex = {
  clone,
  describe,
  // TODO catchall
};

const server = createServer((socket: Socket) => {
  socket.on("data", (data) => {
    const input = bencode.decode(data, "utf8");
    console.log(input);
    const resp = opIndex[input["op"]]();
    socket.write(bencode.encode({ ...resp, id: input["id"] }));
  });
});

server.listen(1337, "127.0.0.1");
