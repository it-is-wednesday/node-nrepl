import { createServer, Socket } from "net";
import { randomUUID } from "crypto";
import dayjs from "dayjs";
import * as nodeUtil from "util";
import * as bencode from "bencode";
import * as tsNode from "ts-node";
import * as stream from "node:stream";

type Operation = "clone" | "describe" | "eval";

interface Message {
  id: string;
  session?: string;
  op: Operation;
}

interface OpEval extends Message {
  code: string;
  ns: string;
  op: "eval";
}

function eval_(input: OpEval, repl: tsNode.ReplService) {
  return [
    { value: nodeUtil.inspect(repl.evalCode(input.code)) },
    { status: ["done"] },
  ];
}

function describe() {
  const ops = {};
  // fill ops map with empty maps as values, I'm not sure why that's the standard
  for (const op of Object.keys(opIndex)) {
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

type opFunc = (input: Message, tsNodeRepl?: tsNode.ReplService) => any | any[];

const opIndex: { [idx: string]: opFunc } = {
  clone,
  describe,
  eval: eval_,
  // TODO catchall
};

function makeRepl(): tsNode.ReplService {
  const tsNodeInStream = new stream.Readable({ read: function () {} });
  const tsNodeOutStream = new stream.Writable({
    write: function (chunk, encoding, callback) {
      console.log(chunk.toString());
      callback();
    },
  });
  const repl = tsNode.createRepl({
    stdin: tsNodeInStream,
    stdout: tsNodeOutStream,
  });
  const service = tsNode.create({
    ...repl.evalAwarePartialHost,
    // lets us redeclare variables freely (even consts!)
    transpileOnly: true,
  });
  repl.setService(service);
  repl.start();
  return repl;
}

const server = createServer((socket: Socket) => {
  let sessionId: string;
  const repl = makeRepl();

  socket.on("data", (socketData: Buffer) => {
    const clientMsg = bencode.decode(socketData, "utf8");

    let msgsToSend = opIndex[clientMsg["op"]](clientMsg, repl);
    if (!Array.isArray(msgsToSend)) {
      msgsToSend = [msgsToSend];
    }

    for (let msg of msgsToSend) {
      msg["id"] = clientMsg["id"];

      if (msg["new-session"]) {
        sessionId = msg["new-session"];
      } else {
        msg["session"] = sessionId;
      }

      socket.write(bencode.encode(msg));
    }
  });
});

server.listen(1337, "127.0.0.1");
