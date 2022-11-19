import { createServer, Socket } from "net";
import { randomUUID } from "crypto";
import * as bencode from "bencode";
import * as ts from "typescript";
import * as flatted from "flatted";
import dayjs from "dayjs";

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

const state = {};

function eval_(input: OpEval) {
  const code = ts.transpile(input.code).trim();
  let valueToSend = null;

  if (
    code.startsWith("const") ||
    code.startsWith("let") ||
    code.startsWith("var")
  ) {
    // is statement
    const globalized = code.replace(/(const|let) */, "global.");
    console.log(globalized);
    eval(globalized);
  } else {
    // expression
    valueToSend = eval(code);
  }
  const prettyPrinted = flatted.stringify(valueToSend, null, 2);
  return [{ value: prettyPrinted }, { status: ["done"] }];
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

type opFunc = (nreplClientInput: Message) => any | any[];

const opIndex: { [idx: string]: opFunc } = {
  clone,
  describe,
  eval: eval_,
  // TODO catchall
};

const server = createServer((socket: Socket) => {
  let sessionId: string;

  socket.on("data", (socketData: Buffer) => {
    const clientMsg = bencode.decode(socketData, "utf8");

    let msgsToSend = opIndex[clientMsg["op"]](clientMsg);
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
